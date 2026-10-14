-- Ticket #224 — Rappel quotidien : éligibilité badge/none + planification (PRD §4.6).
--
-- Écart 13.3 #10 : enqueue_daily_reminders excluait notification_type
-- badge/none même avec une heure posée, et la planification restait à
-- brancher. Le canal est une préférence d'envoi traitée à l'envoi
-- (notify-thresholds route par abonnement push) — l'éligibilité au rappel
-- ne dépend que de l'heure posée et d'une file non vide.
--
-- Planification : déjà en place via .github/workflows/notify-automation.yml
-- (cron */15 : 1. POST /daily-reminders → enqueue, 2. POST / → envoi VAPID,
-- environment production, secrets SUPABASE_URL + SUPABASE_CRON_SECRET).
-- Le bloc pg_cron commenté de 20260916020000 §4 reste une option documentée
-- (nécessite l'extension, indisponible sur tous les plans).
--
-- Forward-only (CREATE OR REPLACE), fenêtre d'échéance <=, dédup 24h et
-- RLS/grants inchangés (cf 20260924, 20260925).
-- Verif CI : security_contract.sql (badge/none éligibles, fenêtre + dédup).

create or replace function public.enqueue_daily_reminders(p_at_time time default now()::time)
returns void
language plpgsql
set search_path = ''
as $$
declare
  member_rec record;
  to_buy_count bigint;
begin
  for member_rec in
    select hm.user_id, hm.household_id
    from public.household_members hm
    join public.profiles p on p.id = hm.user_id
    where p.notification_type in ('push', 'both', 'badge', 'none')
      -- Fenêtre d'échéance (#114) : tout rappel dû et non honoré, pas
      -- seulement l'égalité HH:MM exacte (cron */15 : retard borne ≤15 min).
      and p.reminder_time <= p_at_time
  loop
    -- Check if any to-buy items exist for this household
    select count(*) into to_buy_count
    from public.items i
    where i.household_id = member_rec.household_id
      and i.quantity <= i.low_stock_threshold;

    if to_buy_count = 0 then
      continue;
    end if;

    -- Check if this member already has an unprocessed reminder in the last 24h
    if exists (
      select 1 from public.pending_notifications pn
      where pn.household_id = member_rec.household_id
        and pn.target_user_id = member_rec.user_id
        and pn.processed_at is null
        and pn.created_at > now() - interval '24 hours'
    ) then
      continue;
    end if;

    -- Enqueue one reminder for this member (target_user_id → only this member)
    insert into public.pending_notifications
      (household_id, item_id, item_name, quantity, threshold, actor_id, target_user_id, created_at)
    values
      (member_rec.household_id, null, 'Rappel',
       to_buy_count, null, null, member_rec.user_id, now());
  end loop;
end;
$$;

comment on function public.enqueue_daily_reminders(time) is
  'PRD §4.6 (#224) : enfile 1 rappel/24h/membre pour tout reminder_time dû (<= heure d''appel, retard borné par la cadence cron) si le foyer a des articles sous seuil — tout canal (push, both, badge, none). Planifié via .github/workflows/notify-automation.yml.';

notify pgrst, 'reload schema';
