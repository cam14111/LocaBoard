-- Fix: la colonne loyer_total manque dans reservations en production.
-- La table a été créée sans cette colonne (contrairement au schéma cible dans 001_schema.sql).
-- Sans elle : création de réservation échoue, calcul des paiements impossible, affichage du loyer impossible.

SET search_path TO public;

ALTER TABLE public.reservations
  ADD COLUMN IF NOT EXISTS loyer_total NUMERIC;
