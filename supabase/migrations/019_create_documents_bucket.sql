-- Migration 019 : Bucket Storage pour les documents de dossier (contrats, preuves paiement, etc.)
INSERT INTO storage.buckets (id, name, public)
VALUES ('documents', 'documents', false)
ON CONFLICT (id) DO NOTHING;

-- Upload : utilisateur authentifié uniquement
CREATE POLICY "Documents: upload authentifié"
  ON storage.objects FOR INSERT
  WITH CHECK (bucket_id = 'documents' AND auth.uid() IS NOT NULL);

-- Lecture : utilisateur authentifié uniquement
CREATE POLICY "Documents: lecture authentifiée"
  ON storage.objects FOR SELECT
  USING (bucket_id = 'documents' AND auth.uid() IS NOT NULL);

-- Mise à jour : utilisateur authentifié
CREATE POLICY "Documents: mise à jour authentifiée"
  ON storage.objects FOR UPDATE
  USING (bucket_id = 'documents' AND auth.uid() IS NOT NULL);

-- Suppression : utilisateur authentifié
CREATE POLICY "Documents: suppression authentifiée"
  ON storage.objects FOR DELETE
  USING (bucket_id = 'documents' AND auth.uid() IS NOT NULL);
