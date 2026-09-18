-- T2F: Server-side notification delivery
-- Threshold-crossing detection + notification queue + daily reminder helper.
-- Depends on: V1.1 schema (items.already_notified, profiles.notification_type,
--   profiles.reminder_time, profiles.language, push_subscriptions, household_members).

-- ══════════════════════════════════════════════════════════════
-- 1. Threshold-crossing trigger function
-- ══════════════════════════════════════════════════════════════
-- BEFORE UPDATE on items: when quantity crosses low_stock_threshold,
-- insert a pending notification row and toggle already_notified.

create or replace function public.notify_threshold_crossing()
returns trigger
language plpgsql
set search_path = ''
as $$
declare
  v_now timestamptz := now();
begin
  -- Quantity crossed DOWN through threshold (item needs buying)
  if NEW.quantity <= NEW.low_stock_threshold
     and NEW.already_notified = false
     and (OLD.quantity > OLD.low_stock_threshold or OLD.already_notified = false)
  then
    NEW.already_notified := true;
    insert into public.pending_notifications
      (household_id, item_id, quantity, threshold, actor_id, created_at)
    values
      (NEW.household_id, NEW.id, NEW.quantity, NEW.low_stock_threshold,
       auth.uid(), v_now);

  -- Quantity crossed UP above threshold (item restocked)
  elsif NEW.quantity > NEW.low_stock_threshold
        and OLD.already_notified = true
  then
    NEW.already_notified := false;
  end if;

  return NEW;
end;
$$;

-- Trigger (AFTER UPDATE OF quantity so before-update audit trigger fires first)
drop trigger if exists notify_threshold_crossing on public.items;
create trigger notify_threshold_crossing
  before update of quantity on public.items
  for each row execute function public.notify_threshold_crossing();

-- Revoke from client roles (internal only, like other trigger functions)
revoke all on function public.notify_threshold_crossing() from public, anon, authenticated;

-- ══════════════════════════════════════════════════════════════
-- 1b. Threshold-crossing on item INSERT
-- ══════════════════════════════════════════════════════════════
-- BEFORE INSERT on items: when a new item is created at or below its
-- threshold, insert a pending notification row and toggle already_notified,
-- mirroring the UPDATE logic above.
--
-- Seed guard: create_household seeds default items at quantity 0 while the
-- household has exactly one member (the creator). A pending row targeting
-- "non-acting members" would have no recipient, so those inserts are skipped —
-- this covers every create_household variant (V1.1 and item-fork) without
-- depending on the seed statement. Default-catalog seed rows are additionally
-- inserted with already_notified=true where the seed statement sets it.
--
-- SECURITY DEFINER is required here (unlike the UPDATE trigger): item
-- creation is a direct table insert by authenticated users, so without it
-- the trigger would fail writing to pending_notifications (no INSERT grant /
-- RLS). auth.uid() still returns the authenticated actor via the JWT GUC.

create or replace function public.notify_threshold_crossing_on_insert()
returns trigger
language plpgsql security definer set search_path = ''
as $$
declare
  v_now timestamptz := now();
begin
  if NEW.quantity <= NEW.low_stock_threshold
     and NEW.already_notified = false
     and exists (
       select 1 from public.household_members
       where household_id = NEW.household_id
         and user_id is distinct from auth.uid()
     )
  then
    NEW.already_notified := true;
    insert into public.pending_notifications
      (household_id, item_id, quantity, threshold, actor_id, created_at)
    values
      (NEW.household_id, NEW.id, NEW.quantity, NEW.low_stock_threshold,
       auth.uid(), v_now);
  end if;

  return NEW;
end;
$$;

create trigger notify_threshold_crossing_on_insert
  before insert on public.items
  for each row execute function public.notify_threshold_crossing_on_insert();

revoke all on function public.notify_threshold_crossing_on_insert() from public, anon, authenticated;

-- ══════════════════════════════════════════════════════════════
-- 2. pending_notifications table
-- ══════════════════════════════════════════════════════════════
-- Queue for notifications to be sent by the notify-thresholds edge function.
-- Rows are inserted by the trigger (threshold crossings) or by
-- enqueue_daily_reminders (daily reminder cron).
-- The edge function processes rows where processed_at is null, then sets
-- processed_at = now().

create table public.pending_notifications (
  id            uuid primary key default gen_random_uuid(),
  household_id  uuid not null references public.households(id) on delete cascade,
  -- Deferrable: the BEFORE INSERT trigger inserts a row here referencing NEW.id
  -- before the parent items row exists. A non-deferrable FK would check at the
  -- end of that nested INSERT statement and fail; deferring the check to commit
  -- lets the parent row land first (the constraint is still enforced).
  item_id       uuid references public.items(id) on delete set null deferrable initially deferred,
  item_name     text not null default 'Rappel',
  quantity      numeric,
  threshold     numeric,
  actor_id      uuid references auth.users(id) on delete set null,
  target_user_id uuid references auth.users(id) on delete set null,
  created_at    timestamptz not null default now(),
  processed_at  timestamptz
);

