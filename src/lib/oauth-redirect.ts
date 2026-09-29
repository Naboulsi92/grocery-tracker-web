import { isSafeNextPath } from '@/lib/invite-detour';

/**
 * OAuth post-auth destination helpers (ticket #166).
 *
 * signInWithOAuth redirectTo is fragile by design (GoTrue silently falls
 * back to site_url on mismatch — proven on admin generateLink): the
 * destination travels two ways. Primary carrier is ?next= inside redirectTo
 * (the mainstream user endpoint honors it); safety net is a
 * single-consumption sessionStorage stash, read client-side wherever the
 * server cannot reach it. Pure except the stash glue; unit-tested.
 */

export const OAUTH_CALLBACK_PATH = '/auth/callback';
export const OAUTH_NEXT_KEY = 'grocery.post-oauth-next';

function storage(): Storage | null {
  try {
    return window.sessionStorage;
  } catch {
    return null;
  }
}

export function stashOAuthNext(next: string | null): void {
  if (!isSafeNextPath(next)) return;
  storage()?.setItem(OAUTH_NEXT_KEY, next);
}

export function peekOAuthNext(): string | null {
  const value = storage()?.getItem(OAUTH_NEXT_KEY) ?? null;
  return isSafeNextPath(value) ? value : null;
}

/** Reads and clears the stashed destination (single consumption: a previous
 * deep link must never hijack a later plain login). */
export function takeOAuthNext(): string | null {
  const store = storage();
  const raw = store?.getItem(OAUTH_NEXT_KEY) ?? null;
  store?.removeItem(OAUTH_NEXT_KEY);
  return isSafeNextPath(raw) ? raw : null;
}

/** redirectTo for signInWithOAuth: confirm route forwarding a safe ?next=. */
export function buildOAuthCallbackUrl(siteUrl: string, next: string | null): string {
  const suffix = isSafeNextPath(next) ? `?next=${encodeURIComponent(next)}` : '';
  return `${siteUrl.replace(/\/+$/, '')}${OAUTH_CALLBACK_PATH}${suffix}`;
}

/**
 * Resolves the post-OAuth landing: validated ?next=, else the stashed value
 * (consumed), else the membership fallback. The takeStashed seam keeps this
 * pure for tests (server route passes a no-op — no window there).
 */
export function resolveOAuthRedirect(
  nextParam: string | null,
  fallback: string,
  takeStashed: () => string | null = takeOAuthNext
): string {
  if (isSafeNextPath(nextParam)) return nextParam;
  const stashed = takeStashed();
  if (stashed) return stashed;
  return fallback;
}
