import { buildInvitationLink } from '@/lib/household';

/**
 * Invitation surviving the sign-in/sign-up detour (ticket #58).
 *
 * An invitee without an account opens /join-household?code=X while anonymous
 * and is bounced to /login. The token travels two ways so the detour never
 * dead-ends:
 *   1. `?next=` query param — the primary carrier, propagated login → signup
 *      → back to /join-household?code=X. Same-origin paths only (validated).
 *   2. sessionStorage stash — the safety net (tab closed mid-detour, manual
 *      navigation to /signup, back-button weirdness). Single-consumption:
 *      whoever completes the detour clears it.
 */

export const PENDING_INVITE_KEY = 'grocery.pending-invite-token';

function storage(): Storage | null {
  try {
    return window.sessionStorage;
  } catch {
    return null;
  }
}

export function stashPendingInvite(token: string): void {
  const trimmed = token.trim();
  if (!trimmed) return;
  storage()?.setItem(PENDING_INVITE_KEY, trimmed);
}

export function peekPendingInvite(): string | null {
  return storage()?.getItem(PENDING_INVITE_KEY) ?? null;
}

/** Reads and clears the stashed token (single consumption). */
export function takePendingInvite(): string | null {
  const store = storage();
  const token = store?.getItem(PENDING_INVITE_KEY) ?? null;
  store?.removeItem(PENDING_INVITE_KEY);
  return token;
}

/** Login target preserving the invitation detour. */
export function loginWithNext(target: string): string {
  return `/login?next=${encodeURIComponent(target)}`;
}

/** Join URL carrying a raw token (buildInvitationLink with an empty origin). */
export function joinWithCode(token: string): string {
  return buildInvitationLink('', token);
}

/**
 * Same-origin guard for ?next= (open-redirect protection). Accepts absolute
 * paths only: single leading slash, no protocol, no backslash escape.
 */
export function isSafeNextPath(value: string | null): value is string {
  if (!value) return false;
  return (
    value.startsWith('/') &&
    !value.startsWith('//') &&
    !value.includes('\\') &&
    !/^[a-zA-Z][a-zA-Z0-9+.-]*:/.test(value)
  );
}

/**
 * Post-auth landing: the validated ?next= target, else the join page with a
 * stashed token (consumed), else the fallback. Pure except the single
 * storage take — unit-tested with a storage stub.
 */
export function resolvePostAuthRedirect(
  nextParam: string | null,
  fallback: string,
  takeStashed: () => string | null = takePendingInvite
): string {
  if (isSafeNextPath(nextParam)) return nextParam;
  const stashed = takeStashed();
  if (stashed) return joinWithCode(stashed);
  return fallback;
}
