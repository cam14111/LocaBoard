-- 075 : Utilisation de ANOMALIE_RESOLUE (commit de 074 requis en amont)
--       + backfill items NULL → ANOMALIE_RESOLUE
--       + mise à jour des RPCs resolve_incident / reopen_incident

-- ─── 1. Backfill : items remis à NULL par la migration 073 ───────
UPDATE edl_items ei
   SET etat = 'ANOMALIE_RESOLUE'::edl_item_etat
 WHERE ei.etat IS NULL
   AND EXISTS (
     SELECT 1 FROM incidents i
      WHERE i.edl_item_id = ei.id
        AND i.statut = 'RESOLU'::incident_statut
   );

-- ─── 2. resolve_incident : ANOMALIE → ANOMALIE_RESOLUE ───────────
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

  SELECT edl_item_id INTO v_edl_item_id
    FROM incidents
   WHERE id = p_incident_id;

  UPDATE incidents
     SET statut = 'RESOLU'::incident_statut
   WHERE id = p_incident_id
     AND statut = 'OUVERT'::incident_statut;

  -- Marquer l'item comme anomalie résolue (garde la trace)
  IF v_edl_item_id IS NOT NULL THEN
    UPDATE edl_items
       SET etat = 'ANOMALIE_RESOLUE'::edl_item_etat
     WHERE id = v_edl_item_id
       AND etat = 'ANOMALIE'::edl_item_etat;
  END IF;
END;
$$;

GRANT EXECUTE ON FUNCTION resolve_incident(UUID) TO authenticated;

-- ─── 3. reopen_incident : ANOMALIE_RESOLUE → ANOMALIE ────────────
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

  -- Remettre l'item en ANOMALIE active
  IF v_edl_item_id IS NOT NULL THEN
    UPDATE edl_items
       SET etat = 'ANOMALIE'::edl_item_etat
     WHERE id = v_edl_item_id
       AND etat = 'ANOMALIE_RESOLUE'::edl_item_etat;
  END IF;
END;
$$;

GRANT EXECUTE ON FUNCTION reopen_incident(UUID) TO authenticated;

-- Refresh PostgREST schema cache
NOTIFY pgrst, 'reload schema';
