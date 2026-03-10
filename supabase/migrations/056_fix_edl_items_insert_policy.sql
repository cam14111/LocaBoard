-- Migration 056 : Recréer la politique INSERT sur edl_items
-- La migration 032 a supprimé "EDL items: écriture authentifié" (FOR ALL) en supposant
-- que edl_items_insert_admin_or_cohote existait déjà (créée dans le dashboard).
-- Si cette policy n'existe pas en production, aucune INSERT n'est autorisée → 400.

SET search_path TO public;

DROP POLICY IF EXISTS edl_items_insert_admin_or_cohote ON public.edl_items;
DROP POLICY IF EXISTS "EDL items: écriture authentifié" ON public.edl_items;

CREATE POLICY edl_items_insert_admin_or_cohote ON public.edl_items
  FOR INSERT WITH CHECK (
    (select auth.uid()) IS NOT NULL
  );

NOTIFY pgrst, 'reload schema';
