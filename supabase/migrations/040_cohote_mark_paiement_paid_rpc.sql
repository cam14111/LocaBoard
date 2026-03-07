-- Migration 040 : RPC SECURITY DEFINER pour qu'un co-hôte autorisé puisse
-- marquer un paiement DU ou EN_RETARD comme PAYE.
--
-- PROBLÈME : la policy dashboard "paiements_update_admin" (FOR UPDATE, USING is_admin())
-- écrase la policy "Paiements: cohote mark paid" (migration 017).
-- Résultat : seul l'admin peut UPDATE paiements, même avec les bonnes permissions.
--
-- SOLUTION : RPC SECURITY DEFINER qui s'exécute en tant que postgres (owner),
-- vérifie les droits en interne, et bypasse les policies RLS.

CREATE OR REPLACE FUNCTION cohote_mark_paiement_paid(
  p_paiement_id UUID,
  p_method      public.paiement_method
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_role        public.user_role;
  v_statut      public.paiement_statut;
  v_dossier_id  UUID;
  v_logement_id UUID;
  v_can_mark    BOOLEAN;
BEGIN
  -- 1. Vérifier que l'appelant est COHOTE
  SELECT role INTO v_role
  FROM public.users
  WHERE id = auth.uid() AND archived_at IS NULL;

  IF v_role IS DISTINCT FROM 'COHOTE' THEN
    RAISE EXCEPTION 'FORBIDDEN: réservé aux co-hôtes';
  END IF;

  -- 2. Vérifier que le co-hôte a la permission globale paiement:mark_paid
  SELECT COALESCE((permissions ->> 'paiement:mark_paid')::boolean, false) INTO v_can_mark
  FROM public.users
  WHERE id = auth.uid();

  IF NOT v_can_mark THEN
    RAISE EXCEPTION 'FORBIDDEN: permission paiement:mark_paid non activée';
  END IF;

  -- 3. Récupérer le statut et le dossier du paiement
  SELECT p.statut, p.dossier_id, d.logement_id
  INTO v_statut, v_dossier_id, v_logement_id
  FROM public.paiements p
  JOIN public.dossiers d ON d.id = p.dossier_id
  WHERE p.id = p_paiement_id;

  IF v_statut IS NULL THEN
    RAISE EXCEPTION 'Paiement introuvable';
  END IF;

  IF v_statut NOT IN ('DU', 'EN_RETARD') THEN
    RAISE EXCEPTION 'Seuls les paiements DU ou EN_RETARD peuvent être marqués payés';
  END IF;

  -- 4. Vérifier que le co-hôte a accès à ce logement (logement_users)
  IF NOT EXISTS (
    SELECT 1 FROM public.logement_users
    WHERE user_id = auth.uid()
      AND logement_id = v_logement_id
      AND can_mark_payment = true
  ) THEN
    RAISE EXCEPTION 'FORBIDDEN: accès refusé à ce logement';
  END IF;

  -- 5. Marquer le paiement comme payé
  UPDATE public.paiements
  SET
    statut          = 'PAYE',
    method          = p_method,
    paid_at         = now(),
    paid_by_user_id = auth.uid(),
    proof_document_id = NULL
  WHERE id = p_paiement_id;
END;
$$;

REVOKE ALL ON FUNCTION cohote_mark_paiement_paid(UUID, public.paiement_method) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION cohote_mark_paiement_paid(UUID, public.paiement_method) TO authenticated;

NOTIFY pgrst, 'reload schema';
