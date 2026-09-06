-- Fix household functions to match canonical definitions
-- This migration replaces the broken functions deployed by 20260901084457

-- 0. Fix create_household: creates categories, doesn't duplicate profiles (trigger handles that)
drop function if exists public.create_household(text);

create or replace function public.create_household(p_name text) returns uuid
language plpgsql security definer set search_path = ''
as $$
declare
  actor uuid := auth.uid();
  new_household_id uuid;
begin
  if actor is null then raise exception 'authentication required' using errcode = '42501'; end if;
  if nullif(btrim(p_name), '') is null then raise exception 'household name is required' using errcode = '22023'; end if;
  if exists (select 1 from public.household_members where user_id = actor) then
    raise exception 'user already belongs to a household' using errcode = '23505';
  end if;

  insert into public.households (name) values (btrim(p_name)) returning id into new_household_id;
  insert into public.household_members (household_id, user_id, role)
  values (new_household_id, actor, 'owner');
  insert into public.categories (household_id, name, icon, "order") values
    (new_household_id, 'Fruits & Légumes', '🥦', 1),
    (new_household_id, 'Produits laitiers', '🥛', 2),
    (new_household_id, 'Pain & Pâtisserie', '🥖', 3),
    (new_household_id, 'Viande & Poisson', '🍖', 4),
    (new_household_id, 'Épicerie', '🥫', 5),
    (new_household_id, 'Hygiène & Entretien', '🧼', 6);
  return new_household_id;
end;
$$;

grant execute on function public.create_household(text) to authenticated;

-- 1. Fix create_household_invitation: returns TABLE with id/token/expires, uses sha256, retires previous live invitation
drop function if exists public.create_household_invitation(uuid, interval);

create function public.create_household_invitation(
  p_household_id uuid,
  p_expires_in interval default interval '7 days'
) returns table (invitation_id uuid, token text, expires_at timestamptz)
language plpgsql security definer set search_path = ''
as $$
declare
  actor uuid := auth.uid();
  raw_token text;
begin
  if actor is null then raise exception 'authentication required' using errcode = '42501'; end if;
  if not private.is_household_owner(p_household_id) then raise exception 'household owner required' using errcode = '42501'; end if;
  if p_expires_in <= interval '0 seconds' or p_expires_in > interval '30 days' then
    raise exception 'invitation lifetime must be between 0 and 30 days' using errcode = '22023';
  end if;

  -- Retire any existing live invitation for this household
  update public.household_invitations
  set revoked_at = now()
  where household_id = p_household_id
    and revoked_at is null
    and consumed_at is null
    and household_invitations.expires_at > now();

  raw_token := replace(gen_random_uuid()::text || gen_random_uuid()::text, '-', '');
  return query
  insert into public.household_invitations (household_id, token_hash, created_by, expires_at)
  values (p_household_id, sha256(convert_to(raw_token, 'UTF8')), actor, now() + p_expires_in)
  returning id, raw_token, household_invitations.expires_at;
end;
$$;

-- 2. Fix revoke_household_invitation: returns boolean, checks household ownership
drop function if exists public.revoke_household_invitation(uuid);

create function public.revoke_household_invitation(p_invitation_id uuid) returns boolean
language plpgsql security definer set search_path = ''
as $$
declare affected integer;
begin
  if auth.uid() is null then raise exception 'authentication required' using errcode = '42501'; end if;
  update public.household_invitations i set revoked_at = now()
  where i.id = p_invitation_id and i.revoked_at is null and i.consumed_at is null
    and private.is_household_owner(i.household_id);
  get diagnostics affected = row_count;
  return affected = 1;
end;
$$;

-- 3. Fix consume_household_invitation: uses sha256, canonical error message
drop function if exists public.consume_household_invitation(text);

create function public.consume_household_invitation(p_token text) returns uuid
language plpgsql security definer set search_path = ''
as $$
declare
  actor uuid := auth.uid();
  invitation public.household_invitations%rowtype;
begin
  if actor is null then raise exception 'authentication required' using errcode = '42501'; end if;
  if exists (select 1 from public.household_members where user_id = actor) then
    raise exception 'user already belongs to a household' using errcode = '23505';
  end if;
  select * into invitation from public.household_invitations
  where token_hash = sha256(convert_to(p_token, 'UTF8')) for update;
  if not found or invitation.revoked_at is not null or invitation.consumed_at is not null or invitation.expires_at <= now() then
    raise exception 'invitation is invalid or unavailable' using errcode = '22023';
  end if;
  insert into public.household_members (household_id, user_id, role)
  values (invitation.household_id, actor, 'member');
  update public.household_invitations set consumed_at = now(), consumed_by = actor where id = invitation.id;
  return invitation.household_id;
end;
$$;

-- 4. Add read function: get current invitation metadata (never returns token)
create function public.get_household_invitation(p_household_id uuid)
returns table (
  invitation_id uuid,
  created_at timestamptz,
  expires_at timestamptz,
  revoked_at timestamptz,
  consumed_at timestamptz
)
language plpgsql security definer set search_path = ''
as $$
begin
  if auth.uid() is null then raise exception 'authentication required' using errcode = '42501'; end if;
  if not private.is_household_owner(p_household_id) then raise exception 'household owner required' using errcode = '42501'; end if;
  return query
  select i.id, i.created_at, i.expires_at, i.revoked_at, i.consumed_at
  from public.household_invitations i
  where i.household_id = p_household_id
  order by i.created_at desc
  limit 1;
end;
$$;

-- 5. Re-grant execute permissions (replacing functions drops grants)
revoke all on function public.create_household(text) from public, anon, authenticated;
revoke all on function public.create_household_invitation(uuid, interval) from public, anon, authenticated;
revoke all on function public.revoke_household_invitation(uuid) from public, anon, authenticated;
revoke all on function public.consume_household_invitation(text) from public, anon, authenticated;
revoke all on function public.get_household_invitation(uuid) from public, anon, authenticated;
grant execute on function public.create_household(text) to authenticated;
grant execute on function public.create_household_invitation(uuid, interval) to authenticated;
grant execute on function public.revoke_household_invitation(uuid) to authenticated;
grant execute on function public.consume_household_invitation(text) to authenticated;
grant execute on function public.get_household_invitation(uuid) to authenticated;

-- 6. Ensure partial index exists for live invitation lookup (idempotent)
create index if not exists household_invitations_active_idx
  on public.household_invitations (household_id, expires_at)
  where revoked_at is null and consumed_at is null;

-- 7. Reload schema cache so clients see new signatures
notify pgrst, 'reload schema';