-- Ticket #110 — Compte/foyer lifecycle : quitter, soft-delete 7j, cascade orphelin
-- PRD v1.4 §4.8 (quitter : perd accès, autre garde intact indéfini) / §4.9
-- (suppression = logique quitter + rétention 7j RGPD + annulation par
-- reconnexion, implémentation deleted_at + cron purge) / §5 (cascade
-- ON DELETE CASCADE custom + items + history si 0 membre ; ITEM_TEMPLATES +
-- défauts jamais affectés). Forward-only, idempotent, worktree seul
-- (sans commit/push/merge).
--
-- Contenu (DB seule, RLS inchangée) :
--   0. profiles.deleted_at : convergence (ADD IF NOT EXISTS, nullable, sans
--      défaut). Posé par l'app à la suppression, remis à NULL à la
--      reconnexion <7j (annulation), purgé par le sweep au-delà. La prod
--      divergente (ancien modèle sans deleted_at, cf audit H5/C3) converge
--      ici ; grant update(deleted_at) TO authenticated ré-asserté.
--   1. leave_household() : RPC SECURITY DEFINER, TO authenticated seul.
--      Supprime la seule appartenance de l'appelant — jamais celle d'autrui
--      (aucun paramètre, PRD §4.8 « un membre ne peut jamais retirer
--      l'autre »). Retourne true si un départ a eu lieu, false si l'appelant
--      était déjà hors foyer (idempotent). Le partant perd l'accès (RLS par
--      appartenance), l'autre membre garde tout sans limite de durée. Les
--      triggers AFTER DELETE existants s'appliquent tels quels : invalidation
--      des invitations live + cleanup orphelin si 0 membre.
--   2. Orphelin 0-membre : re-assert à l'identique de v1.1 §19
--      (cleanup_empty_household AFTER DELETE : items d'abord — la FK
--      composite catégorie est RESTRICT — puis catégories du foyer, puis
--      delete households qui cascade invitations/history/positions/
--      notifications). ITEM_TEMPLATES et default_categories n'ont aucun FK
--      foyer → jamais affectés (§5).
--   3. sweep_fully_deleted_members() : re-assert à l'identique de
--      20260916020000 §3b (cutoff strict >7j, SECURITY DEFINER, service_role
--      seul). La suppression auth.users cascade les memberships → le trigger
--      §2 purge le foyer devenu orphelin (chaîne complète, idempotente :
--      rejouer ne supprime rien de plus).
--
-- Verif CI : psql -v ON_ERROR_STOP=1 -f supabase/tests/database/security_contract.sql

-- ══════════════════════════════════════════════════════════════
-- 0. profiles.deleted_at : convergence idempotente (PRD §4.9)
-- ══════════════════════════════════════════════════════════════
-- La colonne existe depuis v1.1 §9 ; ce bloc ne fait que converger une prod
-- divergente (colonne absente) vers l'état canonique : nullable, sans défaut,
-- écrite par l'app (soft-delete / annulation par reconnexion).

alter table public.profiles add column if not exists deleted_at timestamptz;

comment on column public.profiles.deleted_at is
  'PRD §4.9 : soft-delete RGPD — posé par l''app à la suppression du compte, remis à NULL à la reconnexion <7j (annulation), purge définitive par sweep_fully_deleted_members() au-delà de 7j.';

grant update (deleted_at) on table public.profiles to authenticated;

-- ══════════════════════════════════════════════════════════════
-- 1. leave_household() : quitter le foyer (PRD §4.8)
-- ══════════════════════════════════════════════════════════════
-- Un seul DELETE sur sa propre ligne : structurellement incapable de retirer
-- l'autre membre. SECURITY DEFINER car household_members n'a aucun grant
-- DELETE client (SELECT seul) et aucune policy DELETE — sans RPC, quitter
-- serait impossible (42501). CREATE OR REPLACE préserve le grant posé
-- ci-dessous sur une chaîne convergée.

create or replace function public.leave_household() returns boolean
language plpgsql security definer set search_path = ''
as $$
begin
  if auth.uid() is null then raise exception 'authentication required' using errcode = '42501'; end if;
  delete from public.household_members where user_id = auth.uid();
  if found then return true; end if;
  return false;
