-- Ticket #106: RLS + invitations + egalite (cap 2, 24h)
-- PRD v1.4 §4.2/§4.8/§5/§11. Forward-only, idempotent convergence migration.
--
-- Prod divergente (cf ticket): grants anon, WITH CHECK(true), TO PUBLIC,
-- invitations sans policy. This migration re-asserts the canonical state so a
-- prod that never applied the secure-household migrations converges:
--   1. DROP legacy INSERT policy "Users can insert households they belong to"
--      (WITH CHECK(true)) + any other legacy PUBLIC/anon policies, via a generic
--      pg_policies purge (TO PUBLIC / TO anon roles or WITH CHECK(true)) on top
--      of the named legacy drops. Canonical policies are all TO authenticated
--      with real WITH CHECK expressions, so the generic loop drops nothing on a
--      converged chain.
--   1b. REVOKE ALL ON ALL TABLES IN SCHEMA public FROM PUBLIC (generic proof
--      of convergence) + targeted anon revokes incl. units.
--   2. Revoke ALL table grants from anon (0 grant anon checklist).
--   3. household_invitations stays function-only: DROP every policy on it
--      (zero-policy), REVOKE ALL from anon/authenticated/public (no grants).
--   4. Egalite (PRD §11): drop unused private.is_household_owner(uuid) and the
--      single-owner unique index. No policy/RPC references owner anymore; the
--      inert `role` value is kept for backwards compat (contract + UI labels)
--      but confers no privilege.
--   5. Cap 2 (PRD §4.2, §8 P0-6): explicit full-household guard in
--      consume_household_invitation BEFORE the validity (22023) and lockout
--      (P0001) checks, raising 23505 'household is full' (UI maps to
--      foyer-complet). A still-live invitation is auto-invalidated at once
--      (consumed_at/consumed_by set, PRD « automatiquement invalides ») so it
--      stays unusable after a departure without regen. The DB trigger
--      remains as a second line of defence. Unknown tokens (no row, no
--      household to check) stay 22023.
--   6. Expiry 24h STRICT (PRD §4.2/§5: « expire après 24 heures »): any
--      p_expires_in above 24 hours is rejected (22023). The 30-day bound from
--      earlier migrations is retired, not clamped.
--   7. Realtime publication re-asserted to exactly {categories, items}.
--
-- No db push prod from here; CI database job (security_contract.sql) is the
-- verification signal.

create extension if not exists pgcrypto;

-- ── 1. Drop legacy PUBLIC policies (initial_schema) ──────────────────────────
drop policy if exists "Users can insert households they belong to" on public.households;
drop policy if exists "Users can view their own households" on public.households;
drop policy if exists "Users can view their own membership" on public.household_members;
drop policy if exists "Users can join households" on public.household_members;
drop policy if exists "Users can view categories in their households" on public.categories;
drop policy if exists "Users can manage categories in their households" on public.categories;
drop policy if exists "Users can view items in their households" on public.items;
drop policy if exists "Users can manage items in their households" on public.items;
drop policy if exists "Authenticated users can view units" on public.units;
drop policy if exists "Users can manage their own push subscriptions" on public.push_subscriptions;
-- Owner-only policy superseded by the member-gated one (v1.1 §24); re-drop for
-- prod convergence in case the secure-household migration never applied.
drop policy if exists households_update_owner on public.households;

-- ── 1b. Generic convergence proof: no PUBLIC surface ────────────────────────
-- Belt-and-suspenders on top of the named drops above: revoke every grant
-- ever given TO PUBLIC on any public table, and drop any policy still
-- targeting the PUBLIC or anon role or carrying a bare WITH CHECK (true).
-- Canonical policies are all TO authenticated, so this is a no-op on a
-- converged chain. The anon arm is the symmetric pendant of the PUBLIC one:
-- any legacy/divergent anon-targeted policy fails the security-contract
-- pg_policies assert and is purged here.
revoke all on all tables in schema public from public;

do $$
declare r record;
begin
  for r in
    select schemaname, tablename, policyname from pg_policies
    where schemaname = 'public'
      and ('public' = any (roles) or 'anon' = any (roles) or with_check = 'true')
  loop
    execute format('drop policy if exists %I on %I.%I', r.policyname, r.schemaname, r.tablename);
  end loop;
end;
$$;

-- ── 2. Zero-policy invitations (function-only) ───────────────────────────────
do $$
declare r record;
begin
  for r in
    select policyname from pg_policies
    where schemaname = 'public' and tablename = 'household_invitations'
  loop
    execute format('drop policy if exists %I on public.household_invitations', r.policyname);
  end loop;
end;
$$;

