import type { MetadataRoute } from 'next';
import { getSiteUrl } from '@/lib/site-url';

/**
 * Public marketing routes for crawlers (ticket #120). Authenticated app
 * routes are excluded here AND disallowed in robots.ts AND served with
 * `X-Robots-Tag: noindex` (next.config.ts) — defense in depth, because the
 * business pages are `'use client'` (a metadata export there is ignored).
 */
const MARKETING_ROUTES = ['', '/about', '/contact', '/privacy', '/terms'] as const;

export function marketingRouteUrls(base: string = getSiteUrl()): string[] {
  return MARKETING_ROUTES.map((route) => `${base}${route}`);
}

export default function sitemap(): MetadataRoute.Sitemap {
  const base = getSiteUrl();
  return marketingRouteUrls(base).map((url) => ({
    url,
    lastModified: new Date(),
    changeFrequency: url === base ? 'weekly' : 'monthly',
    priority: url === base ? 1 : 0.7,
  }));
}
