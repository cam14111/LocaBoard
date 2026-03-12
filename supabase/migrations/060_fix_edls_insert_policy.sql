-- 060 : Fix INSERT policy sur edls
-- La policy edls_insert_admin_or_cohote existe uniquement dans le dashboard
-- et n'est pas reproductible par les migrations. On la recrée explicitement.

SET search_path TO public;

-- Supprimer toute policy INSERT existante sur edls pour repartir propre
DROP POLICY IF EXISTS edls_insert_admin_or_cohote ON public.edls;
DROP POLICY IF EXISTS "EDL: écriture authentifié" ON public.edls;
DROP POLICY IF EXISTS edls_insert ON public.edls;

-- Créer la policy INSERT : tout utilisateur authentifié peut créer un EDL
CREATE POLICY edls_insert ON public.edls
  FOR INSERT WITH CHECK (
    (select auth.uid()) IS NOT NULL
  );

-- S'assurer que authenticated a le GRANT INSERT
GRANT INSERT ON public.edls TO authenticated;

-- Recharger le schéma PostgREST
NOTIFY pgrst, 'reload schema';
