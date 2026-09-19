-- Item template linkage: add template_id to items
-- Links household items back to their catalog template (indicative, PRD §5:
-- "à titre indicatif uniquement, sans effet fonctionnel").

-- ══════════════════════════════════════════════════════════════
-- 1. Add template_id column
-- ══════════════════════════════════════════════════════════════

do $$
begin
  if not exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'items' and column_name = 'template_id'
  ) then
    alter table public.items add column template_id uuid
      references public.item_templates(id) on delete set null;
  end if;
end $$;

-- ══════════════════════════════════════════════════════════════
-- 2. Backfill template_id for existing households
-- ══════════════════════════════════════════════════════════════

update public.items i
set template_id = ti.id
from public.item_templates ti
where i.template_id is null
  and lower(i.name) = lower(ti.name_fr)
  and i.unit = ti.unit
  and i.low_stock_threshold = ti.suggested_threshold
  and i.category_id in (
    select c.id
    from public.categories c
    join public.default_categories dc on dc.name_fr = c.name
    where c.household_id = i.household_id
      and c.is_default = true
      and dc.id = ti.category_key
  );

-- ══════════════════════════════════════════════════════════════
-- 3. Update create_household to set template_id on seed
-- ══════════════════════════════════════════════════════════════

create or replace function public.create_household(p_name text) returns uuid
language plpgsql security definer set search_path = ''
as $$
declare
  actor uuid := auth.uid();
  new_household_id uuid;
  default_cat_row record;
  default_item_row record;
  category_id uuid;
begin
  if actor is null then raise exception 'authentication required' using errcode = '42501'; end if;
  if nullif(btrim(p_name), '') is null then raise exception 'household name is required' using errcode = '22023'; end if;
  if exists (select 1 from public.household_members where user_id = actor) then
    raise exception 'user already belongs to a household' using errcode = '23505';
  end if;

  insert into public.households (name) values (btrim(p_name)) returning id into new_household_id;
  insert into public.household_members (household_id, user_id, role)
  values (new_household_id, actor, 'owner');

  for default_cat_row in
    select dc.id, dc.name_fr, dc."position"
    from public.default_categories dc
    order by dc."position"
  loop
    insert into public.categories (household_id, name, is_default)
    values (new_household_id, default_cat_row.name_fr, true)
    returning id into category_id;

    insert into public.category_positions (household_id, category_id, "position")
    values (new_household_id, category_id, default_cat_row."position");
  end loop;

  for default_item_row in
    select ti.id as template_id, ti.name_fr, c.id as category_id, ti.unit, ti.suggested_threshold
    from public.item_templates ti
    join public.categories c
      on c.household_id = new_household_id
      and c.name = (
        select dc.name_fr from public.default_categories dc where dc.id = ti.category_key
      )
      and c.is_default = true
  loop
    insert into public.items (household_id, category_id, name, quantity, unit, low_stock_threshold, template_id)
    values (new_household_id, default_item_row.category_id, default_item_row.name_fr, 0, default_item_row.unit, default_item_row.suggested_threshold, default_item_row.template_id);
  end loop;

  return new_household_id;
end;
$$;

-- ══════════════════════════════════════════════════════════════
-- 4. Update grants for template_id
-- ══════════════════════════════════════════════════════════════

revoke all on table public.items from authenticated;
grant select on table public.items to authenticated;
grant insert (household_id, category_id, name, quantity, unit, low_stock_threshold, template_id) on table public.items to authenticated;
grant update (name, category_id, unit, low_stock_threshold) on table public.items to authenticated;
grant delete on table public.items to authenticated;
