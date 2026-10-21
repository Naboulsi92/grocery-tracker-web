-- Ticket #252 — buy_quantity (quantité à acheter, manuelle, ≥ 1, null par défaut)
-- PRD v1.7 §4 : intention d'achat déclarée manuellement dans l'édition d'article ;
-- badge lecture seule sur /to-buy ; effacée côté serveur au restock validé
-- (RPC adjust_item_quantity, 3e param p_clear_buy_quantity, même UPDATE atomique).
--
-- Verif CI : psql -v ON_ERROR_STOP=1 -f supabase/tests/database/security_contract.sql

alter table public.items add column buy_quantity int;

alter table public.items add constraint items_buy_quantity_check
  check (buy_quantity is null or buy_quantity >= 1);

comment on column public.items.buy_quantity is
  'PRD v1.7 #252 : quantité à acheter (intention manuelle, entier >= 1, null = aucune). Server: effacée par adjust_item_quantity(p_clear_buy_quantity := true) au restock validé.';

-- Nouvelle identité (uuid, numeric, boolean) : drop de l'ancienne après revoke
-- (create or replace ne changerait pas l'identité ; les clients sans le 3e arg
-- restent valides via la valeur par défaut false = jamais d'effacement).
revoke all on function public.adjust_item_quantity(uuid, numeric) from public, anon, authenticated;
drop function public.adjust_item_quantity(uuid, numeric);

create function public.adjust_item_quantity(p_item_id uuid, p_delta numeric, p_clear_buy_quantity boolean default false)
returns public.items
language plpgsql security definer set search_path = ''
as $$
declare updated_item public.items;
begin
  if auth.uid() is null then raise exception 'authentication required' using errcode = '42501'; end if;
  if p_delta is null then raise exception 'quantity delta is required' using errcode = '22023'; end if;
  -- Hygiène : l'effacement accompagne un RESTOCK (delta positif) ; jamais
  -- une consommation négative (PRD v1.7 : l'intention ne meurt qu'à l'achat).
  if p_clear_buy_quantity is true and p_delta < 0 then
    raise exception 'p_clear_buy_quantity requires a non negative delta' using errcode = '22023';
  end if;
  update public.items
  set quantity = greatest(0, quantity + p_delta),
      buy_quantity = case when p_clear_buy_quantity is true then null else buy_quantity end
  where id = p_item_id and private.is_household_member(household_id)
  returning * into updated_item;
  if not found then raise exception 'item not found or inaccessible' using errcode = 'P0002'; end if;
  return updated_item;
end;
$$;

revoke all on function public.adjust_item_quantity(uuid, numeric, boolean) from public, anon, authenticated;
grant execute on function public.adjust_item_quantity(uuid, numeric, boolean) to authenticated;

-- Colonne éditable côté client (formulaire d'édition /items) — la RPC est
-- security definer, ce grant vaut pour l'UPDATE direct du formulaire.
grant update (buy_quantity) on table public.items to authenticated;

notify pgrst, 'reload schema';
