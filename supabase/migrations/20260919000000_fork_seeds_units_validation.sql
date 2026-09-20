-- Ticket #107 scope A — Fork ITEM_TEMPLATES + seeds + unites + validations (§4.3/§4.4/§5/§7)
-- PRD v1.4 fait foi. Forward-only, idempotent, worktree seul (sans commit/push/merge).
--
-- Contenu :
--   0. Normalisation donnees existantes (unites, seuils, quantites, trim noms)
--   1. CHECK unit IN ('kg','g','l','ml','unite') sur items + item_templates
--   2. Seuil >0 + entier sur items.low_stock_threshold + item_templates.suggested_threshold
--   3. Noms : >=1 lettre / <=50 chars (CHECK) sur items, categories, templates, defaults
--   4. Unicites CI (household_id, lower(name)) : items + categories custom (IF NOT EXISTS)
--   5. ON DELETE RESTRICT categorie non-vide (composite FK, verifie + repare si derive)
--   6. Seeds idempotents : 10 default_categories + 10 item_templates bilingues FR/EN durs
--   7. Backfill fork manquant pour foyers existants (qte 0, seuil=suggested, template_id, isolation)
--   8. create_household OR REPLACE : fork qte 0 + seuil template + template_id indicatif + already_notified
--   9. Grants TO authenticated seul (re-assert)
--
-- Pas d'enum -> pas de `notify pgrst, 'reload schema'` requis (CHECK uniquement).
-- Verif CI : psql -v ON_ERROR_STOP=1 -f supabase/tests/database/security_contract.sql

-- ══════════════════════════════════════════════════════════════
-- 0. Normalisation (idempotent, avant CHECK)
-- ══════════════════════════════════════════════════════════════

-- Unites hors liste -> 'unite' (mapping historique Pack/Boite deja fait en v1.1, garde-fou)
update public.items
set unit = 'unite'
where unit is null or unit not in ('kg', 'g', 'l', 'ml', 'unite');

update public.item_templates
set unit = 'unite'
where unit is null or unit not in ('kg', 'g', 'l', 'ml', 'unite');

-- Seuils <=0 ou NULL -> 1 (PRD §4.4/§7 : seuil obligatoire >0)
update public.items
set low_stock_threshold = 1
where low_stock_threshold is null or low_stock_threshold <= 0;

update public.item_templates
set suggested_threshold = 1
where suggested_threshold is null or suggested_threshold <= 0;

-- Quantites negatives -> 0 (garde-fou, contrainte existe deja depuis le modele securise)
update public.items set quantity = 0 where quantity < 0;

-- Quantites/seuils decimaux -> tronques (PRD §4.4 : entiers)
update public.items set quantity = trunc(quantity) where quantity <> trunc(quantity);
update public.items set low_stock_threshold = trunc(low_stock_threshold) where low_stock_threshold <> trunc(low_stock_threshold);

-- Trim noms (espaces) — les vides/sans-lettre/>50 restent et feront echouer le CHECK (voulu)
update public.items set name = btrim(name) where name <> btrim(name);
update public.categories set name = btrim(name) where name <> btrim(name);
update public.item_templates set name_fr = btrim(name_fr) where name_fr <> btrim(name_fr);
update public.item_templates set name_en = btrim(name_en) where name_en <> btrim(name_en);
update public.default_categories set name_fr = btrim(name_fr) where name_fr <> btrim(name_fr);
update public.default_categories set name_en = btrim(name_en) where name_en <> btrim(name_en);

-- ══════════════════════════════════════════════════════════════
-- 1. CHECK unit fermees (PRD §4.4/§5 : kg/g/l/ml/unite)
-- ══════════════════════════════════════════════════════════════

do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'items_unit_allowed') then
    alter table public.items
      add constraint items_unit_allowed check (unit in ('kg', 'g', 'l', 'ml', 'unite'));
  end if;
end $$;

do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'item_templates_unit_allowed') then
    alter table public.item_templates
      add constraint item_templates_unit_allowed check (unit in ('kg', 'g', 'l', 'ml', 'unite'));
  end if;
end $$;

-- ══════════════════════════════════════════════════════════════
-- 2. Seuils >0 + entiers (PRD §4.4/§7)
-- ══════════════════════════════════════════════════════════════

do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'items_threshold_positive') then
    alter table public.items
      add constraint items_threshold_positive check (low_stock_threshold > 0);
  end if;
