-- Correction des données orphelines :
-- 1. Tâches A_FAIRE/EN_COURS sans dossier (dossier_id IS NULL) → ANNULEE
-- 2. Dossiers actifs dont la réservation est ANNULEE → pipeline ANNULE + cascade tâches

-- ─── 1. Tâches sans dossier ───────────────────────────────────────────────────

UPDATE taches
SET statut = 'ANNULEE'::tache_statut
WHERE dossier_id IS NULL
  AND statut IN ('A_FAIRE', 'EN_COURS');

-- ─── 2. Dossiers actifs liés à une réservation ANNULEE ───────────────────────

-- 2a. Annuler le pipeline du dossier
UPDATE dossiers
SET pipeline_statut = 'ANNULE'::pipeline_statut
WHERE pipeline_statut NOT IN ('ANNULE', 'CLOTURE')
  AND reservation_id IN (
    SELECT id FROM reservations WHERE statut = 'ANNULEE'
  );

-- 2b. Cascade : annuler les tâches A_FAIRE/EN_COURS de ces dossiers
UPDATE taches
SET statut = 'ANNULEE'::tache_statut
WHERE statut IN ('A_FAIRE', 'EN_COURS')
  AND dossier_id IN (
    SELECT id FROM dossiers WHERE pipeline_statut = 'ANNULE'
  );
