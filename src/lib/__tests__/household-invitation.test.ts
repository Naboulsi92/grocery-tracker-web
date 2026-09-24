import {
  buildInvitationLink,
  householdActionError,
  toPendingInvitation,
} from '@/lib/household';

describe('buildInvitationLink (ticket #57)', () => {
  it('builds the join deep-link with an encoded token', () => {
    expect(buildInvitationLink('https://example.com', 'abc 123')).toBe(
      'https://example.com/join-household?code=abc%20123'
    );
  });

  it('strips a trailing slash from the origin', () => {
    expect(buildInvitationLink('https://example.com/', 'tok')).toBe(
      'https://example.com/join-household?code=tok'
    );
  });
});

describe('toPendingInvitation (ticket #57)', () => {
  const row = {
    invitation_id: 'inv-1',
    created_at: '2026-09-24T09:00:00Z',
    expires_at: '2026-09-25T09:00:00Z',
    revoked_at: null,
    consumed_at: null,
  };

  it('maps a live row to pending without any token', () => {
    expect(toPendingInvitation(row)).toEqual({
      status: 'pending',
      invitationId: 'inv-1',
      createdAt: '2026-09-24T09:00:00Z',
      expiresAt: '2026-09-25T09:00:00Z',
      consumed: false,
      revoked: false,
    });
  });

  it('flags consumed and revoked rows', () => {
    expect(
      toPendingInvitation({ ...row, consumed_at: '2026-09-24T10:00:00Z' })
    ).toMatchObject({ status: 'pending', consumed: true, revoked: false });
    expect(
      toPendingInvitation({ ...row, revoked_at: '2026-09-24T10:00:00Z' })
    ).toMatchObject({ status: 'pending', consumed: false, revoked: true });
  });

  it('maps a missing row to none', () => {
    expect(toPendingInvitation(undefined)).toEqual({ status: 'none' });
  });
});

describe('householdActionError owner gate (ticket #57)', () => {
  it('names the owner requirement instead of the generic retry prompt', () => {
    expect(
      householdActionError('invite', { code: '42501', message: 'household owner required' })
    ).toBe('errors.household.owner_required');
  });

  it('keeps the generic fallback for unknown invite errors', () => {
    expect(householdActionError('invite', { code: 'XX', message: 'boom' })).toBe(
      'errors.household.invite_failed'
    );
  });
});