end $$;

do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'items_threshold_integer') then
    alter table public.items
      add constraint items_threshold_integer check (low_stock_threshold = trunc(low_stock_threshold));
  end if;
end $$;

do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'items_quantity_integer') then
    alter table public.items
      add constraint items_quantity_integer check (quantity = trunc(quantity));
  end if;
end $$;

do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'item_templates_threshold_positive') then
    alter table public.item_templates
      add constraint item_templates_threshold_positive check (suggested_threshold > 0);
  end if;
end $$;

-- ══════════════════════════════════════════════════════════════
-- 3. Noms : >=1 lettre / <=50 chars (PRD §7)
-- Regex [A-Za-zÀ-ÿŒœ] : garantit >=1 lettre FR/EN (accents + ligatures).
-- btrim + char_length : rejette vide/espaces et >50.
-- ══════════════════════════════════════════════════════════════

do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'items_name_valid') then
    alter table public.items
      add constraint items_name_valid check (
        char_length(btrim(name)) between 1 and 50
        and name ~ '[A-Za-zÀ-ÿŒœ]'
      );
  end if;
end $$;

do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'categories_name_valid') then
    alter table public.categories
      add constraint categories_name_valid check (
        char_length(btrim(name)) between 1 and 50
        and name ~ '[A-Za-zÀ-ÿŒœ]'
      );
  end if;
end $$;

do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'item_templates_name_fr_valid') then
    alter table public.item_templates
      add constraint item_templates_name_fr_valid check (
        char_length(btrim(name_fr)) between 1 and 50
        and name_fr ~ '[A-Za-zÀ-ÿŒœ]'
      );
  end if;
end $$;

do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'item_templates_name_en_valid') then
    alter table public.item_templates
      add constraint item_templates_name_en_valid check (
        char_length(btrim(name_en)) between 1 and 50
        and name_en ~ '[A-Za-zÀ-ÿŒœ]'
      );
  end if;
end $$;

do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'default_categories_name_fr_valid') then
    alter table public.default_categories
      add constraint default_categories_name_fr_valid check (
        char_length(btrim(name_fr)) between 1 and 50
        and name_fr ~ '[A-Za-zÀ-ÿŒœ]'
      );
  end if;
end $$;

do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'default_categories_name_en_valid') then
    alter table public.default_categories
      add constraint default_categories_name_en_valid check (
        char_length(btrim(name_en)) between 1 and 50
        and name_en ~ '[A-Za-zÀ-ÿŒœ]'
      );
  end if;
end $$;

-- ══════════════════════════════════════════════════════════════
-- 4. Unicites CI (household_id, lower(name)) — idempotent
-- Items (tous) + categories custom (is_default=false). Deja crees en v1.1 §7/§10.
-- ══════════════════════════════════════════════════════════════

create unique index if not exists items_household_name_unique_idx
  on public.items (household_id, lower(name));

create unique index if not exists categories_household_name_unique_idx
  on public.categories (household_id, lower(name))
  where is_default = false;

-- ══════════════════════════════════════════════════════════════
-- 5. ON DELETE RESTRICT categorie non-vide (PRD §5)
-- FK composite (category_id, household_id) -> (id, household_id).
-- Verifie la regle, repare si derive (ex. SET NULL residuel).
-- ══════════════════════════════════════════════════════════════

do $$
declare
  v_del char;
begin
  -- Cible du FK : unique (id, household_id) requis (modele securise §117)
  if not exists (select 1 from pg_constraint where conname = 'categories_id_household_id_key') then
    alter table public.categories
      add constraint categories_id_household_id_key unique (id, household_id);
  end if;

  select confdeltype into v_del
  from pg_constraint
  where conname = 'items_category_household_fkey';

  if v_del is distinct from 'r' then
    alter table public.items drop constraint if exists items_category_household_fkey;
    alter table public.items
      add constraint items_category_household_fkey
      foreign key (category_id, household_id)
      references public.categories (id, household_id)
      on delete restrict;
  end if;
end $$;

-- ══════════════════════════════════════════════════════════════
-- 6. Seeds idempotents : 10 categories + 10 templates FR/EN durs (PRD §4.3/§5)
-- WHERE NOT EXISTS : re-jouable sans doublon, sans UNIQUE requis.
-- ══════════════════════════════════════════════════════════════

