create table public.units (
  id uuid primary key default gen_random_uuid(),
  name text unique not null,
  abbrev text not null
);

insert into public.units (name, abbrev) values
  ('Unité', 'u'),
  ('Kilogramme', 'kg'),
  ('Gramme', 'g'),
  ('Litre', 'L'),
  ('Millilitre', 'mL'),
  ('Pack', 'pack'),
  ('Boîte', 'boîte');

create table public.households (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  created_at timestamptz default now()
);

create table public.household_members (
  household_id uuid references public.households(id) on delete cascade,
  user_id uuid references auth.users(id) on delete cascade,
  joined_at timestamptz default now(),
  primary key (household_id, user_id)
);

create table public.categories (
  id uuid primary key default gen_random_uuid(),
  household_id uuid references public.households(id) on delete cascade not null,
  name text not null,
  icon text default '📦',
  "order" integer default 0,
  created_at timestamptz default now()
);

create table public.items (
  id uuid primary key default gen_random_uuid(),
  household_id uuid references public.households(id) on delete cascade not null,
  category_id uuid references public.categories(id) on delete set null,
  name text not null,
  quantity numeric not null default 0,
  unit_id uuid references public.units(id) not null,
  low_stock_threshold numeric not null default 1,
  last_modified_by uuid references auth.users(id),
  last_modified_at timestamptz default now(),
  created_at timestamptz default now()
);

create table public.push_subscriptions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete cascade not null,
  subscription jsonb not null,
  created_at timestamptz default now(),
  unique (user_id)
);

alter table public.households enable row level security;
alter table public.household_members enable row level security;
alter table public.categories enable row level security;
alter table public.items enable row level security;
alter table public.units enable row level security;
alter table public.push_subscriptions enable row level security;

create policy "Users can view their own households" on public.households for select
using (id in (select household_id from public.household_members where user_id = auth.uid()));
create policy "Users can insert households they belong to" on public.households for insert with check (true);
create policy "Users can view their own membership" on public.household_members for select using (user_id = auth.uid());
create policy "Users can join households" on public.household_members for insert with check (user_id = auth.uid());
create policy "Users can view categories in their households" on public.categories for select
using (household_id in (select household_id from public.household_members where user_id = auth.uid()));
create policy "Users can manage categories in their households" on public.categories for all
using (household_id in (select household_id from public.household_members where user_id = auth.uid()))
with check (household_id in (select household_id from public.household_members where user_id = auth.uid()));
create policy "Users can view items in their households" on public.items for select
using (household_id in (select household_id from public.household_members where user_id = auth.uid()));
create policy "Users can manage items in their households" on public.items for all
using (household_id in (select household_id from public.household_members where user_id = auth.uid()))
with check (household_id in (select household_id from public.household_members where user_id = auth.uid()));
create policy "Authenticated users can view units" on public.units for select using (auth.role() = 'authenticated');
create policy "Users can manage their own push subscriptions" on public.push_subscriptions for all
using (user_id = auth.uid()) with check (user_id = auth.uid());

create function public.handle_new_user() returns trigger
language plpgsql security definer set search_path = public
as $$
declare new_household_id uuid;
begin
  insert into public.households (name) values ('Mon Foyer') returning id into new_household_id;
  insert into public.household_members (household_id, user_id) values (new_household_id, new.id);
  insert into public.categories (household_id, name, icon, "order") values
    (new_household_id, 'Fruits & Légumes', '🥦', 1),
    (new_household_id, 'Produits laitiers', '🥛', 2),
    (new_household_id, 'Pain & Pâtisserie', '🥖', 3),
    (new_household_id, 'Viande & Poisson', '🍖', 4),
    (new_household_id, 'Épicerie', '🥫', 5),
    (new_household_id, 'Hygiène & Entretien', '🧼', 6);
  return new;
end;
$$;

create trigger on_auth_user_created after insert on auth.users
for each row execute function public.handle_new_user();

create function public.update_last_modified() returns trigger
language plpgsql set search_path = public
as $$
begin
  new.last_modified_at = now();
  return new;
end;
$$;

create trigger trigger_update_last_modified before update on public.items
for each row execute function public.update_last_modified();
