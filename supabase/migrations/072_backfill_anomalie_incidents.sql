-- 072 : Backfill incidents + tâches pour les anomalies EDL existantes
-- Pour chaque edl_item avec etat='ANOMALIE' sans incident lié,
-- crée un incident squelette OUVERT + une tâche MAINTENANCE.
-- Idempotent : le NOT EXISTS garantit qu'aucun doublon n'est créé.

DO $$
DECLARE
  r_item    RECORD;
  v_edl     RECORD;
  v_dos     RECORD;
  v_inc_id  UUID;
  v_desc    TEXT;
BEGIN
  FOR r_item IN
    SELECT ei.id, ei.edl_id, ei.checklist_item_label
      FROM edl_items ei
     WHERE ei.etat = 'ANOMALIE'
       AND NOT EXISTS (
         SELECT 1 FROM incidents i WHERE i.edl_item_id = ei.id
       )
     ORDER BY ei.id
  LOOP
    SELECT id, dossier_id INTO v_edl FROM edls WHERE id = r_item.edl_id;
    IF NOT FOUND THEN CONTINUE; END IF;

    SELECT id, logement_id INTO v_dos FROM dossiers WHERE id = v_edl.dossier_id;
    IF NOT FOUND THEN CONTINUE; END IF;

    v_desc := 'Anomalie : ' || r_item.checklist_item_label;

    INSERT INTO incidents (
      edl_id, dossier_id, description, severite, statut,
      created_by_user_id, edl_item_id
    ) VALUES (
      r_item.edl_id,
      v_edl.dossier_id,
      v_desc,
      'MINEUR'::incident_severite,
      'OUVERT'::incident_statut,
      NULL,
      r_item.id
    )
    RETURNING id INTO v_inc_id;

    INSERT INTO taches (
      logement_id, dossier_id, titre, description,
      type, statut, echeance_at, auto_generated, incident_id
    ) VALUES (
      v_dos.logement_id,
      v_edl.dossier_id,
      LEFT('Incident EDL : ' || v_desc, 120),
      v_desc,
      'MAINTENANCE'::tache_type,
      'A_FAIRE'::tache_statut,
      NOW() + INTERVAL '7 days',
      true,
      v_inc_id
    );

  END LOOP;
END;
$$;

-- Refresh PostgREST schema cache
NOTIFY pgrst, 'reload schema';
