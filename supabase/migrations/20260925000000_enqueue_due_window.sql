-- Ticket #114 — Rappel quotidien : fenêtre d'échéance au lieu d'égalité stricte
-- (PRD §4.6 : rappel quotidien optionnel si reste en attente).
--
-- Contexte : enqueue_daily_reminders ne retenait que les reminder_time ÉGAUX
-- à l'heure d'appel (HH:MM exact). Avec un cron GitHub toutes les 15 min,
-- seuls les rappels réglés sur :00/:15/:30/:45 se déclenchaient — un rappel
-- à 08:07 ne partait jamais. Documenter la limitation ne satisfait pas §4.6.
--
-- Fix : fenêtre d'échéance `p.reminder_time <= p_at_time` — tout rappel dû
-- (heure passée, pas encore honoré) est enfilé, avec un léger retard borné
-- par la cadence du cron (≤15 min). La garde anti-doublon existante
-- (aucun rappel non traité <24h par (foyer, user)) empêche tout double envoi
-- et tout rattrapage répété : au plus 1 rappel / 24h / membre.
-- Forward-only (CREATE OR REPLACE), RLS/grants inchangés (cf 20260924).
-- Verif CI : security_contract.sql (asserts fonctionnels fenêtre + dédup).

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
    where p.notification_type in ('push', 'both')
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
  'PRD §4.6 : enfile 1 rappel/24h/membre pour tout reminder_time dû (<= heure d''appel, retard borné par la cadence cron) si le foyer a des articles sous seuil.';

notify pgrst, 'reload schema';
