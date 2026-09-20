-- Ticket #108 — History trigger 20 + notifications sens unique (PRD v1.4 §4.6/§4.7/§5)
-- Résout #105 (history 42501) au passage. Forward-only, idempotent, worktree seul
-- (sans commit/push/merge).
--
-- Contenu :
--   0. Colonne items.already_notified : convergence (ADD IF NOT EXISTS, NOT NULL, défaut false).
--   1. Trigger AFTER INSERT rotation 21e : garde les 20 plus récentes du foyer
--      (LIMIT 19 -> 20 + tiebreak id déterministe). Sans achats (enum
--      action_type = {modification, suppression}), sans avant/après (aucune
--      colonne ajoutée — auteur+action+article+horodatage uniquement).
--   2. Seuils déjà en place (20260916 server_notifications) re-assertés à
--      l'identique : 1 notif/franchissement, reset au-dessus du seuil.
--   3. Policy INSERT history membres foyer + grants (fix #105 42501 : les
--      policies existaient mais aucun GRANT n'était posé sur history).
--   4. Grants TO authenticated seul (0 anon, 0 PUBLIC), realtime hors history.
--
-- Index couvrant le ORDER BY du trigger : T-B4 (bloqué par ce ticket), hors scope
-- ici — cf audit-performance F11. Pas d'enum ajouté -> pas de `notify pgrst`
-- requis pour le trigger, mais les grants changent -> `notify pgrst` conservé.
-- Verif CI : psql -v ON_ERROR_STOP=1 -f supabase/tests/database/security_contract.sql

-- ══════════════════════════════════════════════════════════════
-- 0. already_notified : convergence idempotente (PRD §5)
-- ══════════════════════════════════════════════════════════════
-- La colonne existe depuis v1.1 ; ce bloc ne fait que converger une prod
-- divergente (nullable/sans défaut) vers l'état canonique.

alter table public.items add column if not exists already_notified boolean not null default false;

update public.items set already_notified = false where already_notified is null;
alter table public.items alter column already_notified set not null;
alter table public.items alter column already_notified set default false;

comment on column public.items.already_notified is
  'PRD §4.6/§5 : true après un franchissement sous le seuil (1 notif), repasse à false dès que le stock redépasse le seuil. Server-controlled — jamais écrit par les clients.';

-- ══════════════════════════════════════════════════════════════
-- 1. Rotation AFTER INSERT : 21e action supprime la plus ancienne (PRD §4.7)
-- ══════════════════════════════════════════════════════════════
-- Fix : LIMIT 19 gardait 19 lignes au lieu de 20. Le trigger s'exécute APRÈS
-- l'insertion (NEW déjà comptée) : garder les 20 plus récentes = LIMIT 20.
-- Tiebreak id : ordre déterministe quand performed_at est égal (inserts en rafale).

create or replace function public.cap_history() returns trigger
language plpgsql set search_path = ''
as $$
begin
  delete from public.history
  where household_id = NEW.household_id
    and id not in (
      select id from public.history
      where household_id = NEW.household_id
      order by performed_at desc, id desc
      limit 20
    );
  return NEW;
end;
$$;

revoke all on function public.cap_history() from public, anon, authenticated;

drop trigger if exists history_cap_trigger on public.history;
create trigger history_cap_trigger after insert on public.history
for each row execute function public.cap_history();

comment on table public.history is
  'PRD §4.7/§5 : 20 dernières modifs/suppressions par foyer (jamais d''achats, jamais d''avant/après — auteur+action+article+horodatage). Rotation 21e via history_cap_trigger (AFTER INSERT).';

-- ══════════════════════════════════════════════════════════════
-- 2. Seuils : 1 notif/franchissement + reset (PRD §4.6/§5)
-- ══════════════════════════════════════════════════════════════
-- Re-assert à l'identique de 20260916020000_server_notifications.sql §1/§1b
-- (convergence prod) : franchissement bas -> already_notified=true + 1 ligne
-- pending (acteur enregistré, l'autre membre est notifié côté edge) ; remontée
-- au-dessus du seuil -> already_notified=false (prochain passage re-notifie).
-- Garde seed : à la création du foyer il n'y a pas d'autre membre à prévenir.

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

drop trigger if exists notify_threshold_crossing on public.items;
create trigger notify_threshold_crossing
  before update of quantity on public.items
  for each row execute function public.notify_threshold_crossing();

revoke all on function public.notify_threshold_crossing() from public, anon, authenticated;

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

drop trigger if exists notify_threshold_crossing_on_insert on public.items;
create trigger notify_threshold_crossing_on_insert
  before insert on public.items
  for each row execute function public.notify_threshold_crossing_on_insert();

revoke all on function public.notify_threshold_crossing_on_insert() from public, anon, authenticated;

-- ══════════════════════════════════════════════════════════════
-- 3. history : RLS + policies membres + grants (fix #105 42501)
-- ══════════════════════════════════════════════════════════════
-- Diagnostic #105 : les 3 policies membres existaient (v1.1 §12) mais aucun
-- GRANT n'a jamais été posé sur public.history -> tout accès client échouait
-- en 42501 (logItemHistory fire-and-forget, bruit e2e). Le trigger de rotation
-- supprime en tant qu'invocateur : le DELETE membre + son grant sont requis
-- pour que la 21e insertion purge l'ancienne. Pas de UPDATE (log immuable),
-- pas d'écriture id/performed_at (générés serveur).

alter table public.history enable row level security;

drop policy if exists history_select_member on public.history;
create policy history_select_member on public.history for select to authenticated
  using (private.is_household_member(household_id));

drop policy if exists history_insert_member on public.history;
create policy history_insert_member on public.history for insert to authenticated
  with check (private.is_household_member(household_id));

drop policy if exists history_delete_member on public.history;
create policy history_delete_member on public.history for delete to authenticated
  using (private.is_household_member(household_id));

revoke all on table public.history from public, anon;
revoke all on table public.history from authenticated;
grant select on table public.history to authenticated;
grant insert (household_id, performed_by, action_type, item_name) on table public.history to authenticated;
grant delete on table public.history to authenticated;

grant execute on function private.is_household_member(uuid) to authenticated;

-- ══════════════════════════════════════════════════════════════
-- 4. Grants TO authenticated seul (0 anon, 0 PUBLIC)
-- ══════════════════════════════════════════════════════════════
-- Re-assert items : already_notified reste server-controlled (absent des
-- listes INSERT/UPDATE client — seuls les triggers §2 l'écrivent).

revoke all on table public.items from public, anon;
revoke all on table public.items from authenticated;
grant select on table public.items to authenticated;
grant insert (household_id, category_id, name, quantity, unit, low_stock_threshold, template_id) on table public.items to authenticated;
grant update (name, category_id, unit, low_stock_threshold) on table public.items to authenticated;
grant delete on table public.items to authenticated;

revoke all on table public.history from anon;

-- history hors realtime (publication canonique = {categories, items}).
do $$
begin
  if exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'history'
  ) then
    execute 'alter publication supabase_realtime drop table public.history';
  end if;
end;
$$;

notify pgrst, 'reload schema';
