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
 * - `style-src 'unsafe-inline'`: required by Tailwind-in-JS style injection.
 * - `connect-src`: Supabase (https + wss realtime, `*.supabase.co`) +
 *   Plausible + local `supabase start` origins for development.
 * - `frame-ancestors 'none'` mirrors `X-Frame-Options: DENY`.
 */
const contentSecurityPolicy = [
  "default-src 'self'",
  "script-src 'self' 'unsafe-inline' https://plausible.io",
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
    ];
  },
};

export default nextConfig;
