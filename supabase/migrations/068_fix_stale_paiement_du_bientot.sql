-- Supprime les notifications PAIEMENT_DU_BIENTOT stales pour les dossiers
-- dont tous les paiements sont PAYE ou ANNULE (aucun DU ni EN_RETARD restant).

DELETE FROM notifications
WHERE type = 'PAIEMENT_DU_BIENTOT'
  AND entity_type = 'dossier'
  AND entity_id IN (
    SELECT id FROM dossiers
    WHERE NOT EXISTS (
      SELECT 1 FROM paiements
      WHERE paiements.dossier_id = dossiers.id
        AND paiements.statut IN ('DU', 'EN_RETARD')
    )
  );
