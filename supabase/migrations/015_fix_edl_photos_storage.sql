-- Fix: bucket edl-photos et politiques Storage manquants ou mal configurés.
-- Un 400 sur POST /storage/v1/object/edl-photos/... indique soit que le bucket
-- n'existe pas, soit que la politique INSERT est absente ou incorrecte.

-- ─── 1. Créer le bucket s'il n'existe pas ──────────────────────────────────

INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'edl-photos',
  'edl-photos',
  true,
  10485760,    -- 10 MB max par fichier
  ARRAY['image/jpeg', 'image/jpg', 'image/png', 'image/webp', 'image/heic', 'image/heif']
)
ON CONFLICT (id) DO UPDATE SET
  public             = true,
  file_size_limit    = 10485760,
  allowed_mime_types = ARRAY['image/jpeg', 'image/jpg', 'image/png', 'image/webp', 'image/heic', 'image/heif'];

-- ─── 2. Recréer les politiques Storage (idempotent) ────────────────────────

DROP POLICY IF EXISTS "EDL photos: upload authentifié"  ON storage.objects;
DROP POLICY IF EXISTS "EDL photos: lecture publique"    ON storage.objects;
DROP POLICY IF EXISTS "EDL photos: suppression authentifié" ON storage.objects;
DROP POLICY IF EXISTS "EDL photos: update authentifié"  ON storage.objects;

-- INSERT : tout utilisateur authentifié peut uploader
CREATE POLICY "EDL photos: upload authentifié"
  ON storage.objects FOR INSERT
  WITH CHECK (
    bucket_id = 'edl-photos'
    AND auth.uid() IS NOT NULL
  );

-- UPDATE (upsert) : même condition
CREATE POLICY "EDL photos: update authentifié"
  ON storage.objects FOR UPDATE
  USING (
    bucket_id = 'edl-photos'
    AND auth.uid() IS NOT NULL
  );

-- SELECT : lecture publique (affichage inline des photos)
CREATE POLICY "EDL photos: lecture publique"
  ON storage.objects FOR SELECT
  USING (bucket_id = 'edl-photos');

-- DELETE : tout utilisateur authentifié peut supprimer
CREATE POLICY "EDL photos: suppression authentifié"
  ON storage.objects FOR DELETE
  USING (
    bucket_id = 'edl-photos'
    AND auth.uid() IS NOT NULL
  );
