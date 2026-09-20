-- Ticket #106 itération 9: cap pur + invalidation transactionnelle au départ.
-- PRD v1.4 §4.2/§5. Forward-only, idempotent.
--
-- Diagnostic itération 8 : le bloc cap faisait UPDATE consumed_at/by puis
-- RAISE 23505 dans la même fonction ; catché par le EXCEPTION du même DO
-- (contrat mono-transaction begin:2 rollback:907), le savepoint rollback
-- défaisait l'UPDATE → assert consumed_at NOT NULL rouge. Même anti-pattern
-- côté lockout (UPDATE failed_attempts + RAISE 22023 catché en boucle).
--
-- Fix combiné :
--   A. Cap pur : supprime l'UPDATE du bloc cap, garde RAISE 23505 seul.
--      L'invalidation est déplacée dans un trigger AFTER DELETE ON
--      household_members qui consomme les invitations live du foyer quitté
--      (consumed_at=now(), consumed_by=OLD.user_id = partant — sémantique
--      juste, vocabulaire consumed + CHECK paire conservés).
--   B. Contrat : assert consumed déplacé après le DELETE (post-départ).
--   C. Lockout : migration inchangée, contrat seedé/documenté (cf contrat).
--
-- Idempotent : CREATE OR REPLACE + DROP TRIGGER IF EXISTS + CREATE.
-- Grants RPC inchangés (TO authenticated seul) : CREATE OR REPLACE préserve
-- les grants ; la fonction trigger est révoquée de tous les rôles clients.

-- ── A1. consume: cap pur (23505 seul) ─────────────────────────────────────
-- Copie conforme de 20260917 §8 sauf le bloc cap (UPDATE supprimé).
create or replace function public.consume_household_invitation(p_token text) returns uuid
language plpgsql security definer set search_path = ''
as $$
declare
  actor uuid := auth.uid();
  invitation public.household_invitations%rowtype;
  v_now timestamptz := now();
begin
  if actor is null then raise exception 'authentication required' using errcode = '42501'; end if;
  if exists (select 1 from public.household_members where user_id = actor) then
    raise exception 'user already belongs to a household' using errcode = '23505';
  end if;

  select * into invitation from public.household_invitations
  where token_hash = sha256(convert_to(btrim(p_token), 'UTF8')) for update;

  -- Unknown token: nothing to increment, stays a plain invalid-token error
  if not found then
    raise exception 'invitation is invalid or unavailable' using errcode = '22023';
  end if;

  -- Cap 2: foyer complet — pure guard (itération 9). Aucun UPDATE ici : un
  -- UPDATE suivi de RAISE dans la même fonction est annulé par le savepoint
  -- rollback de l'appelant (bloc EXCEPTION PL/pgSQL). L'invalidation est
  -- assurée par le trigger AFTER DELETE ci-dessous, transactionnellement
  -- au départ effectif.
  if (select count(*) from public.household_members where household_id = invitation.household_id) >= 2 then
    raise exception 'household is full' using errcode = '23505';
  end if;

  -- Server-side lockout: previously blocked via failed_attempts
  if invitation.blocked_until is not null and invitation.blocked_until > v_now then
    raise exception 'invitation is temporarily locked' using errcode = 'P0001';
  end if;

  -- Known but invalid token: count the attempt, block after 5
  if invitation.revoked_at is not null or invitation.consumed_at is not null or invitation.expires_at <= v_now then
    update public.household_invitations
    set failed_attempts = failed_attempts + 1,
        blocked_until = case
          when failed_attempts + 1 >= 5 then v_now + interval '1 minute'
          else blocked_until
        end
    where id = invitation.id;
    raise exception 'invitation is invalid or unavailable' using errcode = '22023';
  end if;

  -- Valid live invitation: consume and reset the try counter
  insert into public.household_members (household_id, user_id, role)
  values (invitation.household_id, actor, 'member');
  update public.household_invitations
  set consumed_at = v_now, consumed_by = actor,
      failed_attempts = 0, blocked_until = null
  where id = invitation.id;
  return invitation.household_id;
end;
$$;

-- ── A2. Trigger d'invalidation au départ ──────────────────────────────────
-- Au départ d'un membre (DELETE), toute invitation encore live du foyer est
-- consommée d'office (PRD « automatiquement invalides ») : elle reste
-- inutilisable après le départ sans regen. consumed_by = OLD.user_id
-- (le partant) ; la paire consumed_at/consumed_by satisfait le CHECK
-- household_invitations_consumption. SECURITY DEFINER : la table
-- household_invitations est function-only (zéro policy, zéro grant), le
-- trigger doit écrire quel que soit le rôle du suppresseur ; EXECUTE
-- révoqué des rôles clients (le déclenchement trigger reste actif).
create or replace function public.invalidate_invitations_on_departure() returns trigger
language plpgsql security definer set search_path = ''
as $$
begin
  update public.household_invitations
  set consumed_at = now(), consumed_by = OLD.user_id
  where household_id = OLD.household_id
    and revoked_at is null
    and consumed_at is null
    and expires_at > now();
  return OLD;
end;
$$;

revoke all on function public.invalidate_invitations_on_departure() from public, anon, authenticated;

drop trigger if exists household_invalidate_invitations_on_departure on public.household_members;
create trigger household_invalidate_invitations_on_departure after delete on public.household_members
for each row execute function public.invalidate_invitations_on_departure();

notify pgrst, 'reload schema';