alter table public.household_invitations enable row level security;
revoke all on table public.household_invitations from public, anon, authenticated;

-- ── 3. Zero anon grants (checklist §8) ───────────────────────────────────────
revoke all on table public.households from anon;
revoke all on table public.household_members from anon;
revoke all on table public.categories from anon;
revoke all on table public.items from anon;
revoke all on table public.profiles from anon;
revoke all on table public.household_invitations from anon;
revoke all on table public.push_subscriptions from anon;
revoke all on table public.history from anon;
revoke all on table public.category_positions from anon;
revoke all on table public.default_categories from anon;
revoke all on table public.item_templates from anon;
revoke all on table public.pending_notifications from anon;
revoke all on table public.units from anon;

-- ── 4. Retirer owner (PRD §11): helper + index, both unreferenced ────────────
-- All policies/RPCs gate on private.is_household_member (equality). The helper
-- below is dead code since v1.1 §24; dropping prevents any future owner gate.
drop function if exists private.is_household_owner(uuid);
drop index if exists public.household_one_owner_idx;

-- ── 5. Lockout columns (idempotent; added in v1.1 §23) ──────────────────────
alter table public.household_invitations
  add column if not exists failed_attempts int not null default 0,
  add column if not exists blocked_until timestamptz;

-- ── 6. create_household_invitation: member-gated, 24h STRICT, regen retires ─
-- Any member (egalite); lifetime capped at 24h strict (PRD §4.2/§5, 22023
-- beyond); creating retires the previous live invitation (regen+confirmation
-- UI-side, invalidation DB-side).
create or replace function public.create_household_invitation(
  p_household_id uuid,
  p_expires_in interval default interval '24 hours'
) returns table (invitation_id uuid, token text, expires_at timestamptz)
language plpgsql security definer set search_path = ''
as $$
declare
  actor uuid := auth.uid();
  raw_token text;
  chars text := 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
  i int;
  v int;
begin
  if actor is null then raise exception 'authentication required' using errcode = '42501'; end if;
  if not private.is_household_member(p_household_id) then raise exception 'household member required' using errcode = '42501'; end if;
  if p_expires_in <= interval '0 seconds' or p_expires_in > interval '24 hours' then
    raise exception 'invitation lifetime must be between 0 and 24 hours' using errcode = '22023';
  end if;

  -- Retire any existing live invitation for this household
  update public.household_invitations
  set revoked_at = now()
  where household_id = p_household_id
    and revoked_at is null
    and consumed_at is null
    and household_invitations.expires_at > now();

  -- 8-char alphanumeric token via CSPRNG with rejection sampling (no mod bias)
  raw_token := '';
  for i in 1..8 loop
    loop
      v := get_byte(extensions.gen_random_bytes(1), 0);
      exit when v < length(chars) * 4;
    end loop;
    raw_token := raw_token || substr(chars, (v % length(chars)) + 1, 1);
  end loop;

  return query
  insert into public.household_invitations (household_id, token_hash, created_by, expires_at)
  values (p_household_id, sha256(convert_to(raw_token, 'UTF8')), actor, now() + p_expires_in)
  returning id, raw_token, household_invitations.expires_at;
end;
$$;

-- ── 7. revoke/get: member-gated (egalite, PRD §11) ───────────────────────────
create or replace function public.revoke_household_invitation(p_invitation_id uuid) returns boolean
language plpgsql security definer set search_path = ''
as $$
declare affected integer;
begin
  if auth.uid() is null then raise exception 'authentication required' using errcode = '42501'; end if;
  update public.household_invitations i set revoked_at = now()
  where i.id = p_invitation_id and i.revoked_at is null and i.consumed_at is null
    and private.is_household_member(i.household_id);
  get diagnostics affected = row_count;
  return affected = 1;
end;
$$;

create or replace function public.get_household_invitation(p_household_id uuid)
returns table (
  invitation_id uuid,
  created_at timestamptz,
  expires_at timestamptz,
  revoked_at timestamptz,
  consumed_at timestamptz
)
language plpgsql security definer set search_path = ''
as $$
begin
  if auth.uid() is null then raise exception 'authentication required' using errcode = '42501'; end if;
  if not private.is_household_member(p_household_id) then raise exception 'household member required' using errcode = '42501'; end if;
  return query
  select i.id, i.created_at, i.expires_at, i.revoked_at, i.consumed_at
  from public.household_invitations i
  where i.household_id = p_household_id
  order by i.created_at desc
  limit 1;
end;
$$;

