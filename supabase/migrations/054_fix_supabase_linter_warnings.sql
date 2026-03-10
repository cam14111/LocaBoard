-- Migration 054 : Correction des warnings Supabase Database Linter
-- 1. auth_rls_initplan      → utiliser (select auth.uid()) dans les policies
-- 2. multiple_permissive    → séparer SELECT et écriture dans les policies
-- 3. function_search_path   → SET search_path = '' sur update_updated_at
-- 4. unindexed_foreign_keys → index sur edl_items.piece_id
-- 5. unused_index           → suppression des index jamais utilisés

-- ── 1 & 2. logement_pieces : corriger policies RLS ────────────────────────────
-- Problème : "Pieces: admin write" est FOR ALL (inclut SELECT) + "Pieces: lecture
-- authentifié" est FOR SELECT → double politique SELECT permissive pour chaque rôle.
-- De plus, auth.uid() est ré-évalué ligne par ligne (auth_rls_initplan).
-- Fix : scinder admin write en INSERT+UPDATE+DELETE, et corriger le SELECT.

DROP POLICY IF EXISTS "Pieces: lecture authentifié" ON public.logement_pieces;
DROP POLICY IF EXISTS "Pieces: admin write" ON public.logement_pieces;

-- SELECT unique : tous les utilisateurs authentifiés (auth.uid() optimisé)
CREATE POLICY "Pieces: lecture authentifié" ON public.logement_pieces
  FOR SELECT USING ((select auth.uid()) IS NOT NULL);

-- Écriture uniquement : admin (ne couvre plus SELECT → plus de doublon)
CREATE POLICY "Pieces: admin insert" ON public.logement_pieces
  FOR INSERT WITH CHECK (public.get_user_role() = 'ADMIN');

CREATE POLICY "Pieces: admin update" ON public.logement_pieces
  FOR UPDATE USING (public.get_user_role() = 'ADMIN');

CREATE POLICY "Pieces: admin delete" ON public.logement_pieces
  FOR DELETE USING (public.get_user_role() = 'ADMIN');


-- ── 1 & 2. logement_saisons : corriger policies RLS ──────────────────────────

DROP POLICY IF EXISTS "Saisons: lecture authentifié" ON public.logement_saisons;
DROP POLICY IF EXISTS "Saisons: admin write" ON public.logement_saisons;

CREATE POLICY "Saisons: lecture authentifié" ON public.logement_saisons
  FOR SELECT USING ((select auth.uid()) IS NOT NULL);

CREATE POLICY "Saisons: admin insert" ON public.logement_saisons
  FOR INSERT WITH CHECK (public.get_user_role() = 'ADMIN');

CREATE POLICY "Saisons: admin update" ON public.logement_saisons
  FOR UPDATE USING (public.get_user_role() = 'ADMIN');

CREATE POLICY "Saisons: admin delete" ON public.logement_saisons
  FOR DELETE USING (public.get_user_role() = 'ADMIN');


-- ── 3. update_updated_at : fixer search_path ─────────────────────────────────
CREATE OR REPLACE FUNCTION public.update_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = ''
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;


-- ── 4. edl_items.piece_id : index sur la FK sans index ───────────────────────
CREATE INDEX IF NOT EXISTS idx_edl_items_piece_id ON public.edl_items (piece_id);


-- ── 5. Suppression des index jamais utilisés ─────────────────────────────────
DROP INDEX IF EXISTS public.idx_audit_log_actor_user;
DROP INDEX IF EXISTS public.idx_audit_log_logement;
DROP INDEX IF EXISTS public.idx_blocages_created_by;
DROP INDEX IF EXISTS public.idx_document_shares_created_by;
DROP INDEX IF EXISTS public.idx_documents_uploaded_by;
DROP INDEX IF EXISTS public.idx_edls_realise_par;
DROP INDEX IF EXISTS public.idx_incidents_created_by;
DROP INDEX IF EXISTS public.idx_incidents_edl;
DROP INDEX IF EXISTS public.idx_notes_created_by;
DROP INDEX IF EXISTS public.idx_notes_dossier;
DROP INDEX IF EXISTS public.idx_paiements_paid_by;
DROP INDEX IF EXISTS public.idx_paiements_proof_document;
DROP INDEX IF EXISTS public.idx_reservations_created_by;
DROP INDEX IF EXISTS public.idx_taches_completed_by;
