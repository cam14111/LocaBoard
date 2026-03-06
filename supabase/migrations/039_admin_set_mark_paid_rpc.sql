-- Migration 039 : RPC SECURITY DEFINER pour que l'admin puisse activer/désactiver
-- la permission "marquer payé" d'un co-hôte.
--
-- PROBLÈME : le trigger restrict_user_self_updates bloque les UPDATE sur public.users
-- pour le rôle "authenticated" (y compris l'admin). Les fonctions SECURITY DEFINER
-- s'exécutent en tant que leur propriétaire (postgres), ce qui contourne ce trigger.
--
-- Cette RPC met à jour simultanément :
--   1. users.permissions['paiement:mark_paid']  (vérifié par la policy RLS paiements)
--   2. logement_users.can_mark_payment          (tous les logements du co-hôte)

CREATE OR REPLACE FUNCTION admin_set_mark_paid(
  p_user_id UUID,
  p_enabled BOOLEAN
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_role public.user_role;
  v_target_role public.user_role;
  v_permissions JSONB;
BEGIN
  -- Vérifier que l'appelant est ADMIN
  SELECT role INTO v_role FROM public.users WHERE id = auth.uid();
  IF v_role IS DISTINCT FROM 'ADMIN' THEN
    RAISE EXCEPTION 'FORBIDDEN: seul un ADMIN peut modifier les permissions';
  END IF;

  -- Vérifier que la cible est un COHOTE (pas ADMIN ni CONCIERGE)
  SELECT role, permissions INTO v_target_role, v_permissions
  FROM public.users WHERE id = p_user_id;

  IF v_target_role IS DISTINCT FROM 'COHOTE' THEN
    RAISE EXCEPTION 'INVALID: la permission mark_paid ne s''applique qu''aux co-hôtes';
  END IF;

  -- 1. Mettre à jour users.permissions
  UPDATE public.users
  SET permissions = COALESCE(v_permissions, '{}') || jsonb_build_object('paiement:mark_paid', p_enabled)
  WHERE id = p_user_id;

  -- 2. Mettre à jour logement_users.can_mark_payment pour tous les logements du co-hôte
  UPDATE public.logement_users
  SET can_mark_payment = p_enabled
  WHERE user_id = p_user_id;
END;
$$;

-- Seuls les utilisateurs authentifiés peuvent appeler cette RPC
-- (la vérification ADMIN est faite à l'intérieur)
REVOKE ALL ON FUNCTION admin_set_mark_paid(UUID, BOOLEAN) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION admin_set_mark_paid(UUID, BOOLEAN) TO authenticated;

NOTIFY pgrst, 'reload schema';
