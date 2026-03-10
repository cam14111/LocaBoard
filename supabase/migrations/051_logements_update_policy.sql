-- Migration 051 : Ajouter une policy UPDATE explicite pour les logements (archivage)
--
-- Contexte :
--   L'archivage d'un logement fait un PATCH (UPDATE) sur la colonne archived_at.
--   La policy "Logements: admin write" (FOR ALL) du schéma initial semble ne plus
--   couvrir les UPDATE, vraisemblablement supprimée lors du refactoring des policies.
--   Résultat : erreur 403 "new row violates row-level security policy".
--
-- Solution :
--   Ajouter explicitement les policies INSERT/UPDATE/DELETE pour l'ADMIN.
--   Avec WITH CHECK sans contrainte archived_at pour permettre l'archivage (set archived_at).

SET search_path TO public;

-- Nettoyer d'éventuelles policies ALL ou UPDATE/INSERT/DELETE qui traîneraient
DROP POLICY IF EXISTS "Logements: admin write"  ON logements;
DROP POLICY IF EXISTS "Logements: admin insert" ON logements;
DROP POLICY IF EXISTS "Logements: admin update" ON logements;
DROP POLICY IF EXISTS "Logements: admin delete" ON logements;

-- INSERT : admin uniquement
CREATE POLICY "Logements: admin insert" ON logements
  FOR INSERT WITH CHECK ((SELECT get_user_role()) = 'ADMIN');

-- UPDATE : admin uniquement
-- USING  : la ligne doit exister (pas de filtre archived_at pour permettre de ré-activer)
-- WITH CHECK : pas de contrainte archived_at pour permettre l'archivage (set archived_at)
CREATE POLICY "Logements: admin update" ON logements
  FOR UPDATE
  USING  ((SELECT get_user_role()) = 'ADMIN')
  WITH CHECK ((SELECT get_user_role()) = 'ADMIN');

-- DELETE : admin uniquement (soft-delete via archived_at préféré, mais on sécurise)
CREATE POLICY "Logements: admin delete" ON logements
  FOR DELETE USING ((SELECT get_user_role()) = 'ADMIN');

NOTIFY pgrst, 'reload schema';
