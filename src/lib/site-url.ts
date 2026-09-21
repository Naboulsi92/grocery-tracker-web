/**
 * Canonical site URL resolution (ticket #118).
 *
 * Priority:
 *   1. `NEXT_PUBLIC_SITE_URL` — explicit, set per environment in Vercel
 *      (Preview + Production + Development). Must be an absolute http(s) URL.
 *   2. `VERCEL_URL` — automatic on Vercel deployments (host without protocol).
 *   3. `http://localhost:3000` — local development fallback.
 *
 * There is intentionally NO hardcoded production domain here: the previous
 * `https://grocerylist.app` placeholder leaked into canonical/OG metadata.
 * An explicitly-set but invalid `NEXT_PUBLIC_SITE_URL` throws fail-fast so a
 * misconfiguration breaks the build instead of silently poisoning SEO tags.
 */

export interface SiteUrlEnv {
  NEXT_PUBLIC_SITE_URL?: string | undefined;
  VERCEL_URL?: string | undefined;
}

function stripTrailingSlashes(value: string): string {
  return value.replace(/\/+$/, '');
}

function isValidHttpUrl(value: string): boolean {
  try {
    const parsed = new URL(value);
    return parsed.protocol === 'http:' || parsed.protocol === 'https:';
  } catch {
    return false;
  }
}

export function resolveSiteUrl(env: NodeJS.ProcessEnv | SiteUrlEnv = process.env): string {
  const explicit = env.NEXT_PUBLIC_SITE_URL?.trim();
  if (explicit) {
    const normalized = stripTrailingSlashes(explicit);
    if (!isValidHttpUrl(normalized)) {
      throw new Error(
        `NEXT_PUBLIC_SITE_URL is not a valid absolute http(s) URL: ${explicit}`,
      );
    }
    return normalized;
  }

  const vercelHost = env.VERCEL_URL?.trim().replace(/\/+$/, '');
  if (vercelHost) {
    return `https://${vercelHost}`;
  }

  return 'http://localhost:3000';
}

/** Canonical site URL for `metadataBase`, OG tags and JSON-LD. */
export function getSiteUrl(): string {
  return resolveSiteUrl(process.env);
}

/** Hostname for services keyed by domain (e.g. Plausible `data-domain`). */
export function getSiteHostname(): string {
  return new URL(getSiteUrl()).hostname;
}
