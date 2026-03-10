-- 048 : Tarifs saisonniers par logement
-- 3 saisons : Basse, Haute, Très haute
-- Périodes au format MM-DD pour cyclicité annuelle

CREATE TABLE logement_saisons (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  logement_id UUID NOT NULL REFERENCES logements(id) ON DELETE CASCADE,
  nom_saison TEXT NOT NULL,
  loyer_nuit NUMERIC NOT NULL CHECK (loyer_nuit >= 0),
  loyer_semaine NUMERIC CHECK (loyer_semaine IS NULL OR loyer_semaine >= 0),
  date_debut TEXT NOT NULL,
  date_fin TEXT NOT NULL,
  ordre INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

COMMENT ON COLUMN logement_saisons.date_debut IS 'Format MM-DD (ex: 10-15 pour le 15 octobre)';
COMMENT ON COLUMN logement_saisons.date_fin IS 'Format MM-DD (ex: 04-15 pour le 15 avril)';
COMMENT ON COLUMN logement_saisons.nom_saison IS 'Basse saison | Haute saison | Très haute saison';

CREATE INDEX idx_logement_saisons_logement ON logement_saisons(logement_id, ordre);

-- ─── RLS ──────────────────────────────────────────────────────
ALTER TABLE logement_saisons ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Saisons: lecture authentifié" ON logement_saisons
  FOR SELECT USING (auth.uid() IS NOT NULL);

CREATE POLICY "Saisons: admin write" ON logement_saisons
  FOR ALL USING (get_user_role() = 'ADMIN');

-- ─── Trigger updated_at ───────────────────────────────────────
CREATE TRIGGER set_logement_saisons_updated_at
  BEFORE UPDATE ON logement_saisons
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at();
