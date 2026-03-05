-- Migration 032 : Correction des performances RLS (Supabase Performance Advisor)
-- Résout deux catégories de problèmes :
--   1. auth_rls_initplan : auth.uid()/auth.role() appelés sans sous-select → réévalués par ligne
--   2. multiple_permissive_policies : policies redondantes sur la même table/rôle/action
-- Cause : accumulation de migrations correctrices + policies créées directement dans le dashboard.

-- ─── 1. edls : supprimer la policy FOR ALL redondante ─────────────────────────
-- "EDL: écriture authentifié" (FOR ALL, auth.uid() IS NOT NULL) est entièrement couverte
-- par les 4 policies granulaires : edls_select_access, edls_insert_admin_or_cohote,
-- edls_update_admin_or_cohote, edls_delete_admin_only.

DROP POLICY IF EXISTS "EDL: écriture authentifié" ON public.edls;


-- ─── 2. edl_items : supprimer FOR ALL + redondants + fusionner SELECT ─────────

-- FOR ALL redondant (remplacé par les policies granulaires)
DROP POLICY IF EXISTS "EDL items: écriture authentifié" ON public.edl_items;

-- edl_items_insert_admin_only est un sous-ensemble de edl_items_insert_admin_or_cohote
DROP POLICY IF EXISTS edl_items_insert_admin_only ON public.edl_items;

-- edl_items_update_admin_only est un sous-ensemble de edl_items_update_admin_or_cohote
DROP POLICY IF EXISTS edl_items_update_admin_only ON public.edl_items;

-- Fusion des deux policies SELECT en une seule
DROP POLICY IF EXISTS edl_items_select_access ON public.edl_items;
DROP POLICY IF EXISTS edl_items_select_by_dossier_membership ON public.edl_items;
CREATE POLICY edl_items_select ON public.edl_items
  FOR SELECT USING (
    can_access_edl(edl_id)
    OR is_admin()
    OR EXISTS (
      SELECT 1
      FROM edls e
      JOIN dossiers d ON d.id = e.dossier_id
      JOIN logement_users lu ON lu.logement_id = d.logement_id
      JOIN users u ON u.id = lu.user_id
      WHERE e.id = edl_items.edl_id
        AND d.archived_at IS NULL
        AND lower(u.email) = current_auth_email()
        AND u.archived_at IS NULL
    )
  );


-- ─── 3. incidents : supprimer INSERT redondant + fusionner SELECT ──────────────

-- incidents_insert_admin_only est un sous-ensemble de incidents_insert_admin_or_cohote
DROP POLICY IF EXISTS incidents_insert_admin_only ON public.incidents;

-- Fusion des deux policies SELECT
DROP POLICY IF EXISTS incidents_select_access ON public.incidents;
DROP POLICY IF EXISTS incidents_select_by_dossier_membership ON public.incidents;
CREATE POLICY incidents_select ON public.incidents
  FOR SELECT USING (
    can_access_dossier(dossier_id)
    OR is_admin()
    OR EXISTS (
      SELECT 1
      FROM dossiers d
      JOIN logement_users lu ON lu.logement_id = d.logement_id
      JOIN users u ON u.id = lu.user_id
      WHERE d.id = incidents.dossier_id
        AND d.archived_at IS NULL
        AND lower(u.email) = current_auth_email()
        AND u.archived_at IS NULL
    )
  );


-- ─── 4. incident_photos : supprimer INSERT redondant + fusionner SELECT ────────

-- incident_photos_insert_admin_only est un sous-ensemble de incident_photos_insert_admin_or_cohote
DROP POLICY IF EXISTS incident_photos_insert_admin_only ON public.incident_photos;

-- Fusion des deux policies SELECT
DROP POLICY IF EXISTS incident_photos_select_access ON public.incident_photos;
DROP POLICY IF EXISTS incident_photos_select_by_dossier_membership ON public.incident_photos;
CREATE POLICY incident_photos_select ON public.incident_photos
  FOR SELECT USING (
    (EXISTS (
      SELECT 1 FROM incidents i
      WHERE i.id = incident_photos.incident_id
        AND can_access_dossier(i.dossier_id)
    ))
    OR is_admin()
    OR (EXISTS (
      SELECT 1
      FROM incidents i
      JOIN dossiers d ON d.id = i.dossier_id
      JOIN logement_users lu ON lu.logement_id = d.logement_id
      JOIN users u ON u.id = lu.user_id
      WHERE i.id = incident_photos.incident_id
        AND d.archived_at IS NULL
        AND lower(u.email) = current_auth_email()
        AND u.archived_at IS NULL
    ))
  );


