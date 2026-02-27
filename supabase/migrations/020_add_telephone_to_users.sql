SET search_path TO public;

-- Ajout du champ téléphone sur la table users (profil hôte/bailleur)
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS telephone text;
