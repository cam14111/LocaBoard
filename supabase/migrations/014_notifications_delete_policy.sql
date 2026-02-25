-- Politique RLS DELETE sur notifications.
-- Permet à un utilisateur de supprimer ses propres notifications (bouton X du panneau).

SET search_path TO public;

CREATE POLICY "Notifications: suppression propre" ON public.notifications
  FOR DELETE USING (user_id = auth.uid());
