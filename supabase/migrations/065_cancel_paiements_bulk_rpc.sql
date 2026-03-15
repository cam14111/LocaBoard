-- Fix: cancelDossierCascade utilisait un UPDATE direct sur paiements.statut = 'ANNULE'
-- ce qui échoue silencieusement pour les non-admin à cause des RLS
-- (seul l'admin peut UPDATE paiements — cf. migrations 017/040).
-- Solution : fonction SECURITY DEFINER pour la cancellation en masse.

SET search_path TO public;

CREATE OR REPLACE FUNCTION cancel_paiements_bulk(p_paiement_ids UUID[])
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'UNAUTHENTICATED';
  END IF;

  UPDATE paiements
  SET statut = 'ANNULE'
  WHERE id = ANY(p_paiement_ids)
    AND statut IN ('DU', 'EN_RETARD');
END;
$$;

GRANT EXECUTE ON FUNCTION cancel_paiements_bulk(UUID[]) TO authenticated;

NOTIFY pgrst, 'reload schema';
