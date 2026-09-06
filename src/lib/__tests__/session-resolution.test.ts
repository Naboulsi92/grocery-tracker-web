import { shouldReResolve, hasUserIdentityChanged, type AuthEvent, type SessionResolutionInput } from '@/lib/session-resolution';
import type { User } from '@supabase/supabase-js';

const createUser = (id: string): User => ({ id } as unknown as User);

describe('shouldReResolve', () => {
  const baseInput: SessionResolutionInput = {
    event: 'INITIAL_SESSION',
    previousUser: null,
    nextUser: null,
    hasResolvedBefore: false,
  };

  describe('INITIAL_SESSION', () => {
    it('returns true when never resolved before', () => {
      expect(shouldReResolve({ ...baseInput, event: 'INITIAL_SESSION', hasResolvedBefore: false })).toBe(true);
    });

    it('returns false when already resolved before (re-announcement)', () => {
      expect(shouldReResolve({ ...baseInput, event: 'INITIAL_SESSION', hasResolvedBefore: true })).toBe(false);
    });
  });

  describe('SIGNED_IN', () => {
    it('returns true for genuine sign-in', () => {
      expect(shouldReResolve({ ...baseInput, event: 'SIGNED_IN', nextUser: createUser('user-1') })).toBe(true);
    });

    it('returns true even if user was already signed in (session recovery)', () => {
      expect(shouldReResolve({
        ...baseInput,
        event: 'SIGNED_IN',
        previousUser: createUser('user-1'),
        nextUser: createUser('user-1'),
        hasResolvedBefore: true,
      })).toBe(true);
    });
  });

  describe('SIGNED_OUT', () => {
    it('returns true for genuine sign-out', () => {
      expect(shouldReResolve({ ...baseInput, event: 'SIGNED_OUT', previousUser: createUser('user-1'), nextUser: null })).toBe(true);
    });

    it('returns true when going from user to anonymous', () => {
      expect(shouldReResolve({ ...baseInput, event: 'SIGNED_OUT', previousUser: createUser('user-1'), nextUser: null, hasResolvedBefore: true })).toBe(true);
    });
  });

  describe('TOKEN_REFRESHED', () => {
    it('returns false - no re-resolution for token refresh', () => {
      expect(shouldReResolve({
        ...baseInput,
        event: 'TOKEN_REFRESHED',
        previousUser: createUser('user-1'),
        nextUser: createUser('user-1'),
        hasResolvedBefore: true,
      })).toBe(false);
    });

    it('returns false even if never resolved before (edge case)', () => {
      expect(shouldReResolve({ ...baseInput, event: 'TOKEN_REFRESHED', hasResolvedBefore: false })).toBe(false);
    });
  });

  describe('USER_UPDATED', () => {
    it('returns true when user identity changed (account switch)', () => {
      expect(shouldReResolve({
        ...baseInput,
        event: 'USER_UPDATED',
        previousUser: createUser('user-1'),
        nextUser: createUser('user-2'),
        hasResolvedBefore: true,
      })).toBe(true);
    });

    it('returns false when user identity unchanged (profile update)', () => {
      expect(shouldReResolve({
        ...baseInput,
        event: 'USER_UPDATED',
        previousUser: createUser('user-1'),
        nextUser: createUser('user-1'),
        hasResolvedBefore: true,
      })).toBe(false);
    });

    it('returns false when going from null to user (should be SIGNED_IN)', () => {
      expect(shouldReResolve({
        ...baseInput,
        event: 'USER_UPDATED',
        previousUser: null,
        nextUser: createUser('user-1'),
        hasResolvedBefore: false,
      })).toBe(false);
    });
  });

  describe('PASSWORD_RECOVERY', () => {
    it('returns false', () => {
      expect(shouldReResolve({ ...baseInput, event: 'PASSWORD_RECOVERY' })).toBe(false);
    });
  });

  describe('MFA_CHALLENGE_VERIFIED', () => {
    it('returns false', () => {
      expect(shouldReResolve({ ...baseInput, event: 'MFA_CHALLENGE_VERIFIED' })).toBe(false);
    });
  });

  describe('full matrix of events x identity changes with expected values', () => {
    const events: AuthEvent[] = [
      'INITIAL_SESSION',
      'SIGNED_IN',
      'SIGNED_OUT',
      'TOKEN_REFRESHED',
      'USER_UPDATED',
      'PASSWORD_RECOVERY',
      'MFA_CHALLENGE_VERIFIED',
    ];

    const scenarios = [
      { name: 'null -> null', previousUser: null, nextUser: null },
      { name: 'null -> user-1', previousUser: null, nextUser: createUser('user-1') },
      { name: 'user-1 -> null', previousUser: createUser('user-1'), nextUser: null },
      { name: 'user-1 -> user-1 (same)', previousUser: createUser('user-1'), nextUser: createUser('user-1') },
      { name: 'user-1 -> user-2 (different)', previousUser: createUser('user-1'), nextUser: createUser('user-2') },
    ];

    const expected: Record<string, Record<string, { 'false': boolean; 'true': boolean }>> = {
      INITIAL_SESSION: {
        'null -> null': { 'false': true, 'true': false },
        'null -> user-1': { 'false': true, 'true': false },
        'user-1 -> null': { 'false': true, 'true': false },
        'user-1 -> user-1 (same)': { 'false': true, 'true': false },
        'user-1 -> user-2 (different)': { 'false': true, 'true': false },
      },
      SIGNED_IN: {
        'null -> null': { 'false': true, 'true': true },
        'null -> user-1': { 'false': true, 'true': true },
        'user-1 -> null': { 'false': true, 'true': true },
        'user-1 -> user-1 (same)': { 'false': true, 'true': true },
        'user-1 -> user-2 (different)': { 'false': true, 'true': true },
      },
      SIGNED_OUT: {
        'null -> null': { 'false': true, 'true': true },
        'null -> user-1': { 'false': true, 'true': true },
        'user-1 -> null': { 'false': true, 'true': true },
        'user-1 -> user-1 (same)': { 'false': true, 'true': true },
        'user-1 -> user-2 (different)': { 'false': true, 'true': true },
      },
      TOKEN_REFRESHED: {
        'null -> null': { 'false': false, 'true': false },
        'null -> user-1': { 'false': false, 'true': false },
        'user-1 -> null': { 'false': false, 'true': false },
        'user-1 -> user-1 (same)': { 'false': false, 'true': false },
        'user-1 -> user-2 (different)': { 'false': false, 'true': false },
      },
      USER_UPDATED: {
        'null -> null': { 'false': false, 'true': false },
        'null -> user-1': { 'false': false, 'true': false },
        'user-1 -> null': { 'false': true, 'true': true },
        'user-1 -> user-1 (same)': { 'false': false, 'true': false },
        'user-1 -> user-2 (different)': { 'false': true, 'true': true },
      },
      PASSWORD_RECOVERY: {
        'null -> null': { 'false': false, 'true': false },
        'null -> user-1': { 'false': false, 'true': false },
        'user-1 -> null': { 'false': false, 'true': false },
        'user-1 -> user-1 (same)': { 'false': false, 'true': false },
        'user-1 -> user-2 (different)': { 'false': false, 'true': false },
      },
      MFA_CHALLENGE_VERIFIED: {
        'null -> null': { 'false': false, 'true': false },
        'null -> user-1': { 'false': false, 'true': false },
        'user-1 -> null': { 'false': false, 'true': false },
        'user-1 -> user-1 (same)': { 'false': false, 'true': false },
        'user-1 -> user-2 (different)': { 'false': false, 'true': false },
      },
    };

    for (const event of events) {
      for (const scenario of scenarios) {
        for (const hasResolvedBefore of [false, true]) {
          it(`${event} | ${scenario.name} | hasResolvedBefore=${hasResolvedBefore}`, () => {
            const result = shouldReResolve({
              ...baseInput,
              event,
              previousUser: scenario.previousUser,
              nextUser: scenario.nextUser,
              hasResolvedBefore,
            });
            expect(result).toBe(expected[event][scenario.name][hasResolvedBefore.toString() as 'false' | 'true']);
          });
        }
      }
    }
  });
});

describe('hasUserIdentityChanged', () => {
  it('returns false when both users are null', () => {
    expect(hasUserIdentityChanged(null, null)).toBe(false);
  });

  it('returns true when previous is null and next is user', () => {
    expect(hasUserIdentityChanged(null, createUser('user-1'))).toBe(true);
  });

  it('returns true when previous is user and next is null', () => {
    expect(hasUserIdentityChanged(createUser('user-1'), null)).toBe(true);
  });

  it('returns false when both users have same id', () => {
    expect(hasUserIdentityChanged(createUser('user-1'), createUser('user-1'))).toBe(false);
  });

  it('returns true when users have different ids', () => {
    expect(hasUserIdentityChanged(createUser('user-1'), createUser('user-2'))).toBe(true);
  });
});