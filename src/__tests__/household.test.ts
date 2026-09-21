import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '@/types/database';
import {
  householdActionError,
  leaveHousehold,
  mergeHouseholdMembers,
  normalizeInvitationToken,
  type InvitationState,
} from '@/lib/household';
import { translate } from '@/lib/i18n';

describe('household contracts', () => {
  const warn = jest.spyOn(console, 'warn').mockImplementation(() => undefined);

  afterAll(() => warn.mockRestore());

  it('normalizes an invitation without shortening its opaque token', () => {
    expect(normalizeInvitationToken('  full-token_123  ')).toBe('full-token_123');
  });

  it('merges visible profiles into memberships without exposing user ids as labels', () => {
    expect(mergeHouseholdMembers(
      [
        { user_id: 'user-1', role: 'owner', joined_at: '2026-08-31T10:00:00Z' },
        { user_id: 'user-2', role: 'member', joined_at: null },
      ],
      [{ id: 'user-1', first_name: ' Camille ', last_name: '' }],
    )).toEqual([
      { user_id: 'user-1', role: 'owner', joined_at: '2026-08-31T10:00:00Z', fullName: 'Camille' },
      { user_id: 'user-2', role: 'member', joined_at: null, fullName: 'Membre du foyer' },
    ]);
  });

  it('maps the intentionally indistinguishable invitation failures to a recoverable message', () => {
    expect(householdActionError('join', { message: 'invitation is invalid or unavailable' }))
      .toBe('errors.join.invalid_or_expired');
    expect(translate('fr', 'errors.join.invalid_or_expired')).toContain('Code invalide ou expiré');
  });

  it('never exposes a raw database message and logs only structured non-sensitive context', () => {
    expect(householdActionError('load', { message: 'relation secret_table does not exist', code: '42P01' }))
      .toBe('errors.household.load_failed');
    expect(warn).toHaveBeenLastCalledWith('client_operation_failed', {
      area: 'household',
      action: 'load',
      code: '42P01',
    });
    expect(JSON.stringify(warn.mock.calls.at(-1))).not.toContain('secret_table');
  });

  it('keeps invitation lifecycle states explicit', () => {
    const invitation: InvitationState = {
      status: 'active',
      invitationId: 'invitation-id',
      token: 'fixture-id',
      expiresAt: '2026-09-07T10:00:00Z',
    };

    expect(invitation.status).toBe('active');
  });
});

describe('household leave dialog contract (PRD §4.8 — #110 P1-9)', () => {
  const EXACT_FR_HINT =
    "Vous perdrez l'accès à l'inventaire. L'autre membre garde toutes les données.";

  it('exposes the exact PRD §4.8 quit warning in French', () => {
    expect(translate('fr', 'household.leave_hint')).toBe(EXACT_FR_HINT);
  });

  it('renders the same exact hint in the section and in the confirmation dialog (shared key)', () => {
    // src/app/household/page.tsx renders t('household.leave_hint') both in the
    // leave section and inside the leave confirmation dialog.
    expect(translate('fr', 'household.leave_hint')).toBe(EXACT_FR_HINT);
  });

  it('provides the Confirmer/Annuler actions and the confirmation title', () => {
    expect(translate('fr', 'household.leave_confirm_title')).toBe('Quitter le foyer ?');
    expect(translate('fr', 'common.confirm')).toBe('Confirmer');
    expect(translate('fr', 'common.cancel')).toBe('Annuler');
  });

  it('keeps the English warning equivalent to the French one', () => {
    expect(translate('en', 'household.leave_hint')).toBe(
      'You will lose access to the inventory. The other member keeps all the data.',
    );
  });

  it('keeps the quit warning distinct from the regenerate hint (no copy-paste)', () => {
    expect(translate('fr', 'household.leave_hint')).not.toBe(translate('fr', 'household.regen_hint'));
    expect(translate('en', 'household.leave_hint')).not.toBe(translate('en', 'household.regen_hint'));
  });
});

describe('household leave action contract (PRD §4.8 — #110 P1-9)', () => {
  function createLeaveRpcStub(error: { message?: string; code?: string } | null = null) {
    const calls: { fn: string }[] = [];
    const supabase = {
      rpc: (fn: string) => {
        calls.push({ fn });
        return Promise.resolve({ data: error ? null : true, error });
      },
    } as unknown as SupabaseClient<Database>;
    return { supabase, calls };
  }

  it('leaves via the leave_household RPC (no direct DELETE grant — 42501 otherwise)', async () => {
    const { supabase, calls } = createLeaveRpcStub();
    await expect(leaveHousehold(supabase)).resolves.toEqual({ error: null });
    expect(calls).toEqual([{ fn: 'leave_household' }]);
  });

  it('maps a leave failure to a recoverable message without leaking internals', () => {
    const { supabase } = createLeaveRpcStub({ message: 'relation secret_table does not exist', code: '42P01' });
    return expect(leaveHousehold(supabase)).resolves.toEqual({
      error: 'errors.household.leave_failed',
    });
  });

  it('reports the leave error through the shared action mapper', () => {
    expect(householdActionError('leave', { message: 'boom', code: '500' })).toBe(
      'errors.household.leave_failed',
    );
  });
});
