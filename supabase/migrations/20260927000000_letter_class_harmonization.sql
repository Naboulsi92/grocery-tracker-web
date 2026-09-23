-- Ticket #127 — Harmonize the letter class SQL ↔ TS.
--
-- The TS LETTER_PATTERN ([A-Za-zÀ-ÖØ-öø-ÿŒœ]) excludes × (U+00D7) and
-- ÷ (U+00F7), but the SQL CHECK constraints used [A-Za-zÀ-ÿŒœ], whose À-ÿ
-- range includes both. Rewrite the six constraints with the TS class.
-- Forward-only, idempotent (drop if exists + add). Existing rows already
-- satisfy char_length + old class; names whose only letter-like char was
-- ×/÷ would now fail — none expected (names need real letters for UX), and
-- a violation fails loudly here instead of silently diverging again.
-- See also: security_contract.sql § ticket #127 (regex asserts).

do $$
begin
  alter table public.items drop constraint if exists items_name_valid;
  alter table public.items
    add constraint items_name_valid check (
      char_length(btrim(name)) between 1 and 50
      and name ~ '[A-Za-zÀ-ÖØ-öø-ÿŒœ]'
    );
end $$;

do $$
begin
  alter table public.categories drop constraint if exists categories_name_valid;
  alter table public.categories
    add constraint categories_name_valid check (
      char_length(btrim(name)) between 1 and 50
      and name ~ '[A-Za-zÀ-ÖØ-öø-ÿŒœ]'
    );
end $$;

do $$
begin
  alter table public.item_templates drop constraint if exists item_templates_name_fr_valid;
  alter table public.item_templates
    add constraint item_templates_name_fr_valid check (
      char_length(btrim(name_fr)) between 1 and 50
      and name_fr ~ '[A-Za-zÀ-ÖØ-öø-ÿŒœ]'
    );
end $$;

do $$
begin
  alter table public.item_templates drop constraint if exists item_templates_name_en_valid;
  alter table public.item_templates
    add constraint item_templates_name_en_valid check (
      char_length(btrim(name_en)) between 1 and 50
      and name_en ~ '[A-Za-zÀ-ÖØ-öø-ÿŒœ]'
    );
end $$;

do $$
begin
  alter table public.default_categories drop constraint if exists default_categories_name_fr_valid;
  alter table public.default_categories
    add constraint default_categories_name_fr_valid check (
      char_length(btrim(name_fr)) between 1 and 50
      and name_fr ~ '[A-Za-zÀ-ÖØ-öø-ÿŒœ]'
    );
end $$;

do $$
begin
  alter table public.default_categories drop constraint if exists default_categories_name_en_valid;
  alter table public.default_categories
    add constraint default_categories_name_en_valid check (
      char_length(btrim(name_en)) between 1 and 50
      and name_en ~ '[A-Za-zÀ-ÖØ-öø-ÿŒœ]'
    );
end $$;
