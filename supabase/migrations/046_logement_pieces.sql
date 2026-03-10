-- 046 : Structure des pièces pour EDL dans le logement
-- Ajoute nb_chambres / nb_salles_de_bain sur logements
-- Crée la table logement_pieces pour configurer les pièces de l'EDL

-- ─── Nouvelles colonnes logements ─────────────────────────────
ALTER TABLE logements ADD COLUMN IF NOT EXISTS nb_chambres INTEGER NOT NULL DEFAULT 0;
ALTER TABLE logements ADD COLUMN IF NOT EXISTS nb_salles_de_bain INTEGER NOT NULL DEFAULT 0;

-- ─── Table logement_pieces ────────────────────────────────────
CREATE TABLE logement_pieces (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  logement_id UUID NOT NULL REFERENCES logements(id) ON DELETE CASCADE,
  nom TEXT NOT NULL,
  type_piece TEXT NOT NULL DEFAULT 'AUTRE',
  ordre INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

COMMENT ON COLUMN logement_pieces.type_piece IS 'CUISINE | SEJOUR | CHAMBRE | SALLE_DE_BAIN | ENTREE | TERRASSE | WC | AUTRE';

CREATE INDEX idx_logement_pieces_logement ON logement_pieces(logement_id, ordre);

-- ─── RLS ──────────────────────────────────────────────────────
ALTER TABLE logement_pieces ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Pieces: lecture authentifié" ON logement_pieces
  FOR SELECT USING (auth.uid() IS NOT NULL);

CREATE POLICY "Pieces: admin write" ON logement_pieces
  FOR ALL USING (get_user_role() = 'ADMIN');
