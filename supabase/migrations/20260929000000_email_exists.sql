-- Ticket #164 (forgot password): existence check for the request-reset screen.
--
-- Decision (human-validated): an unknown email shows an explicit error, NOT
-- an enumeration-safe success screen. This function is the narrow disclosure
-- surface for that decision: it returns a boolean only, never the email, and
-- performs no other read. Callable by anon (the screen is public) and
-- authenticated. Forward-only, idempotent (create or replace + grants).
create or replace function public.email_exists(p_email text)
returns boolean
language sql security definer set search_path = ''
as $$
  select exists (
    select 1
    from auth.users
    where lower(email) = lower(btrim(p_email))
  );
$$;

revoke all on function public.email_exists(text) from public, anon, authenticated;
grant execute on function public.email_exists(text) to anon, authenticated;
