-- Suppression des notifications stales :
-- 1. Notifications sur des dossiers ANNULE ou CLOTURE
-- 2. Notifications sur des tâches ANNULEE ou FAIT
-- 3. Notifications sur des réservations ANNULEE

-- ─── 1. Dossiers annulés / clôturés ──────────────────────────────────────────

DELETE FROM notifications
WHERE entity_type = 'dossier'
  AND entity_id IN (
    SELECT id FROM dossiers WHERE pipeline_statut IN ('ANNULE', 'CLOTURE')
  );

-- ─── 2. Tâches annulées ou faites ────────────────────────────────────────────

DELETE FROM notifications
WHERE entity_type = 'tache'
  AND entity_id IN (
    SELECT id FROM taches WHERE statut IN ('ANNULEE', 'FAIT')
  );

-- ─── 3. Réservations annulées ─────────────────────────────────────────────────

DELETE FROM notifications
WHERE entity_type = 'reservation'
  AND entity_id IN (
    SELECT id FROM reservations WHERE statut = 'ANNULEE'
  );
