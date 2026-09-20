-- Fix CI security_contract.sql:1221 (PR #130) — items.already_notified default must be false.
-- Diagnostic : contrat Ticket #108 (§ already_notified, security_contract.sql:1198-1206)
-- exige colonne serveur NOT NULL DEFAULT false, non inscriptible par les clients.
-- Socle v1.1 (20260915000000 §5) crée déjà la colonne NOT NULL DEFAULT false ;
-- convergence 20260920000000 §0 re-assert (ADD IF NOT EXISTS + SET NOT NULL + SET DEFAULT).
-- Malgré cela la CI (supabase db reset + migration up, Postgres 17.6.1.165) rapporte
-- `items.already_notified default must be false` : la 1re assertion NOT NULL passe
-- (colonne présente et NOT NULL), seule la 2e échoue → défaut DB faux (NULL/true),
-- pas colonne manquante (qui échouerait aussi en NOT NULL-skipped puis default),
-- pas contrat trop strict ('false' vérifié sur PG17 : TEMP + permanent → 'false').
-- Correctif forward-only, idempotent : converge vers NOT NULL DEFAULT false puis
-- re-assert grants TO authenticated seul (already_notified absent des listes
-- INSERT/UPDATE → server-controlled, seuls les triggers §2 de 20260920 l'écrivent).
-- Verif CI : psql -v ON_ERROR_STOP=1 -f supabase/tests/database/security_contract.sql

alter table public.items add column if not exists already_notified boolean;

update public.items set already_notified = false where already_notified is null;
alter table public.items alter column already_notified set not null;
alter table public.items alter column already_notified set default false;

-- Grants TO authenticated seul (0 anon, 0 PUBLIC), idempotent.
revoke all on table public.items from public, anon;
revoke all on table public.items from authenticated;
grant select on table public.items to authenticated;
grant insert (household_id, category_id, name, quantity, unit, low_stock_threshold, template_id) on table public.items to authenticated;
grant update (name, category_id, unit, low_stock_threshold) on table public.items to authenticated;
grant delete on table public.items to authenticated;

notify pgrst, 'reload schema';
