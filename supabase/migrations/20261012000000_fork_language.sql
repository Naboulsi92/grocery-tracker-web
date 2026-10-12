-- 20261012000000_fork_language.sql
-- Ticket #229 : fork bilingue a la creation du foyer (PRD §4.4/§5 « seedes
-- bilingues »). Avant : create_household copiait toujours name_fr, donc un
-- foyer cree en anglais voyait les 10 articles et 10 categories par defaut
-- en francais. Apres : create_household(p_name, p_language) copie name_en
-- quand p_language = 'en', name_fr sinon (valeur inconnue -> 'fr').
-- p_language a un defaut : les appels existants a un seul argument
-- positionnel (contrat SQL, global-setup e2e) restent valides et forkent en
-- francais. Seuls les NOUVEAUX foyers sont concernes : les lignes FR deja
-- forkées ne sont pas renommees (contenu utilisateur a ce stade).
-- ══════════════════════════════════════════════════════════════
-- 1. create_household bilingue (remplace la variante (text))
-- ══════════════════════════════════════════════════════════════

drop function if exists public.create_household(text);

create function public.create_household(p_name text, p_language text default 'fr')
returns uuid
language plpgsql security definer set search_path = ''
as $$
declare
  actor uuid := auth.uid();
  new_household_id uuid;
  lang text := lower(btrim(coalesce(p_language, 'fr')));
  default_cat_row record;
  default_item_row record;
  category_id uuid;
begin
  if lang not in ('fr', 'en') then lang := 'fr'; end if;
  if actor is null then raise exception 'authentication required' using errcode = '42501'; end if;
  if nullif(btrim(p_name), '') is null then raise exception 'household name is required' using errcode = '22023'; end if;
  if exists (select 1 from public.household_members where user_id = actor) then
    raise exception 'user already belongs to a household' using errcode = '23505';
  end if;

  insert into public.households (name) values (btrim(p_name)) returning id into new_household_id;
  insert into public.household_members (household_id, user_id, role)
  values (new_household_id, actor, 'owner');

  for default_cat_row in
    select dc.id,
      case when lang = 'en' then dc.name_en else dc.name_fr end as cat_name,
      dc."position"
    from public.default_categories dc
    order by dc."position"
  loop
    insert into public.categories (household_id, name, is_default)
    values (new_household_id, default_cat_row.cat_name, true)
    returning id into category_id;

    insert into public.category_positions (household_id, category_id, "position")
    values (new_household_id, category_id, default_cat_row."position");
  end loop;

  for default_item_row in
    select ti.id as template_id,
      case when lang = 'en' then ti.name_en else ti.name_fr end as item_name,
      c.id as category_id, ti.unit, ti.suggested_threshold
    from public.item_templates ti
    join public.categories c
      on c.household_id = new_household_id
      and c.name = (
        select case when lang = 'en' then dc.name_en else dc.name_fr end
        from public.default_categories dc where dc.id = ti.category_key
      )
      and c.is_default = true
  loop
    insert into public.items (household_id, category_id, name, quantity, unit, low_stock_threshold, already_notified, template_id)
    values (new_household_id, default_item_row.category_id, default_item_row.item_name, 0, default_item_row.unit, default_item_row.suggested_threshold, true, default_item_row.template_id);
  end loop;

  return new_household_id;
end;
$$;

-- ══════════════════════════════════════════════════════════════
-- 2. Grants TO authenticated seul (nouvelle signature)
-- ══════════════════════════════════════════════════════════════

revoke all on function public.create_household(text, text) from public, anon, authenticated;
grant execute on function public.create_household(text, text) to authenticated;
