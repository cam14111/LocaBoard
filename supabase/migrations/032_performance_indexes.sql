-- Migration 032 : Index de performance pour slow queries
-- Résout les problèmes identifiés dans Query Performance Supabase
-- Impact estimé : expire_active_options 53% → <5% du temps total

-- ── 1. Index critique : expire_active_options + notify_options_expiring_soon ──
-- Problème : PostgreSQL utilise idx_reservations_statut (colonne statut seule) pour
-- trouver toutes les OPTION_ACTIVE, puis filtre ligne par ligne sur expiration_at.
-- Chaque appel cron (toutes les minutes) scanne toute la liste même quand 0 ligne expire.
-- Fix : index partiel B-tree sur expiration_at, restreint aux seules options actives.
-- Les deux fonctions bénéficient de cet index :
--   - expire_active_options  : expiration_at <= now()
--   - notify_options_expiring_soon : expiration_at BETWEEN now() AND now() + 24h
CREATE INDEX IF NOT EXISTS idx_reservations_active_options_expiring
  ON reservations (expiration_at)
  WHERE type = 'OPTION' AND statut = 'OPTION_ACTIVE' AND archived_at IS NULL;

-- ── 2. Index déduplication notifications ──────────────────────────────────────
-- Problème : les 3 fonctions notify_* font un LEFT JOIN anti-doublon sur notifications :
--   LEFT JOIN notifications n
--     ON n.user_id = ? AND n.type = ? AND n.entity_type = ? AND n.entity_id = ?
--   WHERE n.id IS NULL
-- L'index existant idx_notifications_user_unread ne couvre que (user_id, read_at).
-- Chaque appel scanne une large portion de la table notifications par utilisateur.
-- Fix : index composite couvrant exactement les 4 colonnes du JOIN.
CREATE INDEX IF NOT EXISTS idx_notifications_dedup
  ON notifications (user_id, type, entity_type, entity_id);

-- ── 3. Index arrivées/départs demain (notify_taches_and_stays_watchlist) ──────
-- Problème : la fonction cherche les réservations arrivant/partant demain :
--   WHERE type = 'RESERVATION' AND statut = 'CONFIRMEE' AND archived_at IS NULL
--     AND (date_debut = current_date + 1 OR date_fin = current_date + 1)
-- Aucun index sur date_debut ou date_fin filtré par statut/type.
-- PostgreSQL fait deux index partiels en bitmap OR — nécessite deux index séparés.
CREATE INDEX IF NOT EXISTS idx_reservations_date_debut_confirmee
  ON reservations (date_debut)
  WHERE type = 'RESERVATION' AND statut = 'CONFIRMEE' AND archived_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_reservations_date_fin_confirmee
  ON reservations (date_fin)
  WHERE type = 'RESERVATION' AND statut = 'CONFIRMEE' AND archived_at IS NULL;

-- ── 4. Index requête PostgREST reservations ───────────────────────────────────
-- Problème : la query PostgREST filtre WHERE statut = $1 AND archived_at IS NULL.
-- L'index existant idx_reservations_statut ON (statut) ne filtre pas archived_at,
-- ce qui force un filtre supplémentaire ligne par ligne après l'index scan.
-- Fix : index partiel excluant les archives d'emblée.
CREATE INDEX IF NOT EXISTS idx_reservations_statut_non_archive
  ON reservations (statut)
  WHERE archived_at IS NULL;
