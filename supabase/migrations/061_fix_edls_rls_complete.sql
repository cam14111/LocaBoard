-- 061 : Restaurer les policies RLS complètes sur edls
-- Migration 032 a supprimé "EDL: écriture authentifié" (FOR ALL) en supposant
-- que 4 policies granulaires existaient dans le dashboard — elles n'existent pas
-- dans les migrations. On recrée une policy FOR ALL complète.

SET search_path TO public;

-- Supprimer toutes les policies existantes sur edls pour repartir propre
DROP POLICY IF EXISTS "EDL: lecture authentifié" ON public.edls;
DROP POLICY IF EXISTS "EDL: écriture authentifié" ON public.edls;
DROP POLICY IF EXISTS edls_insert_admin_or_cohote ON public.edls;
DROP POLICY IF EXISTS edls_update_admin_or_cohote ON public.edls;
DROP POLICY IF EXISTS edls_delete_admin_only ON public.edls;
DROP POLICY IF EXISTS edls_select_access ON public.edls;
DROP POLICY IF EXISTS edls_select ON public.edls;
DROP POLICY IF EXISTS edls_insert ON public.edls;

-- Policy unique FOR ALL : tout utilisateur authentifié
CREATE POLICY edls_authenticated ON public.edls
  FOR ALL
  USING  ((select auth.uid()) IS NOT NULL)
  WITH CHECK ((select auth.uid()) IS NOT NULL);

-- S'assurer que authenticated a tous les droits nécessaires
GRANT SELECT, INSERT, UPDATE, DELETE ON public.edls TO authenticated;

NOTIFY pgrst, 'reload schema';
