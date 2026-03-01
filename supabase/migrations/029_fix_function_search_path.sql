-- Migration 029 : Correction "Function Search Path Mutable" (Supabase Security Advisor)
-- Ajoute SET search_path = '' à toutes les fonctions sans search_path fixe.
-- Les tables sont qualifiées public.* dans les corps de fonctions.
-- Attention : les fonctions SECURITY DEFINER sont particulièrement sensibles
--             à ce vecteur d'attaque (search_path injection).

SET search_path TO public;

-- ── 1. get_user_role() ─── SECURITY DEFINER ──────────────────────────────────
CREATE OR REPLACE FUNCTION get_user_role()
RETURNS user_role
LANGUAGE sql
SECURITY DEFINER
STABLE
SET search_path = ''
AS $$
  SELECT role FROM public.users WHERE id = auth.uid() AND archived_at IS NULL;
$$;

-- ── 2. count_admins() ─── SECURITY DEFINER ───────────────────────────────────
CREATE OR REPLACE FUNCTION count_admins()
RETURNS INTEGER
LANGUAGE sql
SECURITY DEFINER
STABLE
SET search_path = ''
AS $$
  SELECT COUNT(*)::INTEGER
  FROM public.users
  WHERE role = 'ADMIN'
    AND archived_at IS NULL;
$$;

-- ── 3. current_user_has_permission() ─── SECURITY DEFINER ────────────────────
CREATE OR REPLACE FUNCTION current_user_has_permission(perm TEXT)
RETURNS BOOLEAN
LANGUAGE sql
SECURITY DEFINER
STABLE
SET search_path = ''
AS $$
  SELECT COALESCE(
    (SELECT (permissions ->> perm)::BOOLEAN
     FROM public.users
     WHERE id = auth.uid()),
    FALSE
  );
$$;

-- ── 4. current_auth_email() ───────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION current_auth_email()
RETURNS TEXT
LANGUAGE sql
STABLE
SET search_path = ''
AS $$
  SELECT lower(coalesce(auth.jwt() ->> 'email', ''));
$$;

-- ── 5. is_admin() ─────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION is_admin()
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SET search_path = ''
AS $$
  SELECT public.current_user_role() = 'ADMIN'::public.user_role;
$$;

-- ── 6. can_mark_payment() ────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION can_mark_payment()
RETURNS BOOLEAN
LANGUAGE plpgsql
STABLE
SET search_path = ''
AS $$
DECLARE
  v_can_mark TEXT;
BEGIN
  v_can_mark := lower(coalesce(public.current_user_permissions() ->> 'can_mark_payment', 'false'));
  RETURN v_can_mark IN ('1', 't', 'true', 'yes', 'on');
END;
$$;

-- ── 7. check_and_create_reservation() ─── SECURITY DEFINER ───────────────────
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
SET search_path = ''
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
  FROM public.reservations
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
  FROM public.blocages
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
    FROM public.logements WHERE id = p_logement_id;

    IF v_buffer > 0 THEN
      SELECT date_fin INTO v_prev_fin
      FROM public.reservations
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

      DECLARE
        v_next_debut DATE;
        v_new_checkout_ts TIMESTAMPTZ;
        v_next_checkin_ts TIMESTAMPTZ;
      BEGIN
        SELECT date_debut INTO v_next_debut
        FROM public.reservations
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
  INSERT INTO public.reservations (
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

-- ── 8. check_and_create_blocage() ─── SECURITY DEFINER ───────────────────────
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
SET search_path = ''
AS $$
DECLARE
  v_conflict_count INTEGER;
  v_new_id UUID;
BEGIN
  SELECT COUNT(*) INTO v_conflict_count
  FROM public.reservations
  WHERE logement_id = p_logement_id
    AND statut IN ('OPTION_ACTIVE', 'CONFIRMEE')
    AND date_debut < p_date_fin
    AND date_fin > p_date_debut
    AND archived_at IS NULL;

  IF v_conflict_count > 0 THEN
    RAISE EXCEPTION 'CONFLIT_DATES: Le blocage chevauche une réservation existante';
  END IF;

  SELECT COUNT(*) INTO v_conflict_count
  FROM public.blocages
  WHERE logement_id = p_logement_id
    AND date_debut < p_date_fin
    AND date_fin > p_date_debut
    AND archived_at IS NULL;

  IF v_conflict_count > 0 THEN
    RAISE EXCEPTION 'CONFLIT_BLOCAGE: Le créneau chevauche un blocage existant';
  END IF;

  INSERT INTO public.blocages (logement_id, date_debut, date_fin, motif, notes, created_by_user_id)
  VALUES (p_logement_id, p_date_debut, p_date_fin, p_motif, p_notes, p_created_by)
  RETURNING id INTO v_new_id;

  RETURN v_new_id;
END;
$$;

-- ── 9. update_reservation_dates() ─── SECURITY DEFINER ───────────────────────
CREATE OR REPLACE FUNCTION update_reservation_dates(
  p_reservation_id UUID,
  p_date_debut DATE,
  p_date_fin DATE
) RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_logement_id UUID;
  v_conflict_count INTEGER;
  v_conflict_info TEXT;
  v_blocage_count INTEGER;
BEGIN
  SELECT logement_id INTO v_logement_id
  FROM public.reservations
  WHERE id = p_reservation_id AND archived_at IS NULL;

  IF v_logement_id IS NULL THEN
    RAISE EXCEPTION 'Réservation introuvable';
  END IF;

  SELECT COUNT(*), string_agg(locataire_nom || ' ' || locataire_prenom || ' (' || date_debut || ' - ' || date_fin || ')', ', ')
  INTO v_conflict_count, v_conflict_info
  FROM public.reservations
  WHERE logement_id = v_logement_id
    AND statut IN ('OPTION_ACTIVE', 'CONFIRMEE')
    AND date_debut < p_date_fin
    AND date_fin > p_date_debut
    AND id != p_reservation_id
    AND archived_at IS NULL;

  IF v_conflict_count > 0 THEN
    RAISE EXCEPTION 'CONFLIT_DATES: Conflit de dates avec %', v_conflict_info;
  END IF;

  SELECT COUNT(*)
  INTO v_blocage_count
  FROM public.blocages
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
    FROM public.logements WHERE id = v_logement_id;

    IF v_buffer > 0 THEN
      SELECT date_fin INTO v_prev_fin
      FROM public.reservations
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

      DECLARE
        v_next_debut DATE;
        v_new_checkout_ts TIMESTAMPTZ;
        v_next_checkin_ts TIMESTAMPTZ;
      BEGIN
        SELECT date_debut INTO v_next_debut
        FROM public.reservations
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

  UPDATE public.reservations
  SET date_debut = p_date_debut,
      date_fin = p_date_fin,
      updated_at = now()
  WHERE id = p_reservation_id;
END;
$$;

NOTIFY pgrst, 'reload schema';
