-- Ticket #173 : publish household_members on supabase_realtime so member
-- arrivals/departures refresh the roster live (replaces the manual header
-- refresh button, PRD §4.12 silent resync). The reconcile migration
-- (20260909000000) explicitly dropped this table when the publication was
-- inventory-only; this newer migration wins by ordering.
--
-- RLS delivers: household_members_select_member covers the whole household,
-- so each member receives the other's INSERT/DELETE. Default replica
-- identity (PK) is enough — the client refetches on any event and never
-- reads old payloads (FULL is only asserted for inventory tables).
do $$
begin
  if not exists (
    select 1
    from pg_publication_tables
    where pubname = 'supabase_realtime'
      and schemaname = 'public'
      and tablename = 'household_members'
  ) then
    alter publication supabase_realtime add table public.household_members;
  end if;
end;
$$;