-- ─── 5. notifications : supprimer doublons + fix auth.uid()/auth.role() ────────
-- notif_select_own est un sous-ensemble de notifications_select_own (qui ajoute service_role)
-- notif_update_own est un sous-ensemble de notifications_update_own
-- "Notifications: suppression propre" est identique à notif_delete_own

DROP POLICY IF EXISTS "Notifications: suppression propre" ON public.notifications;
DROP POLICY IF EXISTS notif_select_own ON public.notifications;
DROP POLICY IF EXISTS notif_update_own ON public.notifications;

DROP POLICY IF EXISTS notif_insert_authenticated ON public.notifications;
CREATE POLICY notif_insert_authenticated ON public.notifications
  FOR INSERT WITH CHECK ((select auth.uid()) IS NOT NULL);

DROP POLICY IF EXISTS notif_delete_own ON public.notifications;
CREATE POLICY notif_delete_own ON public.notifications
  FOR DELETE USING (user_id = (select auth.uid()));

-- notifications_select_own : couvre les users ET le service_role (Edge Functions)
DROP POLICY IF EXISTS notifications_select_own ON public.notifications;
CREATE POLICY notifications_select_own ON public.notifications
  FOR SELECT USING (
    (select auth.role()) = 'service_role'::text
    OR user_id = (select auth.uid())
  );

DROP POLICY IF EXISTS notifications_update_own ON public.notifications;
CREATE POLICY notifications_update_own ON public.notifications
  FOR UPDATE
  USING (
    (select auth.role()) = 'service_role'::text
    OR user_id = (select auth.uid())
  )
  WITH CHECK (
    (select auth.role()) = 'service_role'::text
    OR user_id = (select auth.uid())
  );


-- ─── 6. push_subscriptions : fix auth.uid() ───────────────────────────────────

DROP POLICY IF EXISTS users_manage_own_push_subscriptions ON public.push_subscriptions;
CREATE POLICY users_manage_own_push_subscriptions ON public.push_subscriptions
  FOR ALL
  USING (user_id = (select auth.uid()))
  WITH CHECK (user_id = (select auth.uid()));


-- ─── 7. document_shares : fix auth.uid() ──────────────────────────────────────

DROP POLICY IF EXISTS "Auth insert document_shares" ON public.document_shares;
CREATE POLICY "Auth insert document_shares" ON public.document_shares
  FOR INSERT WITH CHECK ((select auth.uid()) IS NOT NULL);


-- ─── 8. documents INSERT : fusionner les deux policies ────────────────────────
-- "Documents: cohote insert edl ou contrat" (migration 030) : COHOTE peut insérer EDL/CONTRAT
--   sans vérification d'accès au dossier.
-- documents_insert_admin_or_cohote_edl (dashboard) : ADMIN avec dossier-check,
--   ou COHOTE pour EDL uniquement avec dossier-check.
-- Fusion : COHOTE garde le droit CONTRAT et hérite du dossier-check (renforcement sécurité).

DROP POLICY IF EXISTS "Documents: cohote insert edl ou contrat" ON public.documents;
DROP POLICY IF EXISTS documents_insert_admin_or_cohote_edl ON public.documents;
CREATE POLICY documents_insert ON public.documents
  FOR INSERT WITH CHECK (
    (is_admin() AND can_access_dossier(dossier_id))
    OR (
      current_user_role() = 'COHOTE'::user_role
      AND type = ANY (ARRAY['EDL'::document_type, 'CONTRAT'::document_type])
      AND uploaded_by_user_id = current_app_user_id()
      AND can_access_dossier(dossier_id)
    )
  );


-- ─── 9. taches UPDATE : fusionner 3 policies en 1 ────────────────────────────
-- "Tâches: update authentifié" (trop permissive : tout authentifié) → supprimée.
-- taches_update_admin_only + taches_update_assignee_cohote → fusionnées.
-- Comportement : seuls l'admin et le co-hôte assigné peuvent modifier une tâche.

DROP POLICY IF EXISTS "Tâches: update authentifié" ON public.taches;
DROP POLICY IF EXISTS taches_update_admin_only ON public.taches;
DROP POLICY IF EXISTS taches_update_assignee_cohote ON public.taches;
CREATE POLICY taches_update ON public.taches
  FOR UPDATE
  USING (
    is_admin()
    OR ((current_user_role() = 'COHOTE'::user_role) AND (assignee_user_id = current_app_user_id()))
  )
  WITH CHECK (
    is_admin()
    OR ((current_user_role() = 'COHOTE'::user_role) AND (assignee_user_id = current_app_user_id()))
  );

NOTIFY pgrst, 'reload schema';
