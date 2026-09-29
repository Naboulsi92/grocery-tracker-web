import type { User } from '@supabase/supabase-js';

/**
 * Provider detection for email-only gating (ticket #166).
 *
 * PRD: password change/reset are reserved for email accounts — provider
 * accounts (Google/Apple manage their own security) get explanatory panels
 * instead of password forms. Last-sign-in provider wins for display; ANY
 * non-email identity counts as a provider account for gating (a user who
 * linked Google must not be offered a password form even if they last used
 * email — changing it would desync the linked identities).
 */

export type AuthProvider = 'email' | 'google' | 'apple';

const KNOWN_PROVIDERS: AuthProvider[] = ['email', 'google', 'apple'];

function normalizeProvider(value: unknown): AuthProvider | null {
  return typeof value === 'string' &&
    (KNOWN_PROVIDERS as string[]).includes(value.toLowerCase())
    ? (value.toLowerCase() as AuthProvider)
    : null;
}

export function getAuthProvider(user: User | null): AuthProvider {
  if (!user) return 'email';
  const identities = (user.identities ?? [])
    .map((identity) => normalizeProvider(identity.provider))
    .filter((provider): provider is AuthProvider => provider !== null);
  const nonEmail = identities.find((provider) => provider !== 'email');
  if (nonEmail) return nonEmail;
  return (
    normalizeProvider(user.app_metadata?.provider) ??
    normalizeProvider(user.app_metadata?.providers?.[0]) ??
    'email'
  );
}

/** Display name for interpolation (no new i18n keys needed). */
export function providerDisplayName(provider: AuthProvider): string {
  return provider === 'apple' ? 'Apple' : provider === 'google' ? 'Google' : 'Email';
}
