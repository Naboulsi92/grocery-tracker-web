-- T2C (account settings): grant self-update on the new V1.1 profile columns.
-- RLS (profiles_update_self) already restricts writes to the user's own row;
-- these grants extend the writable columns to the preferences surfaced on the
-- /account page. The security contract keeps forbidding id/created_at/updated_at.
grant update (first_name) on table public.profiles to authenticated;
grant update (last_name) on table public.profiles to authenticated;
grant update (language) on table public.profiles to authenticated;
grant update (deleted_at) on table public.profiles to authenticated;
grant update (display_name) on table public.profiles to authenticated;
grant update (notification_type) on table public.profiles to authenticated;
grant update (reminder_time) on table public.profiles to authenticated;