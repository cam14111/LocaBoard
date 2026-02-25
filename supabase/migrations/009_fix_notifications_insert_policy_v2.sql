-- Fix: la politique INSERT sur notifications créée en 008 était trop restrictive.
-- Elle bloquait l'insertion pour un autre user_id (ex: notifier un co-hôte assigné).
-- On remplace par une policy qui exige seulement d'être authentifié.

SET search_path TO public;

DROP POLICY IF EXISTS "Notifications: insertion authentifié" ON public.notifications;

CREATE POLICY "Notifications: insertion authentifié" ON public.notifications
  FOR INSERT WITH CHECK (auth.uid() IS NOT NULL);