insert into public.default_categories (name_fr, name_en, "position")
select 'Fruits', 'Fruits', 1
where not exists (select 1 from public.default_categories where name_fr = 'Fruits');

insert into public.default_categories (name_fr, name_en, "position")
select 'Légumes', 'Vegetables', 2
where not exists (select 1 from public.default_categories where name_fr = 'Légumes');

insert into public.default_categories (name_fr, name_en, "position")
select 'Produits laitiers', 'Dairy', 3
where not exists (select 1 from public.default_categories where name_fr = 'Produits laitiers');

insert into public.default_categories (name_fr, name_en, "position")
select 'Viandes et poissons', 'Meat and fish', 4
where not exists (select 1 from public.default_categories where name_fr = 'Viandes et poissons');

insert into public.default_categories (name_fr, name_en, "position")
select 'Féculents', 'Grains', 5
where not exists (select 1 from public.default_categories where name_fr = 'Féculents');

insert into public.default_categories (name_fr, name_en, "position")
select 'Épicerie', 'Grocery', 6
where not exists (select 1 from public.default_categories where name_fr = 'Épicerie');

insert into public.default_categories (name_fr, name_en, "position")
select 'Boissons', 'Beverages', 7
where not exists (select 1 from public.default_categories where name_fr = 'Boissons');

insert into public.default_categories (name_fr, name_en, "position")
select 'Surgelés', 'Frozen', 8
where not exists (select 1 from public.default_categories where name_fr = 'Surgelés');

insert into public.default_categories (name_fr, name_en, "position")
select 'Hygiène', 'Hygiene', 9
where not exists (select 1 from public.default_categories where name_fr = 'Hygiène');

insert into public.default_categories (name_fr, name_en, "position")
select 'Entretien', 'Cleaning', 10
where not exists (select 1 from public.default_categories where name_fr = 'Entretien');

insert into public.item_templates (name_fr, name_en, category_key, unit, suggested_threshold)
select 'Lait', 'Milk',
  (select id from public.default_categories where name_fr = 'Produits laitiers'), 'l', 1
where not exists (select 1 from public.item_templates where name_fr = 'Lait')
  and exists (select 1 from public.default_categories where name_fr = 'Produits laitiers');

insert into public.item_templates (name_fr, name_en, category_key, unit, suggested_threshold)
select 'Pain', 'Bread',
  (select id from public.default_categories where name_fr = 'Féculents'), 'unite', 1
where not exists (select 1 from public.item_templates where name_fr = 'Pain')
  and exists (select 1 from public.default_categories where name_fr = 'Féculents');

insert into public.item_templates (name_fr, name_en, category_key, unit, suggested_threshold)
select 'Œufs', 'Eggs',
  (select id from public.default_categories where name_fr = 'Produits laitiers'), 'unite', 1
where not exists (select 1 from public.item_templates where name_fr = 'Œufs')
  and exists (select 1 from public.default_categories where name_fr = 'Produits laitiers');

insert into public.item_templates (name_fr, name_en, category_key, unit, suggested_threshold)
select 'Tomates', 'Tomatoes',
  (select id from public.default_categories where name_fr = 'Légumes'), 'kg', 1
where not exists (select 1 from public.item_templates where name_fr = 'Tomates')
  and exists (select 1 from public.default_categories where name_fr = 'Légumes');

insert into public.item_templates (name_fr, name_en, category_key, unit, suggested_threshold)
select 'Pommes', 'Apples',
  (select id from public.default_categories where name_fr = 'Fruits'), 'kg', 1
where not exists (select 1 from public.item_templates where name_fr = 'Pommes')
  and exists (select 1 from public.default_categories where name_fr = 'Fruits');

insert into public.item_templates (name_fr, name_en, category_key, unit, suggested_threshold)
select 'Poulet', 'Chicken',
  (select id from public.default_categories where name_fr = 'Viandes et poissons'), 'kg', 1
where not exists (select 1 from public.item_templates where name_fr = 'Poulet')
  and exists (select 1 from public.default_categories where name_fr = 'Viandes et poissons');

insert into public.item_templates (name_fr, name_en, category_key, unit, suggested_threshold)
select 'Pâtes', 'Pasta',
  (select id from public.default_categories where name_fr = 'Féculents'), 'g', 1
where not exists (select 1 from public.item_templates where name_fr = 'Pâtes')
  and exists (select 1 from public.default_categories where name_fr = 'Féculents');

