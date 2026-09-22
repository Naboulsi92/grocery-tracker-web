-- Ticket #114 — Cron auth + GRANT service_role (PRD §4.9 / §4.6)
-- Parité avec sweep_fully_deleted_members (20260916020000 §3b) : la fonction
-- enqueue_daily_reminders(time) était révoquée aux rôles clients mais jamais
-- explicitement accordée au service_role utilisé par l'edge notify-thresholds
-- (/daily-reminders). Forward-only, idempotent (GRANT répété = no-op).
-- RLS inchangée. Verif CI : security_contract.sql (refus authenticated,
-- grant service_role seul).
-- NOTE : l'activation leaked-password (H6) et CRON_SECRET dashboard restent
-- des actions manuelles, cf docs/runbook-leaked-password-protection.md et
-- supabase/functions/README.md.

-- Internal-only (invoked by cron or the edge function's service role) :
-- re-assert revoke + grant manquant (audit H5/M2, #114).
revoke all on function public.enqueue_daily_reminders(time) from public, anon, authenticated;
grant execute on function public.enqueue_daily_reminders(time) to service_role;

-- Re-assert sweep (convergence, no-op si déjà en place).
revoke all on function public.sweep_fully_deleted_members() from public, anon, authenticated;
grant execute on function public.sweep_fully_deleted_members() to service_role;

notify pgrst, 'reload schema';
