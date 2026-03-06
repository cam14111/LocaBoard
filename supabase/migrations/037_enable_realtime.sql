-- Activer Supabase Realtime sur les tables à synchronisation temps réel
ALTER PUBLICATION supabase_realtime ADD TABLE notifications;
ALTER PUBLICATION supabase_realtime ADD TABLE taches;
ALTER PUBLICATION supabase_realtime ADD TABLE dossiers;
