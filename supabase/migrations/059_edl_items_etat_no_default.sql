-- 059 : Supprimer tout DEFAULT sur edl_items.etat
-- Les items générés depuis les pièces ne doivent pas avoir de statut par défaut.
ALTER TABLE public.edl_items ALTER COLUMN etat DROP DEFAULT;
