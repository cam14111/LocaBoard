-- Fix: politique INSERT manquante sur notifications.
-- Sans elle : createNotification échoue avec 403 (Forbidden).
-- Les notifications peuvent être créées pour n'importe quel utilisateur
-- (ex: notifier un co-hôte assigné à une tâche), donc seule l'authentification est requise.

SET search_path TO public;

DROP POLICY IF EXISTS "Notifications: insertion authentifié" ON public.notifications;

CREATE POLICY "Notifications: insertion authentifié" ON public.notifications
  FOR INSERT WITH CHECK (auth.uid() IS NOT NULL);
