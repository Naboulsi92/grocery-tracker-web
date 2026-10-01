import { DM_Sans, Outfit } from 'next/font/google';

/**
 * Brand fonts, self-hosted at build time (ticket #121).
 *
 * Replaces the render-blocking Google Fonts `@import` in globals.css:
 * files are downloaded once during `next build`, served same-origin with
 * `display: swap`, and preloaded automatically by Next.js — no
 * `preconnect` needed (nothing is fetched from fonts.googleapis.com at
 * runtime). The `variable` names match the pre-existing
 * `--font-body` / `--font-display` custom properties consumed across
 * globals.css and marketing.css, so no consumer changes.
 */
export const dmSans = DM_Sans({
  subsets: ['latin'],
  display: 'swap',
  variable: '--font-body',
});

export const outfit = Outfit({
  subsets: ['latin'],
  display: 'swap',
  variable: '--font-display',
});
