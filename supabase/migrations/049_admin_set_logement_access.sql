-- Migration 049 : RPC admin_set_logement_access
--
-- Contexte :
--   La RPC existante admin_set_logement_users(user_id, logement_ids[]) gère les accès
--   dans le sens "utilisateur → ses logements" (depuis l'écran Utilisateurs).
--   Cette migration crée la RPC symétrique dans le sens "logement → ses utilisateurs"
--   (depuis le formulaire Logement, onglet Accès).
--
-- Les deux RPCs modifient la même table logement_users et sont donc parfaitement
-- compatibles et interchangeables (source de vérité unique).

SET search_path TO public;

CREATE OR REPLACE FUNCTION admin_set_logement_access(
  p_logement_id UUID,
  p_user_ids    UUID[]
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_caller_role public.user_role;
BEGIN
  -- Vérifier que l'appelant est ADMIN
  SELECT role INTO v_caller_role
  FROM public.users WHERE id = auth.uid() AND archived_at IS NULL;

  IF v_caller_role IS DISTINCT FROM 'ADMIN' THEN
    RAISE EXCEPTION 'FORBIDDEN: réservé aux administrateurs';
  END IF;

  -- Supprimer les accès retirés de la liste
  DELETE FROM public.logement_users
  WHERE logement_id = p_logement_id
    AND user_id <> ALL(p_user_ids);

  -- Insérer les nouveaux accès (rôle + can_mark_payment récupérés depuis users)
  -- ON CONFLICT DO NOTHING = idempotent (accès existants préservés)
  INSERT INTO public.logement_users (user_id, logement_id, role, can_mark_payment)
  SELECT
    u.id,
    p_logement_id,
    u.role,
    COALESCE((u.permissions->>'paiement:mark_paid')::BOOLEAN, false)
  FROM public.users u
  WHERE u.id = ANY(p_user_ids)
    AND u.archived_at IS NULL
  ON CONFLICT (user_id, logement_id) DO NOTHING;
END;
$$;

REVOKE ALL ON FUNCTION admin_set_logement_access(UUID, UUID[]) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION admin_set_logement_access(UUID, UUID[]) TO authenticated;

NOTIFY pgrst, 'reload schema';
