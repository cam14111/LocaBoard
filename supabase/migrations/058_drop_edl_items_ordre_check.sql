-- Supprime la contrainte CHECK sur edl_items.ordre qui empêche l'insertion
-- avec ordre = 0 (notre convention est ordre >= 0, 0-based indexing).
-- Cette contrainte avait été ajoutée hors migrations et n'est pas justifiée.

ALTER TABLE public.edl_items
  DROP CONSTRAINT IF EXISTS edl_items_ordre_check;
