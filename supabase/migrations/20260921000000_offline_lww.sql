-- Ticket #109 — Offline LWW silencieux (PRD v1.4 §4.12/§5)
-- Forward-only, idempotent, worktree seul (sans commit/push/merge).
--
-- Contenu (DB seule, RLS inchangée) :
--   0. items.updated_at : convergence (ADD IF NOT EXISTS, NOT NULL, défaut now()).
--      Arbitre LWW : la valeur la plus récente fait foi (§5 « la valeur la plus
--      récente fait foi (last write wins), sans verrouillage optimiste en V1 »).
--   1. Touch trigger : re-assert à l'identique de v1.1 §16
--      (trigger_update_last_modified BEFORE INSERT OR UPDATE sur items via
--      public.update_last_modified() — pose last_modified_at/by + updated_at=now(),
--      non exécutable par les clients). Chaque écriture (UPDATE direct ou
--      adjust_item_quantity) avance donc updated_at côté serveur.
--   2. Index couvrant la resync : (household_id, updated_at DESC) pour le reload
--      intégral de l'inventaire à la reconnexion (§5 « recharger intégralement
--      l'état », §4.12 « récupération silencieuse »).
--   3. Grants TO authenticated seul (0 anon, 0 PUBLIC), updated_at
--      server-controlled (absent des listes INSERT/UPDATE, comme already_notified
--      et last_modified_*) ; aucune policy touchée (RLS inchangée).
--
-- Verif CI : psql -v ON_ERROR_STOP=1 -f supabase/tests/database/security_contract.sql

-- ══════════════════════════════════════════════════════════════
-- 0. updated_at : convergence idempotente (PRD §5)
-- ══════════════════════════════════════════════════════════════
-- La colonne existe depuis v1.1 §5 ; ce bloc ne fait que converger une prod
-- divergente (nullable/sans défaut) vers l'état canonique.

alter table public.items add column if not exists updated_at timestamptz;

update public.items set updated_at = now() where updated_at is null;
alter table public.items alter column updated_at set not null;
alter table public.items alter column updated_at set default now();

comment on column public.items.updated_at is
  'PRD §4.12/§5 : arbitre last-write-wins — la valeur la plus récente fait foi, sans verrouillage optimiste en V1. Server-controlled (touch trigger_update_last_modified, jamais écrit par les clients).';

-- ══════════════════════════════════════════════════════════════
-- 1. Touch trigger : updated_at=now() à chaque écriture (PRD §5)
-- ══════════════════════════════════════════════════════════════
-- Re-assert à l'identique de 20260915000000_v1_1_schema.sql §16 (convergence
-- prod) : BEFORE INSERT OR UPDATE, donc les UPDATE directs comme les UPDATE
-- internes de adjust_item_quantity touchent updated_at côté serveur.

create or replace function public.update_last_modified() returns trigger
language plpgsql set search_path = ''
as $$
begin
  new.last_modified_at = now();
  new.last_modified_by = auth.uid();
  new.updated_at = now();
  return new;
end;
$$;

revoke all on function public.update_last_modified() from public, anon, authenticated;

drop trigger if exists trigger_update_last_modified on public.items;
create trigger trigger_update_last_modified before insert or update on public.items
for each row execute function public.update_last_modified();

-- ══════════════════════════════════════════════════════════════
-- 2. Index resync : reload intégral ordonné (PRD §4.12/§5)
-- ══════════════════════════════════════════════════════════════
-- Pertinent : la reconnexion recharge intégralement l'inventaire du foyer
-- (pas de rattrapage flux seul) ; l'ordre (foyer, récence) sert la resync
-- silencieuse background et les lectures « dernier état connu ».

create index if not exists items_household_updated_idx
  on public.items (household_id, updated_at desc);

-- ══════════════════════════════════════════════════════════════
-- 3. Grants TO authenticated seul, RLS inchangée
-- ══════════════════════════════════════════════════════════════
-- Aucune policy créée/modifiée/supprimée (les 4 policies membres items_*
-- restent l'unique gate). updated_at reste server-controlled : absent des
-- listes INSERT/UPDATE clients, seuls le défaut now() et le trigger §1
-- l'écrivent. Listes alignées sur 20260920120000 (fork template_id inclus).

revoke all on table public.items from public, anon;
revoke all on table public.items from authenticated;
grant select on table public.items to authenticated;
grant insert (household_id, category_id, name, quantity, unit, low_stock_threshold, template_id) on table public.items to authenticated;
grant update (name, category_id, unit, low_stock_threshold) on table public.items to authenticated;
grant delete on table public.items to authenticated;

notify pgrst, 'reload schema';
