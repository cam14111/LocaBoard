-- Migration 034 : Correction FK audit_log.logement_id + nettoyage index inutilisés
-- Problème détecté après migration 033 :
--   - idx_audit_log_logement (supprimé en 033 comme "inutilisé") couvrait en réalité
--     la FK audit_log_logement_id_fkey → la FK est maintenant sans index couvrant.
-- Autres index pré-existants confirmés inutilisés par le linter.

-- ─── 1. Recréation de l'index couvrant audit_log.logement_id ─────────────────

CREATE INDEX IF NOT EXISTS idx_audit_log_logement ON public.audit_log (logement_id);


-- ─── 2. Suppression des index pré-existants inutilisés ───────────────────────

DROP INDEX IF EXISTS idx_notifications_dedup;
DROP INDEX IF EXISTS idx_reservations_date_debut_confirmee;
DROP INDEX IF EXISTS idx_reservations_date_fin_confirmee;
DROP INDEX IF EXISTS idx_reservations_statut_non_archive;

NOTIFY pgrst, 'reload schema';
