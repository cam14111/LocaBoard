-- 073 : resolve_incident efface l'anomalie de l'item EDL lié
--       reopen_incident remet l'item en ANOMALIE si nécessaire

-- ─── resolve_incident ────────────────────────────────────────────
CREATE OR REPLACE FUNCTION resolve_incident(p_incident_id UUID)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_edl_item_id UUID;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'UNAUTHENTICATED';
  END IF;

  -- Récupérer l'edl_item_id avant la mise à jour
  SELECT edl_item_id INTO v_edl_item_id
    FROM incidents
   WHERE id = p_incident_id;

  UPDATE incidents
     SET statut = 'RESOLU'::incident_statut
   WHERE id = p_incident_id
     AND statut = 'OUVERT'::incident_statut;

  -- Si l'incident était lié à un item EDL, effacer le marquage ANOMALIE
  IF v_edl_item_id IS NOT NULL THEN
    UPDATE edl_items
       SET etat = NULL
     WHERE id = v_edl_item_id
       AND etat = 'ANOMALIE'::edl_item_etat;
  END IF;
END;
$$;

GRANT EXECUTE ON FUNCTION resolve_incident(UUID) TO authenticated;

-- ─── reopen_incident ─────────────────────────────────────────────
CREATE OR REPLACE FUNCTION reopen_incident(p_incident_id UUID)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_edl_item_id UUID;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'UNAUTHENTICATED';
  END IF;

  SELECT edl_item_id INTO v_edl_item_id
    FROM incidents
   WHERE id = p_incident_id;

  UPDATE incidents
     SET statut = 'OUVERT'::incident_statut
   WHERE id = p_incident_id
     AND statut = 'RESOLU'::incident_statut;

  -- Remettre l'item en ANOMALIE si l'incident est réouvert
  IF v_edl_item_id IS NOT NULL THEN
    UPDATE edl_items
       SET etat = 'ANOMALIE'::edl_item_etat
     WHERE id = v_edl_item_id
       AND etat IS NULL;
  END IF;
END;
$$;

GRANT EXECUTE ON FUNCTION reopen_incident(UUID) TO authenticated;

-- Refresh PostgREST schema cache
NOTIFY pgrst, 'reload schema';
