import type { NextConfig } from "next";
import path from "node:path";
import { fileURLToPath } from "node:url";

const projectRoot = path.dirname(fileURLToPath(import.meta.url));

/**
 * Starter Content Security Policy (ticket #118).
 *
 * - `default-src 'self'` baseline.
 * - `script-src 'unsafe-inline'`: required by the two inline theme/lang
 *   bootstraps in `src/app/layout.tsx` and by Next.js runtime inlining.
 *   Follow-up: move to nonces (see audit H3).
 * - `script-src 'unsafe-eval'` (development only): React dev mode needs
 *   `eval()` for callstack reconstruction. E2E runs `next dev`, so without
 *   it every render logs "eval() is not supported" and the Next.js dev
 *   error overlay (`[data-nextjs-dialog]`) pollutes the DOM, breaking
 *   `mobile-responsiveness.spec.ts:146`. Production stays strict.
 * - `style-src 'unsafe-inline'`: required by Tailwind-in-JS style injection.
 * - `connect-src`: Supabase (https + wss realtime, `*.supabase.co`) +
 *   Plausible + local `supabase start` origins for development.
 * - `frame-ancestors 'none'` mirrors `X-Frame-Options: DENY`.
 */
const isDev = process.env.NODE_ENV !== 'production';
const scriptSrc = isDev
  ? "script-src 'self' 'unsafe-inline' 'unsafe-eval' https://plausible.io"
  : "script-src 'self' 'unsafe-inline' https://plausible.io";

const contentSecurityPolicy = [
  "default-src 'self'",
  scriptSrc,
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' data: blob: https:",
  "font-src 'self' data:",
  "connect-src 'self' https://*.supabase.co wss://*.supabase.co https://plausible.io http://127.0.0.1:* ws://127.0.0.1:* http://localhost:* ws://localhost:*",
  "frame-ancestors 'none'",
  "form-action 'self'",
  "base-uri 'self'",
  "object-src 'none'",
].join('; ');

const securityHeaders = [
  {
    key: 'Strict-Transport-Security',
    value: 'max-age=63072000; includeSubDomains; preload',
  },
  { key: 'X-Frame-Options', value: 'DENY' },
  { key: 'X-Content-Type-Options', value: 'nosniff' },
  { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
  {
    key: 'Permissions-Policy',
    value: 'camera=(), microphone=(), geolocation=(), payment=(), usb=(), interest-cohort=()',
  },
  { key: 'Content-Security-Policy', value: contentSecurityPolicy },
];

/**
 * Authenticated app shell (ticket #120): crawlers are disinvited via
 * robots.ts (advisory) and `robots: noindex` metadata on the `(auth)` group,
 * but the business pages are `'use client'` (a metadata export there is
 * ignored by Next.js) — so enforcement lives here as `X-Robots-Tag`.
 */
const noIndexHeaders = [{ key: 'X-Robots-Tag', value: 'noindex, nofollow' }];

const NOINDEX_SOURCES = [
  '/home',
  '/items',
  '/categories',
  '/to-buy',
  '/members',
  '/history',
  '/household',
  '/account',
  '/settings/:path*',
];

const nextConfig: NextConfig = {
  turbopack: {
    root: projectRoot,
  },
  async headers() {
    return [
      {
        source: '/:path*',
        headers: securityHeaders,
      },
      ...NOINDEX_SOURCES.map((source) => ({ source, headers: noIndexHeaders })),
    ];
  },
};

export default nextConfig;
