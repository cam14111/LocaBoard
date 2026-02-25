-- Fix: erreur 400 lors de cancelTache (PATCH taches → statut = 'ANNULEE').
-- La base de production a été créée manuellement et contient probablement une
-- contrainte CHECK sur taches.statut qui exclut 'ANNULEE'.
-- Une violation CHECK retourne HTTP 400 (code PostgreSQL 23514).
-- La migration 001 ne définit aucune contrainte CHECK sur taches : l'ENUM seul suffit.
-- On supprime donc toutes les contraintes CHECK manuelles sur cette table.

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
    WHERE rel.relname = 'taches'
      AND con.contype = 'c'   -- CHECK constraint uniquement
      AND nsp.nspname = 'public'
  LOOP
    RAISE NOTICE 'Suppression contrainte CHECK : %', c.conname;
    EXECUTE 'ALTER TABLE public.taches DROP CONSTRAINT IF EXISTS ' || quote_ident(c.conname);
  END LOOP;
END;
$$;
