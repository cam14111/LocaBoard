-- Migration 053 : Nettoyer logement_users lors de l'archivage d'un logement
--
-- Contexte :
--   La migration 052 archive un logement via soft-delete (archived_at).
--   Mais les entrées dans logement_users persistent, ce qui fait apparaître
--   le logement archivé dans la liste des logements accessibles des utilisateurs.
--
-- Fix :
--   Ajouter un DELETE FROM logement_users dans le RPC archive_logement,
--   après l'UPDATE du logement.

SET search_path TO public;

CREATE OR REPLACE FUNCTION archive_logement(p_logement_id UUID)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_role       public.user_role;
  v_active_res INT;
BEGIN
  -- Vérifier que l'appelant est ADMIN
  SELECT role INTO v_role
  FROM public.users
  WHERE id = auth.uid() AND archived_at IS NULL;

  IF v_role IS DISTINCT FROM 'ADMIN' THEN
    RAISE EXCEPTION 'FORBIDDEN: réservé aux administrateurs';
  END IF;

  -- Vérifier l'absence de réservations actives
  SELECT COUNT(*) INTO v_active_res
  FROM public.reservations
  WHERE logement_id = p_logement_id
    AND archived_at IS NULL
    AND statut IN ('OPTION_ACTIVE', 'CONFIRMEE');

  IF v_active_res > 0 THEN
    RAISE EXCEPTION 'RESERVATIONS_ACTIVES: impossible d''archiver un logement avec des réservations actives';
  END IF;

  -- Archivage
  UPDATE public.logements
  SET archived_at = now()
  WHERE id = p_logement_id
    AND archived_at IS NULL;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'NOT_FOUND: logement introuvable ou déjà archivé';
  END IF;

  -- Nettoyer les accès : retirer ce logement de tous les utilisateurs
  DELETE FROM public.logement_users
  WHERE logement_id = p_logement_id;
END;
$$;

REVOKE ALL ON FUNCTION archive_logement(UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION archive_logement(UUID) TO authenticated;

NOTIFY pgrst, 'reload schema';
