-- Fix: ajout explicite de WITH CHECK pour les politiques INSERT sur edls et edl_items.
-- La table s'appelle "edls" (pluriel) dans la base de production.
-- FOR ALL USING sans WITH CHECK peut bloquer les INSERT dans certaines versions de Supabase/PostgREST.

SET search_path TO public;

DROP POLICY IF EXISTS "EDL: écriture authentifié" ON public.edls;
CREATE POLICY "EDL: écriture authentifié" ON public.edls
  FOR ALL USING (auth.uid() IS NOT NULL)
  WITH CHECK (auth.uid() IS NOT NULL);

DROP POLICY IF EXISTS "EDL items: écriture authentifié" ON public.edl_items;
CREATE POLICY "EDL items: écriture authentifié" ON public.edl_items
  FOR ALL USING (auth.uid() IS NOT NULL)
  WITH CHECK (auth.uid() IS NOT NULL);