insert into public.item_templates (name_fr, name_en, category_key, unit, suggested_threshold)
select 'Café', 'Coffee',
  (select id from public.default_categories where name_fr = 'Épicerie'), 'g', 1
where not exists (select 1 from public.item_templates where name_fr = 'Café')
  and exists (select 1 from public.default_categories where name_fr = 'Épicerie');

insert into public.item_templates (name_fr, name_en, category_key, unit, suggested_threshold)
select 'Eau', 'Water',
  (select id from public.default_categories where name_fr = 'Boissons'), 'l', 1
where not exists (select 1 from public.item_templates where name_fr = 'Eau')
  and exists (select 1 from public.default_categories where name_fr = 'Boissons');

insert into public.item_templates (name_fr, name_en, category_key, unit, suggested_threshold)
select 'Papier toilette', 'Toilet paper',
  (select id from public.default_categories where name_fr = 'Hygiène'), 'unite', 1
where not exists (select 1 from public.item_templates where name_fr = 'Papier toilette')
  and exists (select 1 from public.default_categories where name_fr = 'Hygiène');

-- ══════════════════════════════════════════════════════════════
-- 7. Backfill fork manquant (foyers existants, idempotent)
-- Copie par foyer : qte 0, seuil=suggested, template_id indicatif.
-- Isolation : lignes propres par foyer, jamais partagees.
-- Ne touche que les foyers ayant la categorie defaut correspondante ;
-- ne duplique jamais (garde lower(name)).
-- ══════════════════════════════════════════════════════════════

do $$
declare
  h record;
  ti record;
  v_cat_id uuid;
begin
  for h in select id from public.households loop
    for ti in
      select it.id, it.name_fr, it.unit, it.suggested_threshold, dc.name_fr as cat_name
      from public.item_templates it
      join public.default_categories dc on dc.id = it.category_key
    loop
      select c.id into v_cat_id
      from public.categories c
      where c.household_id = h.id
        and c.name = ti.cat_name
        and c.is_default = true
      limit 1;

      if v_cat_id is null then
        continue;
      end if;

      if not exists (
        select 1 from public.items
        where household_id = h.id and lower(name) = lower(ti.name_fr)
      ) then
        insert into public.items
          (household_id, category_id, name, quantity, unit, low_stock_threshold, already_notified, template_id)
        values
          (h.id, v_cat_id, ti.name_fr, 0, ti.unit, ti.suggested_threshold, true, ti.id);
      end if;
    end loop;
  end loop;
end $$;

-- ══════════════════════════════════════════════════════════════
-- 8. create_household : fork a la creation (PRD §4.4/§5)
-- 10 categories defaut + 10 items forkes (qte 0, seuil template,
-- template_id indicatif sans effet fonctionnel, already_notified=true
-- pour ne pas generer de notif de seed). Isolation par copie.
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
    insert into public.items (household_id, category_id, name, quantity, unit, low_stock_threshold, already_notified, template_id)
    values (new_household_id, default_item_row.category_id, default_item_row.name_fr, 0, default_item_row.unit, default_item_row.suggested_threshold, true, default_item_row.template_id);
  end loop;

  return new_household_id;
end;
$$;

-- ══════════════════════════════════════════════════════════════
-- 9. Grants TO authenticated seul (0 anon, 0 PUBLIC)
-- CREATE OR REPLACE preserve les grants : re-assert explicite.
-- ══════════════════════════════════════════════════════════════

revoke all on function public.create_household(text) from public, anon, authenticated;
grant execute on function public.create_household(text) to authenticated;

revoke all on table public.items from public, anon;
revoke all on table public.items from authenticated;
grant select on table public.items to authenticated;
grant insert (household_id, category_id, name, quantity, unit, low_stock_threshold, template_id) on table public.items to authenticated;
grant update (name, category_id, unit, low_stock_threshold) on table public.items to authenticated;
grant delete on table public.items to authenticated;

revoke all on table public.categories from public, anon;
revoke all on table public.categories from authenticated;
grant select on table public.categories to authenticated;
grant insert (household_id, name, is_default) on table public.categories to authenticated;
grant update (name, is_default) on table public.categories to authenticated;
grant delete on table public.categories to authenticated;

revoke all on table public.default_categories from public, anon, authenticated;
grant select on table public.default_categories to authenticated;

revoke all on table public.item_templates from public, anon, authenticated;
grant select on table public.item_templates to authenticated;
