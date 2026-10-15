-- Ticket #239 — le garde lockout n'a jamais pu s'armer : UPDATE
-- failed_attempts + RAISE 22023 dans la même transaction — le RAISE annule
-- la transaction (abort PostgREST / savepoint rollback), si bien que
-- l'incrément ne persistait jamais. Prouvé en E2E Preview le 15-10 (5
-- soumissions d'un code révoqué sans verrou) ; le contrat contournait en
-- seedant l'état bloqué en direct (cf #106 itération 9 / contrat §827-838).
--
-- Fix (Option B validée) : le chemin connu-invalide comptabilisé ne RAISE
-- plus — il UPDATE (l'incrément COMMIT) puis RETURN 'invalid'. Le client
-- mappe ce statut vers le même message que les tokens inconnus
-- (indistinguabilité préservée). Chemins sans écriture inchangés : 22023
-- inconnu, P0001 verrouillé, 23505 déjà-membre / foyer-plein, 42501.
--
-- Changement de type de retour uuid -> text : DROP + CREATE (CREATE OR
-- REPLACE l'interdit) + re-GRANT authenticated (pattern 20260906, 20260831,
-- 20260917). Succès : household_id::text (l'UI ignore data, seul error
-- compte ; le contrat caste ::uuid comme avant). RLS/function-only
-- inchangés. Verif CI : security_contract.sql (armement réel par boucle).

drop function if exists public.consume_household_invitation(text);

create function public.consume_household_invitation(p_token text) returns text
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

  -- Server-side lockout: pure guard (no writes), raising stays safe.
  if invitation.blocked_until is not null and invitation.blocked_until > v_now then
    raise exception 'invitation is temporarily locked' using errcode = 'P0001';
  end if;

  -- Known but invalid token: count the attempt, block after 5. Returns the
  -- 'invalid' status INSTEAD of raising (#239) so the increment commits;
  -- the caller maps it to the same invalid-token message as unknown tokens.
  if invitation.revoked_at is not null or invitation.consumed_at is not null or invitation.expires_at <= v_now then
    update public.household_invitations
    set failed_attempts = failed_attempts + 1,
        blocked_until = case
          when failed_attempts + 1 >= 5 then v_now + interval '1 minute'
          else blocked_until
        end
    where id = invitation.id;
    return 'invalid';
  end if;

  -- Valid live invitation: consume and reset the try counter
  insert into public.household_members (household_id, user_id, role)
  values (invitation.household_id, actor, 'member');
  update public.household_invitations
  set consumed_at = v_now, consumed_by = actor,
      failed_attempts = 0, blocked_until = null
  where id = invitation.id;
  return invitation.household_id::text;
end;
$$;

revoke all on function public.consume_household_invitation(text) from public, anon, authenticated;
grant execute on function public.consume_household_invitation(text) to authenticated;

comment on function public.consume_household_invitation(text) is
  'PRD §4.2/§5 (#239) : returns the household id on join, ''invalid'' for known-but-invalid tokens (attempt counted and committed), raises otherwise (unknown 22023, locked P0001, full/duplicate 23505).';

notify pgrst, 'reload schema';
