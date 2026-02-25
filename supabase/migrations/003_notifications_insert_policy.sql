-- Migration 003 : Ajout policy INSERT pour les notifications
-- Permet aux utilisateurs authentifiés de créer des notifications (sweeps côté client)

CREATE POLICY "Notifications: insert authentifié" ON notifications
  FOR INSERT WITH CHECK (auth.uid() IS NOT NULL);
