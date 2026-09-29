-- Ticket #166 (OAuth): provider lookup for the anonymous forgot-password gate.
--
-- Same narrow contract style as email_exists: returns 'email', 'google',
-- 'apple', or NULL for unknown addresses — never anything beyond the input
-- email. Any non-email identity wins (a linked Google account must not be
-- offered a password form even if last used via email). Callable by anon
-- (the screen is public) and authenticated. Forward-only, idempotent.
create or replace function public.auth_provider_for_email(p_email text)
returns text
language sql security definer set search_path = ''
as $$
  select coalesce(
    (
      select lower(identity.provider)
      from auth.identities as identity
      join auth.users as account on account.id = identity.user_id
      where lower(account.email) = lower(btrim(p_email))
        and lower(identity.provider) <> 'email'
      limit 1
    ),
    (
      select 'email'
      where exists (
        select 1 from auth.users where lower(email) = lower(btrim(p_email))
      )
    )
  );
$$;

revoke all on function public.auth_provider_for_email(text) from public, anon, authenticated;
grant execute on function public.auth_provider_for_email(text) to anon, authenticated;
