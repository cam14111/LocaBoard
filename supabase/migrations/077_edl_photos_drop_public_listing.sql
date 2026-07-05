-- 077 — Durcissement : retirer la politique de LISTING public sur edl-photos.
--
-- Contexte : l'advisor sécurité signale que le bucket public `edl-photos` a une
-- politique SELECT large (« EDL photos: lecture publique ») qui permet à
-- n'importe qui d'ÉNUMÉRER tous les fichiers du bucket via l'API storage.
--
-- L'application n'utilise jamais storage.list() sur ce bucket ; l'affichage des
-- photos passe par getPublicUrl() (chemin de service public d'un bucket public,
-- non soumis à RLS). Retirer cette politique n'affecte donc pas l'affichage des
-- images mais empêche l'énumération de l'ensemble des photos.
--
-- Réversible : recréer la politique
--   CREATE POLICY "EDL photos: lecture publique" ON storage.objects
--     FOR SELECT TO public USING (bucket_id = 'edl-photos');

DROP POLICY IF EXISTS "EDL photos: lecture publique" ON storage.objects;
