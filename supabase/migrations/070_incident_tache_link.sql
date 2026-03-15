-- 070 : Liaison incidents EDL ↔ tâches
-- - Enum incident_statut (OUVERT, RESOLU)
-- - Colonne statut sur incidents
-- - Colonne incident_id (FK, UNIQUE) sur taches
-- - RPCs SECURITY DEFINER : create_tache_for_incident, resolve_incident, reopen_incident

-- ─── 1. Enum + colonne statut sur incidents ─────────────────────
CREATE TYPE incident_statut AS ENUM ('OUVERT', 'RESOLU');

ALTER TABLE incidents
  ADD COLUMN statut incident_statut NOT NULL DEFAULT 'OUVERT';

CREATE INDEX idx_incidents_statut ON incidents (statut);

-- ─── 2. FK incident_id sur taches (1:1, nullable) ──────────────
ALTER TABLE taches
  ADD COLUMN incident_id UUID REFERENCES incidents(id) ON DELETE SET NULL;

CREATE UNIQUE INDEX idx_taches_incident_id
  ON taches (incident_id) WHERE incident_id IS NOT NULL;

-- ─── 3. RPC create_tache_for_incident ───────────────────────────
CREATE OR REPLACE FUNCTION create_tache_for_incident(p_incident_id UUID)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_incident RECORD;
  v_dossier  RECORD;
  v_tache_id UUID;
BEGIN
  -- Auth check
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'UNAUTHENTICATED';
  END IF;

  -- Fetch incident
  SELECT id, dossier_id, description, created_at
    INTO v_incident
    FROM incidents
   WHERE id = p_incident_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Incident not found: %', p_incident_id;
  END IF;

  -- Fetch dossier for logement_id
  SELECT id, logement_id
    INTO v_dossier
    FROM dossiers
   WHERE id = v_incident.dossier_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Dossier not found: %', v_incident.dossier_id;
  END IF;

  -- Idempotency: skip if task already exists for this incident
  SELECT id INTO v_tache_id
    FROM taches
   WHERE incident_id = p_incident_id;

  IF FOUND THEN
    RETURN v_tache_id;
  END IF;

  -- Create the maintenance task
  INSERT INTO taches (
    logement_id, dossier_id, titre, description,
    type, statut, echeance_at, auto_generated, incident_id
  ) VALUES (
    v_dossier.logement_id,
    v_incident.dossier_id,
    'Incident EDL : ' || LEFT(v_incident.description, 80),
    v_incident.description,
    'MAINTENANCE'::tache_type,
    'A_FAIRE'::tache_statut,
    v_incident.created_at + INTERVAL '7 days',
    true,
    p_incident_id
  )
  RETURNING id INTO v_tache_id;

  RETURN v_tache_id;
END;
$$;

GRANT EXECUTE ON FUNCTION create_tache_for_incident(UUID) TO authenticated;

-- ─── 4. RPC resolve_incident ────────────────────────────────────
CREATE OR REPLACE FUNCTION resolve_incident(p_incident_id UUID)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'UNAUTHENTICATED';
  END IF;

  UPDATE incidents
     SET statut = 'RESOLU'::incident_statut
   WHERE id = p_incident_id
     AND statut = 'OUVERT'::incident_statut;
END;
$$;

GRANT EXECUTE ON FUNCTION resolve_incident(UUID) TO authenticated;

-- ─── 5. RPC reopen_incident ─────────────────────────────────────
CREATE OR REPLACE FUNCTION reopen_incident(p_incident_id UUID)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'UNAUTHENTICATED';
  END IF;

  UPDATE incidents
     SET statut = 'OUVERT'::incident_statut
   WHERE id = p_incident_id
     AND statut = 'RESOLU'::incident_statut;
END;
$$;

GRANT EXECUTE ON FUNCTION reopen_incident(UUID) TO authenticated;

-- ─── 6. Refresh PostgREST schema cache ──────────────────────────
NOTIFY pgrst, 'reload schema';
