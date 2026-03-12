-- 059 : Rendre edl_items.etat nullable et supprimer tout DEFAULT
-- Les items générés depuis les pièces ne doivent pas avoir de statut par défaut.
ALTER TABLE public.edl_items ALTER COLUMN etat DROP NOT NULL;
ALTER TABLE public.edl_items ALTER COLUMN etat DROP DEFAULT;
