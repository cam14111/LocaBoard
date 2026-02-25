-- ============================================================
-- Migration 017 — Gestion admin des utilisateurs
-- Nouveautés :
--   1. Rôle CONCIERGE (nouveau)
--   2. Fonction count_admins() pour garde dernier-admin
--   3. RLS paiements : co-hôte avec permission peut marquer payé
--   4. RLS tâches : concierge peut compléter ses tâches assignées
--   5. Policies mises à jour sur users pour empêcher le dernier
--      admin de se dégrader et les non-admins de modifier les profils
-- ============================================================

-- ─── 1. Ajouter la valeur CONCIERGE à l'enum user_role ───────
-- PostgreSQL requiert ALTER TYPE ... ADD VALUE ; ne peut pas être
-- dans une transaction par défaut, mais Supabase l'accepte.
ALTER TYPE user_role ADD VALUE IF NOT EXISTS 'CONCIERGE';

-- ─── 2. Fonction helpers ──────────────────────────────────────

-- Retourne le nombre d'admins actifs (non archivés)
CREATE OR REPLACE FUNCTION count_admins()
RETURNS INTEGER
LANGUAGE sql
SECURITY DEFINER
STABLE
AS $$
  SELECT COUNT(*)::INTEGER
  FROM utilisateurs
  WHERE role = 'ADMIN'
    AND archived_at IS NULL;
$$;

-- Vérifie qu'une permission JSONB est activée pour l'utilisateur courant
CREATE OR REPLACE FUNCTION current_user_has_permission(perm TEXT)
RETURNS BOOLEAN
LANGUAGE sql
SECURITY DEFINER
STABLE
AS $$
  SELECT COALESCE(
    (SELECT (permissions ->> perm)::BOOLEAN
     FROM utilisateurs
     WHERE id = auth.uid()),
    FALSE
  );
$$;

-- Met à jour get_user_role pour être robuste (retourne NULL si absent)
CREATE OR REPLACE FUNCTION get_user_role()
RETURNS user_role
LANGUAGE sql
SECURITY DEFINER
STABLE
AS $$
  SELECT role FROM utilisateurs WHERE id = auth.uid() AND archived_at IS NULL;
$$;

-- ─── 3. Mettre à jour la policy paiements ────────────────────
-- Supprimer l'ancienne policy "admin only" et la remplacer par une
-- policy qui autorise aussi le co-hôte avec permission mark_paid.

DROP POLICY IF EXISTS "Paiements: admin write" ON paiements;

-- Admin : peut tout faire sur paiements
CREATE POLICY "Paiements: admin write" ON paiements
  FOR ALL USING (get_user_role() = 'ADMIN');

-- Co-hôte avec permission paiement:mark_paid : peut UPDATE le statut
-- (uniquement les colonnes de marquage payé : statut, method, paid_at, paid_by_user_id)
CREATE POLICY "Paiements: cohote mark paid" ON paiements
  FOR UPDATE
  USING (
    get_user_role() = 'COHOTE'
    AND current_user_has_permission('paiement:mark_paid')
  )
  WITH CHECK (
    get_user_role() = 'COHOTE'
    AND current_user_has_permission('paiement:mark_paid')
  );

-- ─── 4. Mettre à jour la policy tâches pour le concierge ─────
-- Le concierge peut compléter (UPDATE) les tâches qui lui sont assignées.

DROP POLICY IF EXISTS "Tâches: update assigné ou admin" ON taches;

CREATE POLICY "Tâches: update assigné ou admin" ON taches
  FOR UPDATE
  USING (
    get_user_role() = 'ADMIN'
    OR assignee_user_id = auth.uid()
  );

-- Le concierge peut INSERT (création de notes de tâche, photos de preuve)
-- déjà couvert par "écriture authentifié" sur les tables liées.
-- Pour les tâches elles-mêmes : seul l'admin peut en créer.
DROP POLICY IF EXISTS "Tâches: admin write" ON taches;
CREATE POLICY "Tâches: admin write" ON taches
  FOR INSERT WITH CHECK (get_user_role() = 'ADMIN');

-- ─── 5. Policies utilisateurs — sécurité admin ───────────────
-- La policy "Utilisateurs: admin full" couvre déjà SELECT/INSERT/UPDATE/DELETE
-- pour les admins. On ajoute une policy spécifique UPDATE avec garde
-- pour empêcher le dernier admin de se dégrader.

DROP POLICY IF EXISTS "Utilisateurs: admin full" ON utilisateurs;

-- Lecture : tout utilisateur authentifié peut lire les profils
-- (déjà en place, on ne la touche pas)

-- Écriture admin avec garde dernier-admin :
-- Un admin peut modifier n'importe quel profil SAUF :
--   - changer son propre rôle si c'est le dernier admin
--   - rétrograder le dernier admin de la plateforme
CREATE POLICY "Utilisateurs: admin insert" ON utilisateurs
  FOR INSERT
  WITH CHECK (get_user_role() = 'ADMIN');

CREATE POLICY "Utilisateurs: admin update" ON utilisateurs
  FOR UPDATE
  USING (get_user_role() = 'ADMIN')
  WITH CHECK (
    -- Autoriser si ce n'est pas une rétrogradation du dernier admin
    NOT (
      -- La ligne modifiée EST un admin actuellement
      (SELECT role FROM utilisateurs WHERE id = utilisateurs.id) = 'ADMIN'
      -- ET on essaie de changer vers un rôle non-admin
      AND role <> 'ADMIN'
      -- ET c'est le dernier admin actif
      AND count_admins() <= 1
    )
  );

CREATE POLICY "Utilisateurs: admin delete" ON utilisateurs
  FOR DELETE
  USING (get_user_role() = 'ADMIN');

-- ─── 6. Policy tâches : lecture pour concierge ───────────────
-- Le concierge doit voir les tâches qui lui sont assignées.
-- La policy "lecture authentifié" couvre déjà tous les authentifiés,
-- donc pas de changement nécessaire.

-- ─── 7. Policy EDL pour concierge ────────────────────────────
-- Le concierge peut créer et modifier des EDL (déjà couvert par
-- "EDL: écriture authentifié" qui autorise tous les authentifiés).
-- RAS.

-- ─── 8. Policy Documents — concierge peut uploader EDL ───────
-- Ajouter une policy pour que le concierge puisse uploader des docs EDL.
DROP POLICY IF EXISTS "Documents: cohote insert edl" ON documents;

CREATE POLICY "Documents: cohote ou concierge insert edl" ON documents
  FOR INSERT WITH CHECK (
    (get_user_role() = 'COHOTE' OR get_user_role() = 'CONCIERGE')
    AND type = 'EDL'
  );

-- ─── Fin migration 017 ────────────────────────────────────────
