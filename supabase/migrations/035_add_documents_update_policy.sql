-- Migration 035: Ajoute la policy RLS UPDATE sur la table documents
-- Nécessaire pour que replaceDocument() puisse archiver (archived_at) l'ancien document.
-- Sans cette policy, l'UPDATE était silencieusement bloqué par Supabase RLS.
-- Supprime l'ancienne policy admin-only non tracée pour éviter le doublon.

DROP POLICY IF EXISTS documents_update_admin_only ON public.documents;
DROP POLICY IF EXISTS documents_update ON public.documents;

CREATE POLICY documents_update ON public.documents
  FOR UPDATE
  USING ((select auth.uid()) IS NOT NULL)
  WITH CHECK ((select auth.uid()) IS NOT NULL);
