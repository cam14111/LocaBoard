-- Correction des données existantes :
-- Les tâches A_FAIRE/EN_COURS liées à des dossiers ANNULE n'ont pas été annulées
-- car cancelDossierCascade utilisait un UPDATE direct bloqué par les RLS.

UPDATE taches
SET statut = 'ANNULEE'::tache_statut
WHERE statut IN ('A_FAIRE', 'EN_COURS')
  AND dossier_id IN (
    SELECT id FROM dossiers WHERE pipeline_statut = 'ANNULE'
  );
