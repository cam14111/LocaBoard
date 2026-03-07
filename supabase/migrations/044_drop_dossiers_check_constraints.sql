-- Fix: erreur 400 lors de PATCH dossiers → pipeline_statut = 'EDL_ENTREE_OK'/'EDL_ENTREE_INCIDENT'.
-- La base de production a été créée manuellement et contient une contrainte CHECK sur
-- dossiers.pipeline_statut qui exclut les valeurs ajoutées dans la migration 016.
-- Une violation CHECK retourne HTTP 400 (code PostgreSQL 23514).
-- Même problème que pour taches.statut (migration 011).
-- On supprime toutes les contraintes CHECK manuelles sur dossiers.

SET search_path TO public;

DO $$
DECLARE
  c RECORD;
BEGIN
  FOR c IN
    SELECT con.conname
    FROM pg_constraint con
    JOIN pg_class rel ON rel.oid = con.conrelid
    JOIN pg_namespace nsp ON nsp.oid = rel.relnamespace
    WHERE rel.relname = 'dossiers'
      AND con.contype = 'c'   -- CHECK constraint uniquement
      AND nsp.nspname = 'public'
  LOOP
    RAISE NOTICE 'Suppression contrainte CHECK : %', c.conname;
    EXECUTE 'ALTER TABLE public.dossiers DROP CONSTRAINT IF EXISTS ' || quote_ident(c.conname);
  END LOOP;
END;
$$;