comment on table public.pending_notifications is
  'Notification queue: threshold crossings (actor_id set, target_user_id null → non-acting member) '
  'and daily reminders (target_user_id set → that member).';

alter table public.pending_notifications enable row level security;

create policy pending_notifications_select_member on public.pending_notifications
  for select to authenticated
  using (private.is_household_member(household_id));

create policy pending_notifications_delete_member on public.pending_notifications
  for delete to authenticated
  using (private.is_household_member(household_id));

-- Grant select/delete to authenticated (members can view/delete their household rows for debugging/UI)
-- No insert/update grants: only trigger + edge function write to this table.
-- id is generated server-side; created_at has a default; timestamps not writable by clients.
revoke all on table public.pending_notifications from authenticated;
grant select on table public.pending_notifications to authenticated;
grant delete on table public.pending_notifications to authenticated;

-- Index for the edge function's main query (unprocessed rows)
create index pending_notifications_unprocessed_idx
  on public.pending_notifications (created_at)
  where processed_at is null;

-- ══════════════════════════════════════════════════════════════
-- 3. Daily reminder helper function
-- ══════════════════════════════════════════════════════════════
-- Enqueues a per-user pending notification for every member whose
-- profiles.reminder_time matches p_at_time (not NULL-skewed — NULLs are
-- skipped by the equality filter) AND whose household has at least one
-- to-buy item (quantity <= low_stock_threshold).
--
-- target_user_id is set to the specific member, so the edge function
-- notifies ONLY that member (not all household members).
--
-- reminder_time is stored as a plain time (no per-user timezone), so the
-- caller must pass the time in UTC. Documented in functions/README.md.
--
-- Dedup: at most one unprocessed reminder per (household, user) within 24h,
-- so a cron that fires several times per matching hour cannot double-send.
--
-- Designed to be called by pg_cron (once daily) or via the edge function's
-- /daily-reminders HTTP endpoint.

create or replace function public.enqueue_daily_reminders(p_at_time time default now()::time)
returns void
language plpgsql
set search_path = ''
as $$
declare
  member_rec record;
  to_buy_count bigint;
begin
  for member_rec in
    select hm.user_id, hm.household_id
    from public.household_members hm
    join public.profiles p on p.id = hm.user_id
    where p.notification_type in ('push', 'both')
      and p.reminder_time = p_at_time
  loop
    -- Check if any to-buy items exist for this household
    select count(*) into to_buy_count
    from public.items i
    where i.household_id = member_rec.household_id
      and i.quantity <= i.low_stock_threshold;

    if to_buy_count = 0 then
      continue;
    end if;

    -- Check if this member already has an unprocessed reminder in the last 24h
    if exists (
      select 1 from public.pending_notifications pn
      where pn.household_id = member_rec.household_id
        and pn.target_user_id = member_rec.user_id
        and pn.processed_at is null
        and pn.created_at > now() - interval '24 hours'
    ) then
      continue;
    end if;

    -- Enqueue one reminder for this member (target_user_id → only this member)
    insert into public.pending_notifications
      (household_id, item_id, item_name, quantity, threshold, actor_id, target_user_id, created_at)
    values
      (member_rec.household_id, null, 'Rappel',
       to_buy_count, null, null, member_rec.user_id, now());
  end loop;
end;
$$;

-- Internal-only (invoked by cron or the edge function's service role)
revoke all on function public.enqueue_daily_reminders(time) from public, anon, authenticated;

-- ══════════════════════════════════════════════════════════════
-- 3b. GDPR account sweep (7-day deferred deletion)
-- ══════════════════════════════════════════════════════════════
-- Deletes users whose profiles.deleted_at is older than 7 days, completing
-- the deferred-deletion flow (see src/lib/account.ts and the
-- member-gdpr-sweep edge function).
--
-- Deleting the auth.users row cleans up every dependent row via FK actions:
--   profiles / household_members / push_subscriptions / created invitations → CASCADE
--   history.performed_by, invitations.consumed_by, pending_notifications
--   actor_id / target_user_id → SET NULL
--   items.last_modified_by → NO ACTION, hence nulled first below.
--
-- RLS-bypassing: SECURITY DEFINER owned by the migration user, revoked from
-- client roles, granted only to the service role used by the edge function.

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

revoke all on function public.sweep_fully_deleted_members() from public, anon, authenticated;
grant execute on function public.sweep_fully_deleted_members() to service_role;

-- ══════════════════════════════════════════════════════════════
-- 4. pg_cron schedule (requires pg_cron extension)
-- ══════════════════════════════════════════════════════════════
-- Uncomment the following block where pg_cron is available.
-- Runs daily at 08:00 UTC. Adjust the schedule to match the desired timezone.
--
-- SELECT cron.schedule(
--   'daily-grocery-reminder',
--   '0 8 * * *',
--   $$ SELECT public.enqueue_daily_reminders(); $$
-- );
--
-- NOTE: pg_cron is NOT available on all Supabase plans. If unavailable,
-- use the notify-thresholds edge function's /daily-reminders endpoint
-- with an external cron service (e.g., cron-job.org, GitHub Actions).
