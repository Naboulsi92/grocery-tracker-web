import { NextResponse, type NextRequest } from 'next/server';
import { createServerClient } from '@supabase/ssr';
import type { Database } from '@/types/database';
import { resolveResetRedirect } from '@/lib/password-reset';

/**
 * Auth callback (ticket #164) — the first in the repo. Exchanges the emailed
 * recovery code for a session, then forwards to the reset page.
 *
 * Handles both link shapes Supabase emits: PKCE ?code= (current templates)
 * and legacy ?token_hash=&type=recovery. Failures (expired, single-use
 * already consumed, missing params) redirect to /forgot-password?error=
 * with a retry path — never a stack trace, never a dead end.
 */
export async function GET(request: NextRequest) {
  const url = new URL(request.url);
  const code = url.searchParams.get('code');
  const tokenHash = url.searchParams.get('token_hash');
  const type = url.searchParams.get('type');
  const next = resolveResetRedirect(url.searchParams.get('next'), '/forgot-password');
  const fail = (error: string) =>
    NextResponse.redirect(new URL(`/forgot-password?error=${error}`, request.url));

  let response = NextResponse.redirect(new URL(next, request.url));
  const supabase = createServerClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll: () => request.cookies.getAll(),
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
          response = NextResponse.redirect(new URL(next, request.url));
          cookiesToSet.forEach(({ name, value, options }) => response.cookies.set(name, value, options));
        },
      },
    }
  );

  if (code) {
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (error) return fail('expired');
    return response;
  }

  if (tokenHash && type) {
    const { error } = await supabase.auth.verifyOtp({
      token_hash: tokenHash,
      type: type as 'recovery',
    });
    if (error) return fail('expired');
    return response;
  }

  return fail('invalid');
}
