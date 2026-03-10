-- Migration 050 : Activer Realtime sur la table logements
--
-- Contexte :
--   La migration 049 a ajouté une subscription Realtime dans LogementContext.tsx.
--   Pour que les events postgres_changes soient émis, la table doit être ajoutée
--   à la publication supabase_realtime.
--
-- Sans cette migration, le channel Realtime ne reçoit aucun événement
-- et le LogementContext ne se rafraîchit pas automatiquement.

ALTER PUBLICATION supabase_realtime ADD TABLE logements;
