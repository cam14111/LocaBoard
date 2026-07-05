-- 078 — Performance : index couvrants sur les clés étrangères non indexées.
--
-- Signalé par l'advisor performance Supabase. Sans index couvrant, les jointures
-- et les suppressions/mises à jour en cascade sur ces FK font des scans
-- séquentiels. Volume faible aujourd'hui mais audit_log/paiements/taches
-- croissent en continu — index posés de manière préventive.

CREATE INDEX IF NOT EXISTS idx_audit_log_actor_user_id ON public.audit_log (actor_user_id);
CREATE INDEX IF NOT EXISTS idx_audit_log_logement_id ON public.audit_log (logement_id);
CREATE INDEX IF NOT EXISTS idx_blocages_created_by_user_id ON public.blocages (created_by_user_id);
CREATE INDEX IF NOT EXISTS idx_document_shares_created_by ON public.document_shares (created_by);
CREATE INDEX IF NOT EXISTS idx_documents_uploaded_by_user_id ON public.documents (uploaded_by_user_id);
CREATE INDEX IF NOT EXISTS idx_edls_realise_par_user_id ON public.edls (realise_par_user_id);
CREATE INDEX IF NOT EXISTS idx_incidents_created_by_user_id ON public.incidents (created_by_user_id);
CREATE INDEX IF NOT EXISTS idx_incidents_edl_id ON public.incidents (edl_id);
CREATE INDEX IF NOT EXISTS idx_notes_created_by_user_id ON public.notes (created_by_user_id);
CREATE INDEX IF NOT EXISTS idx_notes_dossier_id ON public.notes (dossier_id);
CREATE INDEX IF NOT EXISTS idx_paiements_paid_by_user_id ON public.paiements (paid_by_user_id);
CREATE INDEX IF NOT EXISTS idx_paiements_proof_document_id ON public.paiements (proof_document_id);
CREATE INDEX IF NOT EXISTS idx_reservations_created_by_user_id ON public.reservations (created_by_user_id);
CREATE INDEX IF NOT EXISTS idx_taches_completed_by_user_id ON public.taches (completed_by_user_id);
