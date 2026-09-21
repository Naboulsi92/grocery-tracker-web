import type { MetadataRoute } from 'next';

/**
 * Crawlers may index the public marketing pages, but never the
 * authentication flow nor the authenticated app shell (ticket #118).
 * Defense in depth with the `noindex` metadata in `src/app/(auth)/layout.tsx`:
 * robots.txt is advisory, `noindex` is enforced per page.
 */
export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        userAgent: '*',
        allow: '/',
        disallow: [
          '/login',
          '/signup',
          '/join-household',
          '/home',
          '/items',
          '/categories',
          '/to-buy',
          '/members',
          '/history',
          '/household',
          '/settings',
          '/account',
        ],
      },
    ],
  };
}
