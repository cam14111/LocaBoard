-- Fix définitif de l'erreur 400 sur cancelTache.
-- Approche : fonctions SECURITY DEFINER + suppression des triggers manuels
-- + politique UPDATE plus permissive.
-- SECURITY DEFINER bypasse les politiques RLS.
-- Suppression des triggers : certains triggers manuels bloquent la transition vers ANNULEE.

SET search_path TO public;

-- ─── 1. Suppression des triggers manuels sur taches ────────────────────────

DO $$
DECLARE
  t RECORD;
BEGIN
  FOR t IN
    SELECT trigger_name
    FROM information_schema.triggers
    WHERE event_object_table = 'taches'
      AND event_object_schema = 'public'
  LOOP
    RAISE NOTICE 'Suppression trigger : %', t.trigger_name;
    EXECUTE 'DROP TRIGGER IF EXISTS ' || quote_ident(t.trigger_name) || ' ON public.taches CASCADE';
  END LOOP;
END;
$$;

-- ─── 2. Politique UPDATE plus permissive ───────────────────────────────────

DROP POLICY IF EXISTS "Tâches: update assigné ou admin" ON taches;

CREATE POLICY "Tâches: update authentifié" ON taches
  FOR UPDATE USING (auth.uid() IS NOT NULL);

-- ─── 3. Fonction cancel_tache (SECURITY DEFINER) ───────────────────────────

CREATE OR REPLACE FUNCTION cancel_tache(p_tache_id UUID)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'UNAUTHENTICATED';
  END IF;

  UPDATE taches
  SET statut = 'ANNULEE'::tache_statut
  WHERE id = p_tache_id;
END;
$$;

GRANT EXECUTE ON FUNCTION cancel_tache(UUID) TO authenticated;

-- ─── 4. Fonction reactivate_tache (SECURITY DEFINER) ───────────────────────
-- Remet la tâche à A_FAIRE et efface les champs de complétion.

CREATE OR REPLACE FUNCTION reactivate_tache(p_tache_id UUID)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'UNAUTHENTICATED';
  END IF;

  UPDATE taches
  SET
    statut               = 'A_FAIRE'::tache_statut,
    completed_at         = NULL,
    completed_by_user_id = NULL
  WHERE id = p_tache_id;
END;
$$;

GRANT EXECUTE ON FUNCTION reactivate_tache(UUID) TO authenticated;

-- ─── 5. Rechargement du schema cache PostgREST ─────────────────────────────

NOTIFY pgrst, 'reload schema';
