import type { User } from '@supabase/supabase-js';
import { getAuthProvider, providerDisplayName } from '@/lib/auth-provider';

function user(overrides: Partial<User> = {}): User {
  return {
    id: 'user-1',
    app_metadata: { provider: 'email', providers: ['email'] },
    identities: [],
    ...overrides,
  } as User;
}

describe('getAuthProvider (ticket #166)', () => {
  it('defaults email for null users and email-only accounts', () => {
    expect(getAuthProvider(null)).toBe('email');
    expect(getAuthProvider(user())).toBe('email');
  });

  it('detects google and apple identities', () => {
    expect(
      getAuthProvider(user({ identities: [{ provider: 'google' }] as never }))
    ).toBe('google');
    expect(
      getAuthProvider(user({ identities: [{ provider: 'apple' }] as never }))
    ).toBe('apple');
  });

  it('treats any non-email identity as provider account even if last sign-in was email', () => {
    expect(
      getAuthProvider(
        user({
          app_metadata: { provider: 'email', providers: ['email', 'google'] },
          identities: [{ provider: 'email' }, { provider: 'google' }] as never,
        })
      )
    ).toBe('google');
  });

  it('falls back to app_metadata when identities are absent', () => {
    expect(
      getAuthProvider(user({ app_metadata: { provider: 'google' } }))
    ).toBe('google');
  });
});

describe('providerDisplayName (ticket #166)', () => {
  it('names providers without new i18n keys', () => {
    expect(providerDisplayName('google')).toBe('Google');
    expect(providerDisplayName('apple')).toBe('Apple');
    expect(providerDisplayName('email')).toBe('Email');
  });
});
