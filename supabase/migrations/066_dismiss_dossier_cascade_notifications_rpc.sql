-- Lors de l'annulation d'un dossier, supprime toutes les notifications liées :
-- - notifications sur le dossier (PAIEMENT_EN_RETARD, PAIEMENT_DU_BIENTOT, ARRIVEE_IMMINENTE, DEPART_IMMINENT)
-- - notifications sur les tâches du dossier (TACHE_EN_RETARD, TACHE_ASSIGNEE)
-- - notifications sur la réservation du dossier (ARRIVEE_IMMINENTE, DEPART_IMMINENT, OPTION_EXPIRE_BIENTOT, OPTION_EXPIREE)

CREATE OR REPLACE FUNCTION dismiss_dossier_cascade_notifications(p_dossier_id UUID)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_reservation_id UUID;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'UNAUTHENTICATED';
  END IF;

  -- Récupérer l'id de réservation
  SELECT reservation_id INTO v_reservation_id
  FROM dossiers WHERE id = p_dossier_id;

  -- Supprimer les notifications liées au dossier
  DELETE FROM notifications
  WHERE entity_type = 'dossier' AND entity_id = p_dossier_id;

  -- Supprimer les notifications liées aux tâches du dossier
  DELETE FROM notifications
  WHERE entity_type = 'tache'
    AND entity_id IN (
      SELECT id FROM taches WHERE dossier_id = p_dossier_id
    );

  -- Supprimer les notifications liées à la réservation
  IF v_reservation_id IS NOT NULL THEN
    DELETE FROM notifications
    WHERE entity_type = 'reservation' AND entity_id = v_reservation_id;
  END IF;
END;
$$;

GRANT EXECUTE ON FUNCTION dismiss_dossier_cascade_notifications(UUID) TO authenticated;

NOTIFY pgrst, 'reload schema';
