-- Migration 042 : Fusionner les policies SELECT redondantes sur logements
--
-- Contexte :
--   Supabase Performance Advisor signale 5 warnings "Multiple Permissive Policies"
--   sur public.logements car 3 policies SELECT coexistent pour le même rôle :
--     1. "Logements: lecture admin"              (migration 041)
--     2. "Logements: lecture cohote concierge"   (migration 041)
--     3. "logements_select_by_membership"        (ancienne migration)
--
--   PostgreSQL applique plusieurs policies permissives avec OR, ce qui empêche
--   l'optimiseur de choisir le meilleur plan d'exécution.
--
-- Solution :
--   Supprimer les 3 policies SELECT existantes et les remplacer par une seule.

SET search_path TO public;

-- Supprimer les policies SELECT existantes
DROP POLICY IF EXISTS "Logements: lecture admin"             ON logements;
DROP POLICY IF EXISTS "Logements: lecture cohote concierge" ON logements;
DROP POLICY IF EXISTS "logements_select_by_membership"      ON logements;

-- Policy unique fusionnée
CREATE POLICY "Logements: lecture" ON logements
  FOR SELECT USING (
    (SELECT auth.uid()) IS NOT NULL
    AND archived_at IS NULL
    AND (
      -- Admin : accès à tous les logements actifs
      (SELECT get_user_role()) = 'ADMIN'
      OR
      -- Co-hôte / Concierge : uniquement les logements dans logement_users
      (
        (SELECT get_user_role()) IN ('COHOTE', 'CONCIERGE')
        AND EXISTS (
          SELECT 1 FROM logement_users lu
          WHERE lu.user_id  = (SELECT auth.uid())
            AND lu.logement_id = logements.id
        )
      )
    )
  );

NOTIFY pgrst, 'reload schema';
