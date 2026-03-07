-- Migration 041 : Visibilité des logements par co-hôte/concierge
--
-- Contexte :
--   La table logement_users existe déjà (user_id, logement_id, role, can_mark_payment).
--   Elle est utilisée pour les permissions de paiement (migrations 039/040).
--   Cette migration l'étend pour contrôler la visibilité des logements.
--
-- Changements :
--   0. Ajouter CONCIERGE à l'enum user_role (migration 017 non appliquée en prod)
--   1. Peupler logement_users pour les co-hôtes existants (rétrocompatibilité)
--   2. Remplacer la policy RLS "lecture authentifié" par deux policies filtrées
--   3. RPC SECURITY DEFINER admin_set_logement_users() pour gérer les assignations

-- ⚠️  EXÉCUTER EN DEUX REQUÊTES SÉPARÉES dans le SQL Editor Supabase :
--
--  REQUÊTE 1 (seule) :
--    ALTER TYPE user_role ADD VALUE IF NOT EXISTS 'CONCIERGE';
--
--  REQUÊTE 2 (après validation de la 1ère) : tout ce qui suit SET search_path.
--
-- Raison : PostgreSQL erreur 55P04 — un nouveau enum value ne peut pas être
-- référencé dans la même transaction que celle qui l'a ajouté.

SET search_path TO public;

-- ─── 0. Ajouter CONCIERGE à l'enum (idempotent) ───────────────────────────────
-- Vérifié via API : en production, user_role contient seulement ADMIN et COHOTE.
-- ADD VALUE IF NOT EXISTS est safe même si la valeur existe déjà.
-- ⚠️  Ne pas inclure cette ligne dans la même exécution que le reste du script.
ALTER TYPE user_role ADD VALUE IF NOT EXISTS 'CONCIERGE';

-- ─── 1. Rétrocompatibilité ────────────────────────────────────────────────────
-- Les co-hôtes actifs existants gardent accès à tous les logements actifs.
-- La colonne `role` dans logement_users est NOT NULL → on insère le rôle de l'user.
-- ON CONFLICT (user_id, logement_id) DO NOTHING = idempotent (unique constraint existante).
INSERT INTO logement_users (user_id, logement_id, role, can_mark_payment)
SELECT
  u.id,
  l.id,
  u.role,
  COALESCE((u.permissions->>'paiement:mark_paid')::BOOLEAN, false)
FROM users u
CROSS JOIN logements l
WHERE u.role = 'COHOTE'
  AND u.archived_at IS NULL
  AND l.archived_at IS NULL
ON CONFLICT (user_id, logement_id) DO NOTHING;

-- ─── 2. Modifier la RLS sur logements ────────────────────────────────────────
-- Policy existante en production : "Logements: lecture authentifié"
--   FOR SELECT USING (auth.uid() IS NOT NULL AND archived_at IS NULL)
-- → tous les utilisateurs authentifiés voient tous les logements.
-- On la remplace par deux policies plus restrictives.

DROP POLICY IF EXISTS "Logements: lecture authentifié" ON logements;

-- Admin : voit tous les logements actifs (sous-requête pour éviter réévaluation par ligne)
CREATE POLICY "Logements: lecture admin" ON logements
  FOR SELECT USING (
    (SELECT auth.uid()) IS NOT NULL
    AND archived_at IS NULL
    AND (SELECT get_user_role()) = 'ADMIN'
  );

-- Co-hôte / Concierge : uniquement les logements dans logement_users
CREATE POLICY "Logements: lecture cohote concierge" ON logements
  FOR SELECT USING (
    (SELECT auth.uid()) IS NOT NULL
    AND archived_at IS NULL
    AND (SELECT get_user_role()) IN ('COHOTE', 'CONCIERGE')
    AND EXISTS (
      SELECT 1 FROM logement_users lu
      WHERE lu.user_id = (SELECT auth.uid())
        AND lu.logement_id = logements.id
    )
  );

-- ─── 3. RPC admin_set_logement_users ─────────────────────────────────────────
-- Remplace atomiquement les logements assignés à un utilisateur.
-- Préserve can_mark_payment selon la permission globale de l'utilisateur cible.
-- La colonne `role` dans logement_users est required → récupérée depuis users.

CREATE OR REPLACE FUNCTION admin_set_logement_users(
  p_user_id      UUID,
  p_logement_ids UUID[]
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_caller_role   public.user_role;
  v_target_role   public.user_role;
  v_can_mark_paid BOOLEAN;
BEGIN
  -- Vérifier que l'appelant est ADMIN
  SELECT role INTO v_caller_role
  FROM public.users WHERE id = auth.uid() AND archived_at IS NULL;

  IF v_caller_role IS DISTINCT FROM 'ADMIN' THEN
    RAISE EXCEPTION 'FORBIDDEN: réservé aux administrateurs';
  END IF;

  -- Récupérer le rôle et la permission mark_paid de l'utilisateur cible
  SELECT role,
         COALESCE((permissions->>'paiement:mark_paid')::BOOLEAN, false)
  INTO v_target_role, v_can_mark_paid
  FROM public.users WHERE id = p_user_id;

  IF v_target_role IS NULL THEN
    RAISE EXCEPTION 'Utilisateur introuvable';
  END IF;

  -- Supprimer les logements retirés de la liste
  DELETE FROM public.logement_users
  WHERE user_id = p_user_id
    AND logement_id <> ALL(p_logement_ids);

  -- Insérer les nouveaux logements (colonne role required, idempotent via ON CONFLICT)
  INSERT INTO public.logement_users (user_id, logement_id, role, can_mark_payment)
  SELECT p_user_id, unnest(p_logement_ids), v_target_role, v_can_mark_paid
  ON CONFLICT (user_id, logement_id) DO NOTHING;
END;
$$;

REVOKE ALL ON FUNCTION admin_set_logement_users(UUID, UUID[]) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION admin_set_logement_users(UUID, UUID[]) TO authenticated;

-- Index si absent (migration 033 créait uniquement idx_logement_users_logement)
CREATE INDEX IF NOT EXISTS idx_logement_users_user_id ON public.logement_users (user_id);

NOTIFY pgrst, 'reload schema';
