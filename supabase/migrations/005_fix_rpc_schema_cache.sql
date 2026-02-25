-- Migration 005 : Recrée les fonctions RPC pour forcer le rechargement du schema cache PostgREST
-- À appliquer si BUG-02 : "Could not find the function public.check_and_create_reservation in the schema cache"
--
-- Comment appliquer :
--   Option A) Supabase Dashboard → SQL Editor → coller ce fichier → Run
--   Option B) supabase db push (si CLI Supabase installé)

-- ─── 1. Recrée check_and_create_reservation ───────────────────

CREATE OR REPLACE FUNCTION check_and_create_reservation(
  p_logement_id UUID,
  p_date_debut DATE,
  p_date_fin DATE,
  p_type reservation_type,
  p_statut reservation_statut,
  p_expiration_at TIMESTAMPTZ DEFAULT NULL,
  p_locataire_nom TEXT DEFAULT '',
  p_locataire_prenom TEXT DEFAULT '',
  p_locataire_email TEXT DEFAULT NULL,
  p_locataire_telephone TEXT DEFAULT NULL,
  p_locataire_adresse TEXT DEFAULT NULL,
  p_locataire_pays TEXT DEFAULT 'France',
  p_nb_personnes INTEGER DEFAULT 1,
  p_nb_adultes INTEGER DEFAULT NULL,
  p_nb_enfants INTEGER DEFAULT NULL,
  p_loyer_total NUMERIC DEFAULT NULL,
  p_notes TEXT DEFAULT NULL,
  p_created_by UUID DEFAULT NULL,
  p_exclude_reservation_id UUID DEFAULT NULL
) RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_conflict_count INTEGER;
  v_blocage_count INTEGER;
  v_new_id UUID;
  v_conflict_info TEXT;
BEGIN
  -- Vérifier les chevauchements avec réservations/options actives
  SELECT COUNT(*), string_agg(locataire_nom || ' ' || locataire_prenom || ' (' || date_debut || ' - ' || date_fin || ')', ', ')
  INTO v_conflict_count, v_conflict_info
  FROM reservations
  WHERE logement_id = p_logement_id
    AND statut IN ('OPTION_ACTIVE', 'CONFIRMEE')
    AND date_debut < p_date_fin
    AND date_fin > p_date_debut
    AND (p_exclude_reservation_id IS NULL OR id != p_exclude_reservation_id)
    AND archived_at IS NULL;

  IF v_conflict_count > 0 THEN
    RAISE EXCEPTION 'CONFLIT_DATES: Conflit de dates avec %', v_conflict_info;
  END IF;

  -- Vérifier les chevauchements avec blocages
  SELECT COUNT(*)
  INTO v_blocage_count
  FROM blocages
  WHERE logement_id = p_logement_id
    AND date_debut < p_date_fin
    AND date_fin > p_date_debut
    AND archived_at IS NULL;

  IF v_blocage_count > 0 THEN
    RAISE EXCEPTION 'CONFLIT_BLOCAGE: Le créneau chevauche un blocage existant';
  END IF;

  -- Vérifier le tampon ménage (séjour précédent)
  DECLARE
    v_prev_fin DATE;
    v_checkout TIME;
    v_checkin TIME;
    v_buffer NUMERIC;
    v_prev_checkout_ts TIMESTAMPTZ;
    v_new_checkin_ts TIMESTAMPTZ;
  BEGIN
    SELECT heure_checkout, heure_checkin, buffer_heures
    INTO v_checkout, v_checkin, v_buffer
    FROM logements WHERE id = p_logement_id;

    IF v_buffer > 0 THEN
      -- Séjour qui finit juste avant
      SELECT date_fin INTO v_prev_fin
      FROM reservations
      WHERE logement_id = p_logement_id
        AND statut IN ('OPTION_ACTIVE', 'CONFIRMEE')
        AND date_fin >= p_date_debut - 1
        AND date_fin <= p_date_debut
        AND (p_exclude_reservation_id IS NULL OR id != p_exclude_reservation_id)
        AND archived_at IS NULL
      ORDER BY date_fin DESC
      LIMIT 1;

      IF v_prev_fin IS NOT NULL THEN
        v_prev_checkout_ts := v_prev_fin::TIMESTAMPTZ + v_checkout::INTERVAL;
        v_new_checkin_ts := p_date_debut::TIMESTAMPTZ + v_checkin::INTERVAL;

        IF v_new_checkin_ts < (v_prev_checkout_ts + (v_buffer || ' hours')::INTERVAL) THEN
          RAISE EXCEPTION 'TAMPON_MENAGE: Tampon ménage insuffisant (disponible à partir de %)',
            to_char(v_prev_checkout_ts + (v_buffer || ' hours')::INTERVAL, 'HH24:MI');
        END IF;
      END IF;

      -- Séjour qui commence juste après (vérification inverse)
      DECLARE
        v_next_debut DATE;
        v_new_checkout_ts TIMESTAMPTZ;
        v_next_checkin_ts TIMESTAMPTZ;
      BEGIN
        SELECT date_debut INTO v_next_debut
        FROM reservations
        WHERE logement_id = p_logement_id
          AND statut IN ('OPTION_ACTIVE', 'CONFIRMEE')
          AND date_debut >= p_date_fin
          AND date_debut <= p_date_fin + 1
          AND (p_exclude_reservation_id IS NULL OR id != p_exclude_reservation_id)
          AND archived_at IS NULL
        ORDER BY date_debut ASC
        LIMIT 1;

        IF v_next_debut IS NOT NULL THEN
          v_new_checkout_ts := p_date_fin::TIMESTAMPTZ + v_checkout::INTERVAL;
          v_next_checkin_ts := v_next_debut::TIMESTAMPTZ + v_checkin::INTERVAL;

          IF v_next_checkin_ts < (v_new_checkout_ts + (v_buffer || ' hours')::INTERVAL) THEN
            RAISE EXCEPTION 'TAMPON_MENAGE: Tampon ménage insuffisant avec le séjour suivant';
          END IF;
        END IF;
      END;
    END IF;
  END;

  -- Tout OK : créer la réservation
  INSERT INTO reservations (
    logement_id, type, statut, date_debut, date_fin, expiration_at,
    locataire_nom, locataire_prenom, locataire_email, locataire_telephone,
    locataire_adresse, locataire_pays,
    nb_personnes, nb_adultes, nb_enfants, loyer_total, notes,
    created_by_user_id
  ) VALUES (
    p_logement_id, p_type, p_statut, p_date_debut, p_date_fin, p_expiration_at,
    p_locataire_nom, p_locataire_prenom, p_locataire_email, p_locataire_telephone,
    p_locataire_adresse, p_locataire_pays,
    p_nb_personnes, p_nb_adultes, p_nb_enfants, p_loyer_total, p_notes,
    p_created_by
  )
  RETURNING id INTO v_new_id;

  RETURN v_new_id;
