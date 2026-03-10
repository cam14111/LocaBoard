-- 047 : Lien edl_items → logement_pieces pour traçabilité
-- piece_id est SET NULL si la pièce est supprimée (le label reste)

ALTER TABLE edl_items ADD COLUMN IF NOT EXISTS piece_id UUID REFERENCES logement_pieces(id) ON DELETE SET NULL;
