-- Fix: EDL_ENTREE_OK et EDL_ENTREE_INCIDENT manquants dans l'enum réel.
--
-- La migration 016 a modifié le type 'pipeline_statut' mais la colonne
-- dossiers.pipeline_statut utilise le type 'dossier_pipeline_statut'.
-- Les deux nouvelles valeurs n'ont donc jamais été ajoutées au bon enum.
-- Résultat : ERROR 22P02 invalid input value for enum dossier_pipeline_statut.

ALTER TYPE dossier_pipeline_statut ADD VALUE IF NOT EXISTS 'EDL_ENTREE_OK' AFTER 'CHECKIN_FAIT';
ALTER TYPE dossier_pipeline_statut ADD VALUE IF NOT EXISTS 'EDL_ENTREE_INCIDENT' AFTER 'EDL_ENTREE_OK';
