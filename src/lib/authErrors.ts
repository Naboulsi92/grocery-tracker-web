/**
 * Maps Supabase Auth failures to i18n dictionary keys (ticket #122).
 *
 * Auth API errors carry English messages with no stable per-case codes, so
 * matching is by message substring — ordered most-specific first. Unknown
 * shapes fall back to errors.auth.unknown: raw server text is never shown.
 */
export const AUTH_ERROR_KEYS = {
  INVALID_CREDENTIALS_KEY: 'errors.auth.invalid_credentials',
  EMAIL_NOT_CONFIRMED_KEY: 'errors.auth.email_not_confirmed',
  USER_EXISTS_KEY: 'errors.auth.user_exists',
  WEAK_PASSWORD_KEY: 'errors.auth.weak_password',
  NETWORK_KEY: 'errors.auth.network_error',
  UNKNOWN_KEY: 'errors.auth.unknown',
} as const;

export function mapAuthErrorToKey(error: { message?: string } | null | undefined): string {
  const message = (error?.message ?? '').toLowerCase();
  if (!message) return AUTH_ERROR_KEYS.UNKNOWN_KEY;
  if (message.includes('invalid login credentials') || message.includes('invalid email or password')) {
    return AUTH_ERROR_KEYS.INVALID_CREDENTIALS_KEY;
  }
  if (message.includes('email not confirmed')) {
    return AUTH_ERROR_KEYS.EMAIL_NOT_CONFIRMED_KEY;
  }
  if (message.includes('user already registered') || message.includes('already been registered')) {
    return AUTH_ERROR_KEYS.USER_EXISTS_KEY;
  }
  if (
    message.includes('password should be') ||
    message.includes('password is too short') ||
    message.includes('weak password')
  ) {
    return AUTH_ERROR_KEYS.WEAK_PASSWORD_KEY;
  }
  if (
    message.includes('failed to fetch') ||
    message.includes('network') ||
    message.includes('load failed')
  ) {
    return AUTH_ERROR_KEYS.NETWORK_KEY;
  }
  return AUTH_ERROR_KEYS.UNKNOWN_KEY;
}
