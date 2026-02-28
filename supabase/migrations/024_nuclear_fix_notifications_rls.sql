-- FIX NUCLÉAIRE : supprime TOUTES les policies sur notifications
-- et recrée uniquement celles nécessaires.
-- L'historique des migrations a créé des policies avec des noms variants
-- qui se chevauchent ou se bloquent.

SET search_path TO public;

-- Supprimer TOUTES les policies connues (tous noms variants)
DROP POLICY IF EXISTS "Notifications: insert authentifié" ON public.notifications;
DROP POLICY IF EXISTS "Notifications: insertion authentifié" ON public.notifications;
DROP POLICY IF EXISTS "Notifications: insert pour tout authentifié" ON public.notifications;
DROP POLICY IF EXISTS "Notifications: lecture propres" ON public.notifications;
DROP POLICY IF EXISTS "Notifications: update propres" ON public.notifications;
DROP POLICY IF EXISTS "Notifications: delete propres" ON public.notifications;
DROP POLICY IF EXISTS "notifications_insert_admin_or_self" ON public.notifications;
DROP POLICY IF EXISTS "notifications_insert_system_only" ON public.notifications;

-- Recréer les policies proprement
-- SELECT : chaque user ne voit que ses propres notifications
CREATE POLICY "notif_select_own" ON public.notifications
  FOR SELECT USING (user_id = auth.uid());

-- INSERT : tout utilisateur authentifié peut insérer (même pour un autre user_id)
-- Nécessaire pour : admin assigne tâche → notifie le co-hôte
CREATE POLICY "notif_insert_authenticated" ON public.notifications
  FOR INSERT WITH CHECK (auth.uid() IS NOT NULL);

-- UPDATE : chaque user peut modifier ses propres notifications (mark as read)
CREATE POLICY "notif_update_own" ON public.notifications
  FOR UPDATE USING (user_id = auth.uid());

-- DELETE : chaque user peut supprimer ses propres notifications
CREATE POLICY "notif_delete_own" ON public.notifications
  FOR DELETE USING (user_id = auth.uid());

-- Forcer le rechargement du schema cache PostgREST
NOTIFY pgrst, 'reload schema';
