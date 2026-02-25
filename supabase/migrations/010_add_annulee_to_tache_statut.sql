-- Fix: la valeur 'ANNULEE' manque dans l'ENUM tache_statut en production.
-- La base a été créée manuellement avec un ENUM incomplet.
-- Sans cette valeur : cancelTache échoue avec 400 Bad Request (invalid input value for enum).

SET search_path TO public;

ALTER TYPE tache_statut ADD VALUE IF NOT EXISTS 'ANNULEE';
