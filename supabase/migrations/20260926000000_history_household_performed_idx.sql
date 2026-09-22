-- Ticket #117 — Index history + selects explicites (PRD v1.4 §4.7/§5)
-- Scalabilité requêtes : 0 index history(household_id) ni
-- (household_id, performed_at) -> seq-scan + trigger cap_history coûteux
-- (audit-performance F11). Forward-only, idempotent.
--
-- Contenu :
--   1. Index couvrant le fetch history (fetchHouseholdHistory : eq
--      household_id + order by performed_at desc limit 20) ET le ORDER BY
--      du trigger cap_history (20260920 rotation 21e).
--
-- Décisions explicites :
--   - SANS pagination inventaire (hors périmètre de ce ticket) : items et
--     categories restent en full-fetch trié, seules les colonnes deviennent
--     explicites côté client. History garde .limit(20) (PRD §4.7).
--   - CONCURRENTLY en prod : la migration CI pose un index simple
--     (CONCURRENTLY interdit dans un bloc transactionnel). Sur une prod
--     volumineuse, appliquer à la main :
--       CREATE INDEX CONCURRENTLY history_household_performed_idx
--       ON public.history (household_id, performed_at DESC);
--     puis re-jouer cette migration (IF NOT EXISTS -> no-op).
-- Verif CI : psql -v ON_ERROR_STOP=1 -f supabase/tests/database/security_contract.sql

create index if not exists history_household_performed_idx
  on public.history (household_id, performed_at desc);

comment on index public.history_household_performed_idx is
  'Ticket #117 (PRD §4.7) : fetch history par foyer trié performed_at desc (limit 20) + rotation cap_history 21e. Sans pagination inventaire (décision ticket).';
