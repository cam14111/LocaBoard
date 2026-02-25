-- ============================================================
-- Calendrier Location — Schéma BDD complet (MVP)
-- À exécuter dans Supabase SQL Editor
-- ============================================================

-- ─── Extensions ──────────────────────────────────────────────

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ─── Enums ───────────────────────────────────────────────────

CREATE TYPE user_role AS ENUM ('ADMIN', 'COHOTE');

CREATE TYPE reservation_type AS ENUM ('OPTION', 'RESERVATION');
CREATE TYPE reservation_statut AS ENUM ('OPTION_ACTIVE', 'CONFIRMEE', 'OPTION_EXPIREE', 'ANNULEE');

CREATE TYPE pipeline_statut AS ENUM (
  'DEMANDE_RECUE', 'OPTION_POSEE', 'CONTRAT_ENVOYE', 'CONTRAT_SIGNE',
  'ACOMPTE_RECU', 'SOLDE_DEMANDE', 'SOLDE_RECU',
  'CHECKIN_FAIT', 'CHECKOUT_FAIT',
  'EDL_OK', 'EDL_INCIDENT',
  'CLOTURE', 'ANNULE'
);

CREATE TYPE paiement_type AS ENUM ('ARRHES', 'ACOMPTE', 'SOLDE', 'TAXE_SEJOUR', 'EXTRA');
CREATE TYPE paiement_statut AS ENUM ('DU', 'EN_RETARD', 'PAYE', 'ANNULE');
CREATE TYPE paiement_method AS ENUM ('VIREMENT', 'CHEQUE', 'ESPECES', 'AUTRE');

CREATE TYPE document_type AS ENUM ('CONTRAT', 'PREUVE_PAIEMENT', 'EDL', 'PIECE_IDENTITE', 'AUTRE');

CREATE TYPE edl_type AS ENUM ('ARRIVEE', 'DEPART');
CREATE TYPE edl_statut AS ENUM ('NON_COMMENCE', 'EN_COURS', 'TERMINE_OK', 'TERMINE_INCIDENT');
CREATE TYPE edl_item_etat AS ENUM ('OK', 'ANOMALIE');

CREATE TYPE incident_severite AS ENUM ('MINEUR', 'MAJEUR');

CREATE TYPE tache_type AS ENUM ('MENAGE', 'ACCUEIL', 'REMISE_CLES', 'MAINTENANCE', 'AUTRE');
CREATE TYPE tache_statut AS ENUM ('A_FAIRE', 'EN_COURS', 'FAIT', 'ANNULEE');

CREATE TYPE notification_type AS ENUM (
  'OPTION_EXPIRE_BIENTOT', 'OPTION_EXPIREE',
  'PAIEMENT_EN_RETARD', 'PAIEMENT_DU_BIENTOT',
  'ARRIVEE_DEMAIN', 'DEPART_DEMAIN',
  'TACHE_ASSIGNEE', 'TACHE_EN_RETARD',
  'EDL_A_REALISER'
);

CREATE TYPE blocage_motif AS ENUM ('MAINTENANCE', 'USAGE_PERSO', 'AUTRE');

-- ─── Tables ──────────────────────────────────────────────────

-- Utilisateurs (profils liés à auth.users)
CREATE TABLE utilisateurs (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email TEXT NOT NULL,
  nom TEXT NOT NULL DEFAULT '',
  prenom TEXT NOT NULL DEFAULT '',
  role user_role NOT NULL DEFAULT 'COHOTE',
  permissions JSONB NOT NULL DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  archived_at TIMESTAMPTZ
);

-- Logements
CREATE TABLE logements (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  nom TEXT NOT NULL,
  adresse TEXT NOT NULL DEFAULT '',
  type TEXT NOT NULL DEFAULT 'appartement',
  surface_m2 NUMERIC,
  capacite_personnes INTEGER NOT NULL DEFAULT 4,
  nb_pieces INTEGER,
  heure_checkin TIME NOT NULL DEFAULT '15:00',
  heure_checkout TIME NOT NULL DEFAULT '10:00',
  buffer_heures NUMERIC NOT NULL DEFAULT 4 CHECK (buffer_heures >= 0),
  taux_taxe_sejour NUMERIC NOT NULL DEFAULT 0 CHECK (taux_taxe_sejour >= 0),
  duree_expiration_option_jours INTEGER NOT NULL DEFAULT 3 CHECK (duree_expiration_option_jours >= 1),
  taches_auto_enabled BOOLEAN NOT NULL DEFAULT true,
  photo_url TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  archived_at TIMESTAMPTZ
);

