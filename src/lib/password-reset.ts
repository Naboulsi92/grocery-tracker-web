import { isSafeNextPath } from '@/lib/invite-detour';

/**
 * Password-reset URL builders (ticket #164).
 *
 * The emailed link points at the server callback (which exchanges the code
 * for a session), forwarding the reset page — plus any original destination
 * — in its own validated ?next= parameter. All ?next= consumption reuses
 * the invite-detour validator: same-origin paths only, no open redirect.
 * Pure and unit-tested; no window dependency.
 */

export const FORGOT_PASSWORD_PATH = '/forgot-password';
export const RESET_PASSWORD_PATH = '/reset-password';
export const AUTH_CALLBACK_PATH = '/auth/callback';

/** Normalizes an email for lookup and API calls (trim + lowercase). */
export function normalizeEmail(value: string): string {
  return value.trim().toLowerCase();
}

/** redirectTo for resetPasswordForEmail: callback forwarding the reset page. */
export function buildPasswordResetRedirect(siteUrl: string, next: string | null): string {
  const inner =
    isSafeNextPath(next) && next !== RESET_PASSWORD_PATH
      ? `${RESET_PASSWORD_PATH}?next=${encodeURIComponent(next)}`
      : RESET_PASSWORD_PATH;
  return `${siteUrl.replace(/\/+$/, '')}${AUTH_CALLBACK_PATH}?next=${encodeURIComponent(inner)}`;
}

/**
 * Validates the callback's ?next= target: must be the reset page (with an
 * optional forwarded destination). Anything else falls back — typically the
 * forgot screen with an error state.
 */
export function resolveResetRedirect(
  nextParam: string | null,
  fallback: string = FORGOT_PASSWORD_PATH
): string {
  if (!isSafeNextPath(nextParam)) return fallback;
  const [path] = nextParam.split('?');
  return path === RESET_PASSWORD_PATH ? nextParam : fallback;
}
