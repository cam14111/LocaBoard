-- 071 : Liaison items EDL (anomalies) → incidents → tâches
-- - FK edl_item_id sur incidents (1:1, nullable)
-- - RPC create_incident_for_edl_item : crée incident + tâche quand item = ANOMALIE
-- - RPC cleanup_incident_for_edl_item : annule tâche + résout incident quand item = OK

-- ─── 1. FK edl_item_id sur incidents ────────────────────────────
ALTER TABLE incidents
  ADD COLUMN edl_item_id UUID REFERENCES edl_items(id) ON DELETE SET NULL;

CREATE UNIQUE INDEX idx_incidents_edl_item_id
  ON incidents (edl_item_id) WHERE edl_item_id IS NOT NULL;

-- ─── 2. RPC create_incident_for_edl_item ────────────────────────
CREATE OR REPLACE FUNCTION create_incident_for_edl_item(p_edl_item_id UUID)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_item        RECORD;
  v_edl         RECORD;
  v_dossier     RECORD;
  v_incident_id UUID;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'UNAUTHENTICATED';
  END IF;

  -- Idempotency : retourne l'incident existant si déjà créé pour cet item
  SELECT id INTO v_incident_id
    FROM incidents
   WHERE edl_item_id = p_edl_item_id;

  IF FOUND THEN
    RETURN v_incident_id;
  END IF;

  -- Fetch item
  SELECT id, edl_id, checklist_item_label
    INTO v_item
    FROM edl_items
   WHERE id = p_edl_item_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'EDL item not found: %', p_edl_item_id;
  END IF;

  -- Fetch edl
  SELECT id, dossier_id
    INTO v_edl
    FROM edl
   WHERE id = v_item.edl_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'EDL not found: %', v_item.edl_id;
  END IF;

  -- Fetch dossier
  SELECT id, logement_id
    INTO v_dossier
    FROM dossiers
   WHERE id = v_edl.dossier_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Dossier not found: %', v_edl.dossier_id;
  END IF;

  -- Créer l'incident squelette
  INSERT INTO incidents (
    edl_id, dossier_id, description, severite, statut,
    created_by_user_id, edl_item_id
  ) VALUES (
    v_item.edl_id,
    v_edl.dossier_id,
    'Anomalie : ' || v_item.checklist_item_label,
    'MINEUR'::incident_severite,
    'OUVERT'::incident_statut,
    auth.uid(),
    p_edl_item_id
  )
  RETURNING id INTO v_incident_id;

  -- Déclenche la création de la tâche MAINTENANCE via le RPC existant
  PERFORM create_tache_for_incident(v_incident_id);

  RETURN v_incident_id;
END;
$$;

GRANT EXECUTE ON FUNCTION create_incident_for_edl_item(UUID) TO authenticated;

-- ─── 3. RPC cleanup_incident_for_edl_item ───────────────────────
CREATE OR REPLACE FUNCTION cleanup_incident_for_edl_item(p_edl_item_id UUID)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_incident_id UUID;
  v_tache_id    UUID;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'UNAUTHENTICATED';
  END IF;

  -- Chercher l'incident lié à cet item
  SELECT id INTO v_incident_id
    FROM incidents
   WHERE edl_item_id = p_edl_item_id;

  -- Pas d'incident → rien à faire
  IF NOT FOUND THEN RETURN; END IF;

  -- Annuler la tâche liée si encore active
  SELECT id INTO v_tache_id
    FROM taches
   WHERE incident_id = v_incident_id
     AND statut IN ('A_FAIRE'::tache_statut, 'EN_COURS'::tache_statut);

  IF FOUND THEN
    PERFORM cancel_tache(v_tache_id);
  END IF;

  -- Résoudre l'incident
  UPDATE incidents
     SET statut = 'RESOLU'::incident_statut
   WHERE id = v_incident_id
     AND statut = 'OUVERT'::incident_statut;
END;
$$;

GRANT EXECUTE ON FUNCTION cleanup_incident_for_edl_item(UUID) TO authenticated;

-- ─── 4. Refresh PostgREST schema cache ──────────────────────────
NOTIFY pgrst, 'reload schema';