-- Réservations / Options
CREATE TABLE reservations (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  logement_id UUID NOT NULL REFERENCES logements(id),
  type reservation_type NOT NULL DEFAULT 'RESERVATION',
  statut reservation_statut NOT NULL DEFAULT 'CONFIRMEE',
  date_debut DATE NOT NULL,
  date_fin DATE NOT NULL,
  expiration_at TIMESTAMPTZ,
  locataire_nom TEXT NOT NULL DEFAULT '',
  locataire_prenom TEXT NOT NULL DEFAULT '',
  locataire_email TEXT,
  locataire_telephone TEXT,
  locataire_adresse TEXT,
  locataire_pays TEXT DEFAULT 'France',
  nb_personnes INTEGER NOT NULL DEFAULT 1 CHECK (nb_personnes >= 1),
  nb_adultes INTEGER,
  nb_enfants INTEGER,
  loyer_total NUMERIC,
  notes TEXT,
  motif_annulation TEXT,
  created_by_user_id UUID REFERENCES utilisateurs(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  archived_at TIMESTAMPTZ,
  CHECK (date_fin > date_debut)
);

-- Blocages (maintenance, usage perso)
CREATE TABLE blocages (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  logement_id UUID NOT NULL REFERENCES logements(id),
  date_debut DATE NOT NULL,
  date_fin DATE NOT NULL,
  motif blocage_motif NOT NULL DEFAULT 'AUTRE',
  notes TEXT,
  created_by_user_id UUID REFERENCES utilisateurs(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  archived_at TIMESTAMPTZ,
  CHECK (date_fin > date_debut)
);

-- Dossiers
CREATE TABLE dossiers (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  reservation_id UUID NOT NULL UNIQUE REFERENCES reservations(id),
  logement_id UUID NOT NULL REFERENCES logements(id),
  pipeline_statut pipeline_statut NOT NULL DEFAULT 'DEMANDE_RECUE',
  type_premier_versement paiement_type NOT NULL DEFAULT 'ARRHES'
    CHECK (type_premier_versement IN ('ARRHES', 'ACOMPTE')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  archived_at TIMESTAMPTZ
);

-- Paiements
CREATE TABLE paiements (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  dossier_id UUID NOT NULL REFERENCES dossiers(id),
  type paiement_type NOT NULL,
  montant_eur NUMERIC NOT NULL CHECK (montant_eur > 0),
  echeance_date DATE NOT NULL,
  statut paiement_statut NOT NULL DEFAULT 'DU',
  method paiement_method,
  paid_at TIMESTAMPTZ,
  paid_by_user_id UUID REFERENCES utilisateurs(id),
  proof_document_id UUID, -- FK ajoutée après création de la table documents
  label TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Documents
CREATE TABLE documents (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  dossier_id UUID NOT NULL REFERENCES dossiers(id),
  type document_type NOT NULL,
  nom_fichier TEXT NOT NULL,
  mime_type TEXT NOT NULL,
  taille_octets INTEGER NOT NULL,
  storage_path TEXT NOT NULL,
  uploaded_by_user_id UUID NOT NULL REFERENCES utilisateurs(id),
  uploaded_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  archived_at TIMESTAMPTZ,
  remplace_document_id UUID REFERENCES documents(id)
);

-- FK circulaire paiements → documents
ALTER TABLE paiements
  ADD CONSTRAINT fk_paiements_proof_document
  FOREIGN KEY (proof_document_id) REFERENCES documents(id);

-- État des lieux
CREATE TABLE edl (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  dossier_id UUID NOT NULL REFERENCES dossiers(id),
  type edl_type NOT NULL,
  statut edl_statut NOT NULL DEFAULT 'NON_COMMENCE',
  realise_par_user_id UUID REFERENCES utilisateurs(id),
  started_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  UNIQUE (dossier_id, type)
);

-- Items d'EDL
CREATE TABLE edl_items (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  edl_id UUID NOT NULL REFERENCES edl(id) ON DELETE CASCADE,
  checklist_item_label TEXT NOT NULL,
  etat edl_item_etat,
  photo_url TEXT,
  commentaire TEXT,
  ordre INTEGER NOT NULL DEFAULT 0
);

-- Incidents
CREATE TABLE incidents (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  edl_id UUID NOT NULL REFERENCES edl(id),
  dossier_id UUID NOT NULL REFERENCES dossiers(id),
  description TEXT NOT NULL,
  severite incident_severite NOT NULL DEFAULT 'MINEUR',
  created_by_user_id UUID NOT NULL REFERENCES utilisateurs(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Photos d'incidents
CREATE TABLE incident_photos (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  incident_id UUID NOT NULL REFERENCES incidents(id) ON DELETE CASCADE,
  photo_url TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Tâches
CREATE TABLE taches (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  dossier_id UUID REFERENCES dossiers(id),
  logement_id UUID NOT NULL REFERENCES logements(id),
  titre TEXT NOT NULL,
  description TEXT,
  type tache_type NOT NULL DEFAULT 'AUTRE',
  statut tache_statut NOT NULL DEFAULT 'A_FAIRE',
  echeance_at TIMESTAMPTZ NOT NULL,
  assignee_user_id UUID REFERENCES utilisateurs(id),
  completed_at TIMESTAMPTZ,
  completed_by_user_id UUID REFERENCES utilisateurs(id),
  proof_photo_url TEXT,
  auto_generated BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Notes internes
CREATE TABLE notes (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  dossier_id UUID NOT NULL REFERENCES dossiers(id),
  contenu TEXT NOT NULL,
  created_by_user_id UUID NOT NULL REFERENCES utilisateurs(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Notifications
CREATE TABLE notifications (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES utilisateurs(id),
  type notification_type NOT NULL,
  titre TEXT NOT NULL,
  message TEXT NOT NULL DEFAULT '',
  entity_type TEXT,
  entity_id UUID,
  read_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Audit Log (immuable)
CREATE TABLE audit_log (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  entity_type TEXT NOT NULL,
  entity_id UUID NOT NULL,
  logement_id UUID,
  action TEXT NOT NULL,
  changed_fields JSONB,
  metadata JSONB,
  actor_user_id UUID REFERENCES utilisateurs(id),
  timestamp TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Modèles de checklists EDL
CREATE TABLE checklist_modeles (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  logement_id UUID NOT NULL REFERENCES logements(id),
  nom TEXT NOT NULL,
  items JSONB NOT NULL DEFAULT '[]',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ─── Index ───────────────────────────────────────────────────

-- Réservations : recherche overlap + filtres
CREATE INDEX idx_reservations_logement_dates ON reservations (logement_id, date_debut, date_fin);
CREATE INDEX idx_reservations_statut ON reservations (statut);
CREATE INDEX idx_reservations_logement_statut ON reservations (logement_id, statut);

-- Blocages : recherche overlap
CREATE INDEX idx_blocages_logement_dates ON blocages (logement_id, date_debut, date_fin)
  WHERE archived_at IS NULL;

-- Dossiers
CREATE INDEX idx_dossiers_logement ON dossiers (logement_id);
CREATE INDEX idx_dossiers_pipeline ON dossiers (logement_id, pipeline_statut);

-- Paiements
CREATE INDEX idx_paiements_dossier ON paiements (dossier_id);
CREATE INDEX idx_paiements_statut ON paiements (statut);
CREATE INDEX idx_paiements_echeance ON paiements (echeance_date) WHERE statut = 'DU';

-- Tâches
CREATE INDEX idx_taches_assignee ON taches (assignee_user_id, statut);
CREATE INDEX idx_taches_dossier ON taches (dossier_id);
CREATE INDEX idx_taches_echeance ON taches (echeance_at) WHERE statut IN ('A_FAIRE', 'EN_COURS');

-- Audit log
CREATE INDEX idx_audit_entity ON audit_log (entity_type, entity_id);
CREATE INDEX idx_audit_actor ON audit_log (actor_user_id);
CREATE INDEX idx_audit_timestamp ON audit_log (timestamp DESC);
CREATE INDEX idx_audit_logement ON audit_log (logement_id);

-- Notifications
CREATE INDEX idx_notifications_user_unread ON notifications (user_id, read_at)
  WHERE read_at IS NULL;

-- EDL
CREATE INDEX idx_edl_dossier ON edl (dossier_id);

-- Documents
CREATE INDEX idx_documents_dossier ON documents (dossier_id) WHERE archived_at IS NULL;

-- ─── RPC : Anti-chevauchement atomique ───────────────────────

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
  p_exclude_reservation_id UUID DEFAULT NULL -- pour les modifications
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

-- ─── RPC : Vérification anti-chevauchement blocage ───────────

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
  -- Vérifier chevauchement réservations
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

  -- Vérifier chevauchement blocages
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

-- ─── RLS (Row Level Security) ────────────────────────────────

ALTER TABLE utilisateurs ENABLE ROW LEVEL SECURITY;
ALTER TABLE logements ENABLE ROW LEVEL SECURITY;
ALTER TABLE reservations ENABLE ROW LEVEL SECURITY;
ALTER TABLE blocages ENABLE ROW LEVEL SECURITY;
ALTER TABLE dossiers ENABLE ROW LEVEL SECURITY;
ALTER TABLE paiements ENABLE ROW LEVEL SECURITY;
ALTER TABLE documents ENABLE ROW LEVEL SECURITY;
ALTER TABLE edl ENABLE ROW LEVEL SECURITY;
ALTER TABLE edl_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE incidents ENABLE ROW LEVEL SECURITY;
ALTER TABLE incident_photos ENABLE ROW LEVEL SECURITY;
ALTER TABLE taches ENABLE ROW LEVEL SECURITY;
ALTER TABLE notes ENABLE ROW LEVEL SECURITY;
ALTER TABLE notifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE audit_log ENABLE ROW LEVEL SECURITY;
ALTER TABLE checklist_modeles ENABLE ROW LEVEL SECURITY;

-- Policy helper : récupérer le rôle de l'utilisateur courant
CREATE OR REPLACE FUNCTION get_user_role()
RETURNS user_role
LANGUAGE sql
STABLE
SECURITY DEFINER
AS $$
  SELECT role FROM utilisateurs WHERE id = auth.uid();
$$;

-- Policies génériques : utilisateur authentifié peut lire tout
-- Admin peut tout faire, Co-hôte en lecture + écriture restreinte

-- Utilisateurs
CREATE POLICY "Utilisateurs: lecture authentifié" ON utilisateurs
  FOR SELECT USING (auth.uid() IS NOT NULL);
CREATE POLICY "Utilisateurs: admin full" ON utilisateurs
  FOR ALL USING (get_user_role() = 'ADMIN');

-- Logements
CREATE POLICY "Logements: lecture authentifié" ON logements
  FOR SELECT USING (auth.uid() IS NOT NULL AND archived_at IS NULL);
CREATE POLICY "Logements: admin write" ON logements
  FOR ALL USING (get_user_role() = 'ADMIN');

-- Réservations
CREATE POLICY "Réservations: lecture authentifié" ON reservations
  FOR SELECT USING (auth.uid() IS NOT NULL);
CREATE POLICY "Réservations: admin write" ON reservations
  FOR ALL USING (get_user_role() = 'ADMIN');

-- Blocages
CREATE POLICY "Blocages: lecture authentifié" ON blocages
  FOR SELECT USING (auth.uid() IS NOT NULL);
CREATE POLICY "Blocages: admin write" ON blocages
  FOR ALL USING (get_user_role() = 'ADMIN');

-- Dossiers
CREATE POLICY "Dossiers: lecture authentifié" ON dossiers
  FOR SELECT USING (auth.uid() IS NOT NULL);
CREATE POLICY "Dossiers: admin write" ON dossiers
  FOR ALL USING (get_user_role() = 'ADMIN');

-- Paiements
CREATE POLICY "Paiements: lecture authentifié" ON paiements
  FOR SELECT USING (auth.uid() IS NOT NULL);
CREATE POLICY "Paiements: admin write" ON paiements
  FOR ALL USING (get_user_role() = 'ADMIN');

-- Documents
CREATE POLICY "Documents: lecture authentifié" ON documents
  FOR SELECT USING (auth.uid() IS NOT NULL);
CREATE POLICY "Documents: admin insert" ON documents
  FOR INSERT WITH CHECK (get_user_role() = 'ADMIN');
CREATE POLICY "Documents: cohote insert edl" ON documents
  FOR INSERT WITH CHECK (get_user_role() = 'COHOTE' AND type = 'EDL');

-- EDL
CREATE POLICY "EDL: lecture authentifié" ON edl
  FOR SELECT USING (auth.uid() IS NOT NULL);
CREATE POLICY "EDL: écriture authentifié" ON edl
  FOR ALL USING (auth.uid() IS NOT NULL);

-- EDL items
CREATE POLICY "EDL items: lecture authentifié" ON edl_items
  FOR SELECT USING (auth.uid() IS NOT NULL);
CREATE POLICY "EDL items: écriture authentifié" ON edl_items
  FOR ALL USING (auth.uid() IS NOT NULL);

-- Incidents
CREATE POLICY "Incidents: lecture authentifié" ON incidents
  FOR SELECT USING (auth.uid() IS NOT NULL);
CREATE POLICY "Incidents: écriture authentifié" ON incidents
  FOR ALL USING (auth.uid() IS NOT NULL);

-- Incident photos
CREATE POLICY "Incident photos: lecture authentifié" ON incident_photos
  FOR SELECT USING (auth.uid() IS NOT NULL);
CREATE POLICY "Incident photos: écriture authentifié" ON incident_photos
  FOR ALL USING (auth.uid() IS NOT NULL);

-- Tâches
CREATE POLICY "Tâches: lecture authentifié" ON taches
  FOR SELECT USING (auth.uid() IS NOT NULL);
CREATE POLICY "Tâches: admin write" ON taches
  FOR INSERT WITH CHECK (get_user_role() = 'ADMIN');
CREATE POLICY "Tâches: update assigné ou admin" ON taches
  FOR UPDATE USING (
    get_user_role() = 'ADMIN' OR assignee_user_id = auth.uid()
  );

-- Notes
CREATE POLICY "Notes: lecture authentifié" ON notes
  FOR SELECT USING (auth.uid() IS NOT NULL);
CREATE POLICY "Notes: écriture authentifié" ON notes
  FOR INSERT WITH CHECK (auth.uid() IS NOT NULL);

-- Notifications
CREATE POLICY "Notifications: lecture propres" ON notifications
  FOR SELECT USING (user_id = auth.uid());
CREATE POLICY "Notifications: update propres" ON notifications
  FOR UPDATE USING (user_id = auth.uid());

-- Audit log
CREATE POLICY "Audit: lecture admin" ON audit_log
  FOR SELECT USING (get_user_role() = 'ADMIN');
CREATE POLICY "Audit: lecture cohote par dossier" ON audit_log
  FOR SELECT USING (
    get_user_role() = 'COHOTE'
    AND entity_type = 'dossier'
  );
CREATE POLICY "Audit: insertion système" ON audit_log
  FOR INSERT WITH CHECK (true);

-- Checklist modèles
CREATE POLICY "Checklists: lecture authentifié" ON checklist_modeles
  FOR SELECT USING (auth.uid() IS NOT NULL);
CREATE POLICY "Checklists: admin write" ON checklist_modeles
  FOR ALL USING (get_user_role() = 'ADMIN');

-- ─── Trigger : updated_at automatique ────────────────────────

CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_reservations_updated_at
  BEFORE UPDATE ON reservations
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER trg_dossiers_updated_at
  BEFORE UPDATE ON dossiers
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER trg_paiements_updated_at
  BEFORE UPDATE ON paiements
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER trg_checklist_modeles_updated_at
  BEFORE UPDATE ON checklist_modeles
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();
