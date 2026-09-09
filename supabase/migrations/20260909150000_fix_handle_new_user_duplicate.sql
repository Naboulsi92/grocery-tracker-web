-- Fix: Correction du conflit de fonction handle_new_user dans la migration précédente
-- Issue: La migration 20260909000000_reconcile_schema_drift.sql tentait de créer 
--        private.handle_new_user() alors qu'elle existe déjà dans 20260831120000_secure_household_model.sql
-- Solution: Utiliser DROP IF EXISTS avant CREATE

-- Supprimer le trigger existant s'il existe
drop trigger if exists on_auth_user_created on auth.users;

-- Supprimer la fonction existante pour éviter le conflit
drop function if exists private.handle_new_user();

-- Recréer la fonction avec la définition canonique
create function private.handle_new_user() returns trigger
language plpgsql security definer set search_path = ''
as $$
begin
  insert into public.profiles (id, display_name)
  values (
    new.id,
    nullif(left(btrim(coalesce(new.raw_user_meta_data ->> 'display_name', new.raw_user_meta_data ->> 'full_name')), 80), '')
  );
  return new;
end;
$$;

-- Révoquer les permissions
revoke all on function private.handle_new_user() from public, anon, authenticated;

-- Recréer le trigger
create trigger on_auth_user_created after insert on auth.users
for each row execute function private.handle_new_user();
