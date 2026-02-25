-- Migration 004 : Bucket Storage pour les photos EDL
-- E07-03 — Photos + commentaires par item EDL

-- Créer le bucket edl-photos (public pour affichage inline)
INSERT INTO storage.buckets (id, name, public)
VALUES ('edl-photos', 'edl-photos', true)
ON CONFLICT (id) DO NOTHING;

-- Politique : upload par utilisateur authentifié
CREATE POLICY "EDL photos: upload authentifié"
  ON storage.objects FOR INSERT
  WITH CHECK (bucket_id = 'edl-photos' AND auth.uid() IS NOT NULL);

-- Politique : lecture publique (les photos sont affichées inline)
CREATE POLICY "EDL photos: lecture publique"
  ON storage.objects FOR SELECT
  USING (bucket_id = 'edl-photos');

-- Politique : suppression par utilisateur authentifié
CREATE POLICY "EDL photos: suppression authentifié"
  ON storage.objects FOR DELETE
  USING (bucket_id = 'edl-photos' AND auth.uid() IS NOT NULL);
