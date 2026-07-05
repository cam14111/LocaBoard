-- 076 — Durcissement : retirer l'accès EXECUTE du rôle anon (non authentifié)
-- sur les fonctions du schéma public.
--
-- Contexte : l'advisor sécurité Supabase signale que le rôle `anon` peut
-- exécuter les fonctions SECURITY DEFINER (ex. admin_set_logement_access) via
-- /rest/v1/rpc/*. L'application n'appelle AUCUNE fonction publique avant
-- authentification (le login passe par GoTrue, le partage de documents passe
-- par l'edge function `doc-redirect` en service_role). anon n'a donc besoin
-- d'aucune fonction du schéma public.
--
-- Effet : seuls `authenticated` et `service_role` conservent EXECUTE.
-- Réversible : GRANT EXECUTE ON ALL FUNCTIONS IN SCHEMA public TO anon;

REVOKE EXECUTE ON ALL FUNCTIONS IN SCHEMA public FROM anon;
REVOKE EXECUTE ON ALL FUNCTIONS IN SCHEMA public FROM PUBLIC;

GRANT EXECUTE ON ALL FUNCTIONS IN SCHEMA public TO authenticated;
GRANT EXECUTE ON ALL FUNCTIONS IN SCHEMA public TO service_role;

-- Nouvelles fonctions créées par la suite : pas de grant implicite à anon.
ALTER DEFAULT PRIVILEGES IN SCHEMA public REVOKE EXECUTE ON FUNCTIONS FROM anon;
ALTER DEFAULT PRIVILEGES IN SCHEMA public REVOKE EXECUTE ON FUNCTIONS FROM PUBLIC;
