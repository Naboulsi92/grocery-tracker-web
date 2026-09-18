import {
  householdActionError,
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
