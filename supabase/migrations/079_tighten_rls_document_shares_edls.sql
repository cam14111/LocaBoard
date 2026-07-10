-- 077 : Durcissement RLS
-- 1. document_shares : la lecture publique permettait d'énumérer tous les liens
--    de partage (l'UUID du partage sert de jeton d'accès via doc-redirect).
--    L'edge function doc-redirect utilise la service key et n'est pas affectée.
-- 2. edls : la policy fourre-tout « authenticated ALL » permettait à tout
--    utilisateur connecté de modifier/supprimer n'importe quel EDL.
-- 3. edl_items INSERT / documents UPDATE / notifications INSERT : mêmes causes.
-- 4. logement_pieces / logement_saisons : lecture limitée aux membres du logement.
-- 5. Fonctions trigger : EXECUTE révoqué pour les rôles API (l'exécution des
--    triggers n'en dépend pas, la vérification a lieu au CREATE TRIGGER).

-- ── 1. document_shares ────────────────────────────────────────────────
drop policy if exists "Public read document_shares" on public.document_shares;
drop policy if exists "Auth insert document_shares" on public.document_shares;

create policy document_shares_insert_scoped on public.document_shares
  for insert to authenticated
  with check (
    (public.is_admin() or public.current_user_role() = 'COHOTE'::user_role)
    and exists (
      select 1 from public.documents d
      where d.storage_path = document_shares.storage_path
        and public.can_access_dossier(d.dossier_id)
    )
  );

-- SELECT nécessaire pour INSERT ... RETURNING id (createDocumentShareLink)
create policy document_shares_select_scoped on public.document_shares
  for select to authenticated
  using (
    public.is_admin()
    or exists (
      select 1 from public.documents d
      where d.storage_path = document_shares.storage_path
        and public.can_access_dossier(d.dossier_id)
    )
  );

create policy document_shares_delete_admin on public.document_shares
  for delete to authenticated
  using (public.is_admin());

-- ── 2. edls ───────────────────────────────────────────────────────────
drop policy if exists edls_authenticated on public.edls;

create policy edls_select_access on public.edls
  for select to authenticated
  using (public.can_access_dossier(dossier_id));

create policy edls_insert_access on public.edls
  for insert to authenticated
  with check (public.can_access_dossier(dossier_id));

create policy edls_update_access on public.edls
  for update to authenticated
  using (public.can_access_dossier(dossier_id))
  with check (public.can_access_dossier(dossier_id));

create policy edls_delete_admin on public.edls
  for delete to authenticated
  using (public.is_admin());

-- ── 3a. edl_items : INSERT limité aux EDL accessibles ─────────────────
drop policy if exists edl_items_insert_admin_or_cohote on public.edl_items;

create policy edl_items_insert_access on public.edl_items
  for insert to authenticated
  with check (public.can_access_edl(edl_id));

-- ── 3b. documents : UPDATE limité (archivage lors d'un remplacement) ──
drop policy if exists documents_update on public.documents;

create policy documents_update_scoped on public.documents
  for update to authenticated
  using (
    public.is_admin()
    or (public.current_user_role() = 'COHOTE'::user_role
        and public.can_access_dossier(dossier_id))
  )
  with check (
    public.is_admin()
    or (public.current_user_role() = 'COHOTE'::user_role
        and public.can_access_dossier(dossier_id))
  );

-- ── 3c. notifications : l'INSERT passe exclusivement par la RPC
--        create_notification (SECURITY DEFINER), la policy ouverte est inutile.
drop policy if exists notif_insert_authenticated on public.notifications;

-- ── 4. logement_pieces / logement_saisons : lecture scoped ────────────
do $$
declare r record;
begin
  for r in
    select tablename, policyname from pg_policies
    where schemaname = 'public'
      and tablename in ('logement_pieces', 'logement_saisons')
      and cmd = 'SELECT'
  loop
    execute format('drop policy %I on public.%I', r.policyname, r.tablename);
  end loop;
end $$;

create policy logement_pieces_select_access on public.logement_pieces
  for select to authenticated
  using (public.can_access_logement(logement_id));

create policy logement_saisons_select_access on public.logement_saisons
  for select to authenticated
  using (public.can_access_logement(logement_id));

-- ── 5. Fonctions trigger : retirer EXECUTE des rôles API ──────────────
do $$
declare fn text;
begin
  foreach fn in array array[
    'enforce_cohote_edl_update',
    'enforce_cohote_task_update',
    'ensure_dossier_for_confirmed_reservation',
    'restrict_user_self_updates',
    'trg_dossier_cancel_open_taches',
    'trg_dossiers_auto_edls',
    'validate_tache_references'
  ]
  loop
    if exists (
      select 1 from pg_proc p join pg_namespace n on n.oid = p.pronamespace
      where n.nspname = 'public' and p.proname = fn
    ) then
      execute format('revoke execute on function public.%I() from authenticated, anon, public', fn);
    end if;
  end loop;
end $$;
