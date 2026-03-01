-- Migration 028 : Ajout ville et signature pour la génération de contrats
-- - ville : ville du bailleur, utilisée dans "Fait à [ville], le [date]"
-- - signature_url : chemin storage de l'image de signature du bailleur

SET search_path TO public;

ALTER TABLE public.users ADD COLUMN IF NOT EXISTS ville text;
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS signature_url text;
