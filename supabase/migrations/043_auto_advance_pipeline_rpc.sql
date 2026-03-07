-- Migration 043 : RPC SECURITY DEFINER pour l'auto-avancement du pipeline.
--
-- PROBLÈME : la policy "Dossiers: admin write" restreint les UPDATE sur dossiers
-- aux seuls ADMIN. Les co-hôtes et concierges qui finalisent un EDL ou marquent
-- un paiement ne peuvent pas mettre à jour pipeline_statut directement.
--
-- SOLUTION : RPC SECURITY DEFINER qui s'exécute en tant que postgres (owner),
-- vérifie les droits en interne, applique l'avancement et insère le log d'audit.
-- Retourne TRUE si l'avancement a eu lieu, FALSE si le statut avait déjà changé
-- (évite les doubles-avances, pas d'erreur).
--
-- NOTE : utilise text pour les statuts pipeline (pas public.pipeline_statut)
-- car le type n'est pas accessible avec search_path = '' dans tous les contextes.

CREATE OR REPLACE FUNCTION auto_advance_pipeline(
  p_dossier_id  UUID,
  p_from_statut text,
  p_to_statut   text
)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_current_statut text;
  v_logement_id    UUID;
  v_role           text;
  v_has_access     BOOLEAN;
BEGIN
  -- 1. Récupérer le dossier
  SELECT pipeline_statut::text, logement_id
  INTO v_current_statut, v_logement_id
  FROM dossiers
  WHERE id = p_dossier_id;

  IF v_current_statut IS NULL THEN
    RAISE EXCEPTION 'Dossier introuvable : %', p_dossier_id;
  END IF;

  -- 2. Vérifier que l'appelant est authentifié et a accès au logement
  SELECT role::text INTO v_role
  FROM users
  WHERE id = auth.uid() AND archived_at IS NULL;

  IF v_role IS NULL THEN
    RAISE EXCEPTION 'FORBIDDEN: utilisateur non authentifié';
  END IF;

  IF v_role = 'ADMIN' THEN
    v_has_access := true;
  ELSE
    SELECT EXISTS(
      SELECT 1 FROM logement_users
      WHERE user_id = auth.uid()
        AND logement_id = v_logement_id
    ) INTO v_has_access;
  END IF;

  IF NOT v_has_access THEN
    RAISE EXCEPTION 'FORBIDDEN: accès refusé à ce dossier';
  END IF;

  -- 3. Vérification optimiste : si le statut a déjà changé, no-op sans erreur
  IF v_current_statut IS DISTINCT FROM p_from_statut THEN
    RETURN FALSE;
  END IF;

  -- 4. Avancer le pipeline
  UPDATE dossiers
  SET pipeline_statut = p_to_statut::dossier_pipeline_statut
  WHERE id = p_dossier_id;

  -- 5. Audit log
  INSERT INTO audit_log (
    entity_type, entity_id, logement_id, actor_user_id,
    action, changed_fields, metadata
  ) VALUES (
    'dossier',
    p_dossier_id,
    v_logement_id,
    auth.uid(),
    'pipeline_changed',
    jsonb_build_object(
      'pipeline_statut', jsonb_build_object(
        'before', p_from_statut,
        'after',  p_to_statut
      )
    ),
    '{"motif": "auto"}'::jsonb
  );

  RETURN TRUE;
END;
$$;

REVOKE ALL ON FUNCTION auto_advance_pipeline(UUID, text, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION auto_advance_pipeline(UUID, text, text) TO authenticated;

NOTIFY pgrst, 'reload schema';