-- ── 8. consume: CAP 2 (23505, priority) → lockout (P0001) → validity (22023) ──
-- PRD §4.2 + §8 P0-6: a full household (2/2) rejects every KNOWN token with
-- 23505 'household is full' (UI maps to foyer-complet), ahead of the 22023
-- validity and P0001 lockout checks. A still-live invitation is
-- auto-invalidated at once (PRD « automatiquement invalides »): consumed_at
-- + consumed_by are set (the pair satisfies the consumption CHECK), so the
-- row stays unusable after a departure without regen. Already-invalid rows
-- are left untouched; unknown tokens (no row) stay 22023.
create or replace function public.consume_household_invitation(p_token text) returns uuid
language plpgsql security definer set search_path = ''
as $$
declare
  actor uuid := auth.uid();
  invitation public.household_invitations%rowtype;
  v_now timestamptz := now();
begin
  if actor is null then raise exception 'authentication required' using errcode = '42501'; end if;
  if exists (select 1 from public.household_members where user_id = actor) then
    raise exception 'user already belongs to a household' using errcode = '23505';
  end if;

  select * into invitation from public.household_invitations
  where token_hash = sha256(convert_to(btrim(p_token), 'UTF8')) for update;

  -- Unknown token: nothing to increment, stays a plain invalid-token error
  if not found then
    raise exception 'invitation is invalid or unavailable' using errcode = '22023';
  end if;

  -- Cap 2: foyer complet — reject before validity/lockout, auto-invalidate
  -- the live row (trigger remains as backstop for the membership insert).
  if (select count(*) from public.household_members where household_id = invitation.household_id) >= 2 then
    if invitation.revoked_at is null and invitation.consumed_at is null and invitation.expires_at > v_now then
      update public.household_invitations
      set consumed_at = v_now, consumed_by = actor
      where id = invitation.id;
    end if;
    raise exception 'household is full' using errcode = '23505';
  end if;

  -- Server-side lockout: previously blocked via failed_attempts
  if invitation.blocked_until is not null and invitation.blocked_until > v_now then
    raise exception 'invitation is temporarily locked' using errcode = 'P0001';
  end if;

  -- Known but invalid token: count the attempt, block after 5
  if invitation.revoked_at is not null or invitation.consumed_at is not null or invitation.expires_at <= v_now then
    update public.household_invitations
    set failed_attempts = failed_attempts + 1,
        blocked_until = case
          when failed_attempts + 1 >= 5 then v_now + interval '1 minute'
          else blocked_until
        end
    where id = invitation.id;
    raise exception 'invitation is invalid or unavailable' using errcode = '22023';
  end if;

  -- Valid live invitation: consume and reset the try counter
  insert into public.household_members (household_id, user_id, role)
  values (invitation.household_id, actor, 'member');
  update public.household_invitations
  set consumed_at = v_now, consumed_by = actor,
      failed_attempts = 0, blocked_until = null
  where id = invitation.id;
  return invitation.household_id;
end;
$$;

-- ── 9. Function grants: TO authenticated only (0 anon, 0 PUBLIC) ─────────────
revoke all on function public.create_household(text) from public, anon, authenticated;
revoke all on function public.create_household_invitation(uuid, interval) from public, anon, authenticated;
revoke all on function public.revoke_household_invitation(uuid) from public, anon, authenticated;
revoke all on function public.consume_household_invitation(text) from public, anon, authenticated;
revoke all on function public.get_household_invitation(uuid) from public, anon, authenticated;
revoke all on function public.adjust_item_quantity(uuid, numeric) from public, anon, authenticated;
grant execute on function public.create_household(text) to authenticated;
grant execute on function public.create_household_invitation(uuid, interval) to authenticated;
grant execute on function public.revoke_household_invitation(uuid) to authenticated;
grant execute on function public.consume_household_invitation(text) to authenticated;
grant execute on function public.get_household_invitation(uuid) to authenticated;
grant execute on function public.adjust_item_quantity(uuid, numeric) to authenticated;

-- ── 10. Realtime = {categories, items} exactly ───────────────────────────────
do $$
declare realtime_table text;
begin
  foreach realtime_table in array array['categories', 'items'] loop
    if not exists (
      select 1 from pg_publication_tables
      where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = realtime_table
    ) then
      execute format('alter publication supabase_realtime add table public.%I', realtime_table);
    end if;
  end loop;
  foreach realtime_table in array array[
    'households', 'household_members', 'profiles', 'household_invitations',
    'push_subscriptions', 'units', 'history', 'category_positions',
    'default_categories', 'item_templates', 'pending_notifications'
  ] loop
    if exists (
      select 1 from pg_publication_tables
      where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = realtime_table
    ) then
      execute format('alter publication supabase_realtime drop table public.%I', realtime_table);
    end if;
  end loop;
end;
$$;

notify pgrst, 'reload schema';
