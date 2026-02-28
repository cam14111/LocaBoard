-- Fonction SECURITY DEFINER pour créer des notifications cross-user.
-- Contourne le RLS : un admin peut notifier un co-hôte sans être bloqué.
-- Inclut le dédoublonnage (même type + entity_id non-lue → skip).

CREATE OR REPLACE FUNCTION create_notification(
  p_user_id UUID,
  p_type notification_type,
  p_titre TEXT,
  p_message TEXT,
  p_entity_type TEXT DEFAULT NULL,
  p_entity_id TEXT DEFAULT NULL
) RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_existing_count INTEGER;
  v_new_id UUID;
BEGIN
  -- Dédoublonnage : même type + entity_id non-lue → skip
  IF p_entity_id IS NOT NULL THEN
    SELECT COUNT(*) INTO v_existing_count
    FROM notifications
    WHERE user_id = p_user_id
      AND type = p_type
      AND entity_id = p_entity_id
      AND read_at IS NULL;

    IF v_existing_count > 0 THEN
      RETURN NULL;
    END IF;
  END IF;

  INSERT INTO notifications (user_id, type, titre, message, entity_type, entity_id)
  VALUES (p_user_id, p_type, p_titre, p_message, p_entity_type, p_entity_id)
  RETURNING id INTO v_new_id;

  RETURN v_new_id;
END;
$$;
