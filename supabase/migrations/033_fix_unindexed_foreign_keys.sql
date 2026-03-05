-- Migration 033 : Correction des clés étrangères non indexées (Supabase Performance Advisor)
-- Résout deux catégories de problèmes :
--   1. unindexed_foreign_keys : 19 FK sans index couvrant → risque de seq scan
--   2. unused_index : 2 index jamais utilisés → gaspillage de ressources

-- ─── 1. Suppression des index inutilisés ─────────────────────────────────────

-- idx_audit_log_logement : créé hors migration, jamais utilisé
DROP INDEX IF EXISTS idx_audit_log_logement;

-- idx_reservations_statut : existant depuis migration 001, jamais utilisé
-- idx_reservations_logement_statut (logement_id, statut) le couvre déjà entièrement
DROP INDEX IF EXISTS idx_reservations_statut;


-- ─── 2. Index manquants sur clés étrangères ───────────────────────────────────

-- audit_log
CREATE INDEX IF NOT EXISTS idx_audit_log_actor_user ON public.audit_log (actor_user_id);

-- blocages
CREATE INDEX IF NOT EXISTS idx_blocages_created_by ON public.blocages (created_by_user_id);

-- document_shares
CREATE INDEX IF NOT EXISTS idx_document_shares_created_by ON public.document_shares (created_by);

-- documents
CREATE INDEX IF NOT EXISTS idx_documents_remplace ON public.documents (remplace_document_id);
CREATE INDEX IF NOT EXISTS idx_documents_uploaded_by ON public.documents (uploaded_by_user_id);

-- edls
CREATE INDEX IF NOT EXISTS idx_edls_realise_par ON public.edls (realise_par_user_id);

-- incident_photos
CREATE INDEX IF NOT EXISTS idx_incident_photos_incident ON public.incident_photos (incident_id);

-- incidents
CREATE INDEX IF NOT EXISTS idx_incidents_created_by ON public.incidents (created_by_user_id);
CREATE INDEX IF NOT EXISTS idx_incidents_dossier ON public.incidents (dossier_id);
CREATE INDEX IF NOT EXISTS idx_incidents_edl ON public.incidents (edl_id);

-- logement_users
CREATE INDEX IF NOT EXISTS idx_logement_users_logement ON public.logement_users (logement_id);

-- notes
CREATE INDEX IF NOT EXISTS idx_notes_created_by ON public.notes (created_by_user_id);
CREATE INDEX IF NOT EXISTS idx_notes_dossier ON public.notes (dossier_id);

-- paiements
CREATE INDEX IF NOT EXISTS idx_paiements_paid_by ON public.paiements (paid_by_user_id);
CREATE INDEX IF NOT EXISTS idx_paiements_proof_document ON public.paiements (proof_document_id);

-- reservations
CREATE INDEX IF NOT EXISTS idx_reservations_created_by ON public.reservations (created_by_user_id);

-- taches (IF NOT EXISTS : idx_taches_assignee et idx_taches_dossier existent peut-être déjà)
CREATE INDEX IF NOT EXISTS idx_taches_assignee_user ON public.taches (assignee_user_id);
CREATE INDEX IF NOT EXISTS idx_taches_completed_by ON public.taches (completed_by_user_id);
CREATE INDEX IF NOT EXISTS idx_taches_dossier_fk ON public.taches (dossier_id);

NOTIFY pgrst, 'reload schema';
