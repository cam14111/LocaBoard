-- ============================================================
-- Migration 002 : RPC update_reservation_dates
-- Corrige le bug du doublon fantôme de S2 (TODO dans reservations.ts)
-- Même logique anti-chevauchement que check_and_create_reservation
-- mais fait un UPDATE au lieu d'un INSERT
-- ============================================================

CREATE OR REPLACE FUNCTION update_reservation_dates(
  p_reservation_id UUID,
  p_date_debut DATE,
  p_date_fin DATE
) RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_logement_id UUID;
  v_conflict_count INTEGER;
  v_conflict_info TEXT;
  v_blocage_count INTEGER;
BEGIN
  -- Récupérer le logement_id de la réservation
  SELECT logement_id INTO v_logement_id
  FROM reservations
  WHERE id = p_reservation_id AND archived_at IS NULL;

  IF v_logement_id IS NULL THEN
    RAISE EXCEPTION 'Réservation introuvable';
  END IF;

  -- Vérifier les chevauchements avec réservations/options actives (exclut self)
  SELECT COUNT(*), string_agg(locataire_nom || ' ' || locataire_prenom || ' (' || date_debut || ' - ' || date_fin || ')', ', ')
  INTO v_conflict_count, v_conflict_info
  FROM reservations
  WHERE logement_id = v_logement_id
    AND statut IN ('OPTION_ACTIVE', 'CONFIRMEE')
    AND date_debut < p_date_fin
    AND date_fin > p_date_debut
    AND id != p_reservation_id
    AND archived_at IS NULL;

  IF v_conflict_count > 0 THEN
    RAISE EXCEPTION 'CONFLIT_DATES: Conflit de dates avec %', v_conflict_info;
  END IF;

  -- Vérifier les chevauchements avec blocages
  SELECT COUNT(*)
  INTO v_blocage_count
  FROM blocages
  WHERE logement_id = v_logement_id
    AND date_debut < p_date_fin
    AND date_fin > p_date_debut
    AND archived_at IS NULL;

  IF v_blocage_count > 0 THEN
    RAISE EXCEPTION 'CONFLIT_BLOCAGE: Le créneau chevauche un blocage existant';
  END IF;

  -- Vérifier le tampon ménage
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
    FROM logements WHERE id = v_logement_id;

    IF v_buffer > 0 THEN
      -- Séjour qui finit juste avant
      SELECT date_fin INTO v_prev_fin
      FROM reservations
      WHERE logement_id = v_logement_id
        AND statut IN ('OPTION_ACTIVE', 'CONFIRMEE')
        AND date_fin >= p_date_debut - 1
        AND date_fin <= p_date_debut
        AND id != p_reservation_id
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
        WHERE logement_id = v_logement_id
          AND statut IN ('OPTION_ACTIVE', 'CONFIRMEE')
          AND date_debut >= p_date_fin
          AND date_debut <= p_date_fin + 1
          AND id != p_reservation_id
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

  -- Tout OK : mettre à jour les dates
  UPDATE reservations
  SET date_debut = p_date_debut,
      date_fin = p_date_fin,
      updated_at = now()
  WHERE id = p_reservation_id;
END;
$$;
