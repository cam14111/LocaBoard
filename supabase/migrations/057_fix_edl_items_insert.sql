-- 057 : Fix complet INSERT edl_items
-- Applique idempotent les corrections nécessaires qui n'ont pas encore été
-- déployées en production (migrations 047 et 056 potentiellement manquantes).

SET search_path TO public;

-- 1. S'assurer que la colonne piece_id existe sur edl_items
--    (migration 047 — sans erreur si déjà présente)
ALTER TABLE public.edl_items
  ADD COLUMN IF NOT EXISTS piece_id UUID
    REFERENCES public.logement_pieces(id) ON DELETE SET NULL;

-- 2. Index sur piece_id si manquant (migration 054)
CREATE INDEX IF NOT EXISTS idx_edl_items_piece_id
  ON public.edl_items (piece_id);

-- 3. Recréer la politique INSERT (migration 056)
DROP POLICY IF EXISTS edl_items_insert_admin_or_cohote ON public.edl_items;
DROP POLICY IF EXISTS "EDL items: écriture authentifié" ON public.edl_items;

CREATE POLICY edl_items_insert_admin_or_cohote ON public.edl_items
  FOR INSERT WITH CHECK (
    (select auth.uid()) IS NOT NULL
  );

-- 4. S'assurer que authenticated a bien le GRANT INSERT
GRANT INSERT ON public.edl_items TO authenticated;

-- 5. Recharger le schéma PostgREST
NOTIFY pgrst, 'reload schema';
