-- Ticket #110 — Houseless self-view (PRD §4.9) : permettre à un utilisateur sans
-- foyer (après quitter, ou 013/014 standalone) de voir son propre profil.
-- Sans cela, SELECT + UPDATE direct de profiles.deleted_at en grâce échouent
-- (0 ligne, RLS) alors que la policy UPDATE profiles_update_self (id=auth.uid)
-- devrait suffire. Cause : la policy SELECT profiles_select_household via
-- private.can_view_profile exige un foyer partagé ; un sans-foyer ne se voit
-- plus lui-même, ce qui casse fetchProfile/restoreAccountIfPending côté app
-- et le contrat grace-period en CI (014).
-- Fix : policy permissive profiles_select_self FOR SELECT TO authenticated
-- USING (id = auth.uid()). Permissive = OR avec la policy foyer existante :
-- - soi-même toujours visible (même sans foyer) → restore/diagnostic OK ;
-- - test "leaver invisible pour l'autre" préservé (011 ne voit toujours pas
--   012, car ni soi ni foyer partagé).
-- Forward-only, idempotent, RLS inchangée par ailleurs, grants inchangés.
-- Verif CI : psql -v ON_ERROR_STOP=1 -f supabase/tests/database/security_contract.sql

drop policy if exists profiles_select_self on public.profiles;

create policy profiles_select_self on public.profiles for select to authenticated
using (id = (select auth.uid()));

comment on policy profiles_select_self on public.profiles is
  'PRD §4.9 : soi-même toujours lisible même sans foyer (restore grâce 7j) ; OR permissif avec profiles_select_household (visibilité foyer).';

notify pgrst, 'reload schema';
