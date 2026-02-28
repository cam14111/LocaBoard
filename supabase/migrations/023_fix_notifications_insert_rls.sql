-- Fix: l'INSERT sur notifications échoue avec 42501 quand un admin crée
-- une notification pour un autre utilisateur (ex: tâche assignée à un co-hôte).
-- On supprime TOUTES les anciennes policies INSERT et on en recrée une propre.

SET search_path TO public;

DROP POLICY IF EXISTS "Notifications: insert authentifié" ON public.notifications;
DROP POLICY IF EXISTS "Notifications: insertion authentifié" ON public.notifications;

-- Tout utilisateur authentifié peut insérer une notification (même pour un autre user_id)
CREATE POLICY "Notifications: insert pour tout authentifié" ON public.notifications
  FOR INSERT WITH CHECK (auth.uid() IS NOT NULL);