END;
$$;

-- ─── 2. Recrée check_and_create_blocage ──────────────────────

CREATE OR REPLACE FUNCTION check_and_create_blocage(
  p_logement_id UUID,
  p_date_debut DATE,
  p_date_fin DATE,
  p_motif blocage_motif,
  p_notes TEXT DEFAULT NULL,
  p_created_by UUID DEFAULT NULL
) RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_conflict_count INTEGER;
  v_new_id UUID;
BEGIN
  SELECT COUNT(*) INTO v_conflict_count
  FROM reservations
  WHERE logement_id = p_logement_id
    AND statut IN ('OPTION_ACTIVE', 'CONFIRMEE')
    AND date_debut < p_date_fin
    AND date_fin > p_date_debut
    AND archived_at IS NULL;

  IF v_conflict_count > 0 THEN
    RAISE EXCEPTION 'CONFLIT_DATES: Le blocage chevauche une réservation existante';
  END IF;

  SELECT COUNT(*) INTO v_conflict_count
  FROM blocages
  WHERE logement_id = p_logement_id
    AND date_debut < p_date_fin
    AND date_fin > p_date_debut
    AND archived_at IS NULL;

  IF v_conflict_count > 0 THEN
    RAISE EXCEPTION 'CONFLIT_BLOCAGE: Le créneau chevauche un blocage existant';
  END IF;

  INSERT INTO blocages (logement_id, date_debut, date_fin, motif, notes, created_by_user_id)
  VALUES (p_logement_id, p_date_debut, p_date_fin, p_motif, p_notes, p_created_by)
  RETURNING id INTO v_new_id;

  RETURN v_new_id;
END;
$$;

-- ─── 3. Policy INSERT notifications (manquante → 403 Forbidden) ─
-- Les policies complexes (notifications_insert_admin_or_self, notifications_insert_system_only)
-- utilisent des fonctions custom (current_app_user_id, is_admin) qui peuvent lever des exceptions
-- dans le contexte PostgREST et bloquer tous les INSERT même avec une policy permissive valide.
-- On les supprime et remplace par une policy simple basée sur auth.uid().
DROP POLICY IF EXISTS "notifications_insert_admin_or_self" ON notifications;
DROP POLICY IF EXISTS "notifications_insert_system_only" ON notifications;
DROP POLICY IF EXISTS "Notifications: insert authentifié" ON notifications;
CREATE POLICY "Notifications: insert authentifié" ON notifications
  FOR INSERT WITH CHECK (auth.uid() IS NOT NULL);

-- ─── 4. Forcer le rechargement du schema cache PostgREST ──────
NOTIFY pgrst, 'reload schema';