end;
$$;

comment on function public.leave_household() is
  'PRD §4.8 : départ volontaire — true si une appartenance a été supprimée, false idempotent si déjà hors foyer. Le partant perd l''accès (RLS par appartenance), l''autre membre garde tout indéfiniment ; à 0 membre le trigger cleanup_empty_household purge le foyer.';

revoke all on function public.leave_household() from public, anon, authenticated;
grant execute on function public.leave_household() to authenticated;

-- ══════════════════════════════════════════════════════════════
-- 2. Orphelin 0-membre : cascade custom/items/history (PRD §5)
-- ══════════════════════════════════════════════════════════════
-- Re-assert à l'identique de 20260915000000_v1_1_schema.sql §19 (convergence
-- prod) : household_members n'ayant aucun grant DELETE client, seul le DELETE
-- de leave_household (§1) ou de la cascade sweep (§3) déclenche ce trigger.

create or replace function public.cleanup_empty_household() returns trigger
language plpgsql set search_path = ''
as $$
declare
  remaining_count int;
begin
  select count(*) into remaining_count
  from public.household_members
  where household_id = OLD.household_id;

  if remaining_count = 0 then
    -- Items first (ON DELETE RESTRICT on the composite category FK would block
    -- category removal); categories cascade into category_positions
    delete from public.items where household_id = OLD.household_id;
    delete from public.categories where household_id = OLD.household_id;
    -- Cascade removes invitations, history, category_positions, profiles leftovers
    delete from public.households where id = OLD.household_id;
  end if;

  return OLD;
end;
$$;

comment on function public.cleanup_empty_household() is
  'PRD §5 : foyer à 0 membre → purge custom/items/history via ON DELETE CASCADE du delete households ; ITEM_TEMPLATES et default_categories (sans FK foyer) intacts.';

revoke all on function public.cleanup_empty_household() from public, anon, authenticated;

drop trigger if exists household_orphan_cleanup on public.household_members;
create trigger household_orphan_cleanup after delete on public.household_members
for each row execute function public.cleanup_empty_household();

-- ══════════════════════════════════════════════════════════════
-- 3. sweep_fully_deleted_members() : purge cron >7j (PRD §4.9)
-- ══════════════════════════════════════════════════════════════
-- Re-assert à l'identique de 20260916020000_server_notifications.sql §3b
-- (convergence prod) : cutoff strictement supérieur à 7j
-- (p.deleted_at < now() - interval '7 days'), SECURITY DEFINER, service_role
-- seul (zéro anon/authenticated/PUBLIC). Appelé par l'edge
-- member-gdpr-sweep (CRON_SECRET obligatoire côté fonction).

create or replace function public.sweep_fully_deleted_members()
returns int
language plpgsql security definer set search_path = ''
as $$
declare
  v_cutoff timestamptz := now() - interval '7 days';
  v_deleted_users int := 0;
begin
  -- Remove NO ACTION references so the user row can be deleted (item audits)
  update public.items
  set last_modified_by = null
  where last_modified_by in (
    select u.id
    from auth.users u
    join public.profiles p on p.id = u.id
    where p.deleted_at < v_cutoff
  );

  -- Cascade-delete the user (profiles, memberships, subscriptions, invitations)
  delete from auth.users u
  using public.profiles p
  where p.id = u.id
    and p.deleted_at < v_cutoff;
  get diagnostics v_deleted_users = row_count;

  -- Orphan profiles whose auth row is already gone (defensive)
  delete from public.profiles p
  where p.deleted_at < v_cutoff
    and not exists (select 1 from auth.users u where u.id = p.id);

  return v_deleted_users;
end;
$$;

comment on function public.sweep_fully_deleted_members() is
  'PRD §4.9 : purge cron des comptes soft-deleted depuis plus de 7j (RGPD). Idempotent : rejouer sans nouveaux éligibles retourne 0.';

revoke all on function public.sweep_fully_deleted_members() from public, anon, authenticated;
grant execute on function public.sweep_fully_deleted_members() to service_role;

notify pgrst, 'reload schema';
