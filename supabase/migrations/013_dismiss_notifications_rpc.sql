-- Fonction RPC pour supprimer les notifications non-lues d'une entité.
-- Utilisée pour effacer automatiquement les alertes TACHE_EN_RETARD et
-- PAIEMENT_EN_RETARD quand la tâche/paiement est soldé ou modifié.
-- SECURITY DEFINER : bypasse les politiques RLS DELETE (non définies sur notifications).

SET search_path TO public;

CREATE OR REPLACE FUNCTION dismiss_notifications_for_entity(
  p_type        TEXT,
  p_entity_type TEXT,
  p_entity_id   UUID
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'UNAUTHENTICATED';
  END IF;

  DELETE FROM notifications
  WHERE type::TEXT     = p_type
    AND entity_type    = p_entity_type
    AND entity_id      = p_entity_id
    AND read_at IS NULL;  -- seulement les non-lues
END;
$$;

GRANT EXECUTE ON FUNCTION dismiss_notifications_for_entity(TEXT, TEXT, UUID) TO authenticated;

NOTIFY pgrst, 'reload schema';
