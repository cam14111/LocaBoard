-- Migration 052 : RPC archive_logement pour contourner la contrainte RLS SELECT
--
-- Contexte :
--   PostgREST génère UPDATE ... RETURNING * même avec Prefer: return=minimal.
--   La SELECT policy "Logements: lecture" filtre archived_at IS NULL, donc la ligne
--   archivée (archived_at non-null) échoue le check RETURNING → erreur 403.
--
-- Solution :
--   Fonction SECURITY DEFINER qui bypass RLS, avec vérifications manuelles :
--   - appelant ADMIN
--   - pas de réservations actives
--   - soft-delete via archived_at

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
END;
$$;

REVOKE ALL ON FUNCTION archive_logement(UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION archive_logement(UUID) TO authenticated;

NOTIFY pgrst, 'reload schema';
