-- Fix: cancelDossierCascade utilisait un UPDATE direct sur taches.statut = 'ANNULEE'
-- ce qui échoue à cause des restrictions RLS (voir migrations 010/011/012).
-- Solution : fonction SECURITY DEFINER pour la cancellation en masse.

SET search_path TO public;

CREATE OR REPLACE FUNCTION cancel_taches_bulk(p_tache_ids UUID[])
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'UNAUTHENTICATED';
  END IF;

  UPDATE taches
  SET statut = 'ANNULEE'::tache_statut
  WHERE id = ANY(p_tache_ids)
    AND statut IN ('A_FAIRE', 'EN_COURS');
END;
$$;

GRANT EXECUTE ON FUNCTION cancel_taches_bulk(UUID[]) TO authenticated;

NOTIFY pgrst, 'reload schema';
