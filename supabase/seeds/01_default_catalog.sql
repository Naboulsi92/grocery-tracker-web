-- Seeds idempotents — catalogue par defaut bilingue FR/EN (PRD §4.3/§5, ticket #107).
-- Usage : `npx supabase seed` / `supabase db reset` rejoue ce fichier apres les migrations.
-- Forward-only, re-jouable : WHERE NOT EXISTS, jamais de doublon.
-- 10 categories + 10 templates durs, unites fermees kg/g/l/ml/unite, seuils >0.

-- ── 10 categories defaut (ordre = position) ──────────────────────────────
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

-- ── 10 templates (assignes, bilingues, unites fermees, seuil 1) ──────────
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

-- ── Verif bilingue (contrat) ─────────────────────────────────────────────
-- SELECT count(*) = 10 FROM default_categories;
-- SELECT count(*) = 10 FROM item_templates;
-- SELECT * FROM default_categories ORDER BY "position";
-- SELECT ti.name_fr, ti.name_en, dc.name_fr AS categorie, ti.unit
-- FROM item_templates ti JOIN default_categories dc ON dc.id = ti.category_key
-- ORDER BY ti.name_fr;
