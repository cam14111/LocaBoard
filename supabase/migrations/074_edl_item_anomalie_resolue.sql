-- 074 : Ajout de la valeur ANOMALIE_RESOLUE à l'enum edl_item_etat
-- Doit être dans une transaction séparée (commit) avant usage dans 075.

ALTER TYPE edl_item_etat ADD VALUE IF NOT EXISTS 'ANOMALIE_RESOLUE';

-- Refresh PostgREST schema cache
NOTIFY pgrst, 'reload schema';
