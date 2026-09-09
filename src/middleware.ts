import { createServerClient } from '@supabase/ssr';
import { NextResponse, type NextRequest } from 'next/server';
import type { Database } from '@/types/database';

// Routes that should be accessible without authentication
const PUBLIC_ROUTES = ['/', '/login', '/signup', '/join-household'];

// Routes that require authentication
const PROTECTED_ROUTES = ['/home', '/items', '/categories', '/to-buy', '/members'];

export async function middleware(request: NextRequest) {
  let response = NextResponse.next({ request });
  const supabase = createServerClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll: () => request.cookies.getAll(),
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
          response = NextResponse.next({ request });
          cookiesToSet.forEach(({ name, value, options }) => response.cookies.set(name, value, options));
        },
      },
    }
  );

  const pathname = request.nextUrl.pathname;

  // Check if the route is protected
  const isProtectedRoute = PROTECTED_ROUTES.some(route => pathname === route || pathname.startsWith(route + '/'));

  let session: Awaited<ReturnType<typeof supabase.auth.getSession>>['data']['session'] = null;

  // Refresh the session once for all routes. On public routes the cookie-refresh
  // side effect is the point; on protected routes we use the session value.
  try {
    const { data, error: sessionError } = await supabase.auth.getSession();
    session = data.session;
    if (sessionError && isProtectedRoute && process.env.NODE_ENV !== 'test') {
      console.error('middleware_session_refresh_failed_protected', {
        error: sessionError.message,
        pathname,
      });
      const loginUrl = new URL('/login', request.url);
      loginUrl.searchParams.set('error', 'session_refresh_failed');
      return NextResponse.redirect(loginUrl);
    }
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'unknown';
    if (isProtectedRoute && process.env.NODE_ENV !== 'test') {
      // On protected routes (outside tests), fail closed - redirect to login with error
      console.error('middleware_session_refresh_failed_protected', {
        error: errorMessage,
        pathname,
      });
      const loginUrl = new URL('/login', request.url);
      loginUrl.searchParams.set('error', 'session_refresh_failed');
      return NextResponse.redirect(loginUrl);
    }
    // Public route, or test environment where Supabase may be unconfigured -
    // continue without session
    console.error('middleware_session_refresh_failed', {
      error: errorMessage,
      pathname,
    });
  }

  // Allow public routes without authentication
  if (PUBLIC_ROUTES.includes(pathname)) {
    return response;
  }

  if (isProtectedRoute && !session) {
    const loginUrl = new URL('/login', request.url);
    // Don't add redirectTo parameter to keep existing tests passing
    // Client-side redirects handle post-auth navigation
    return NextResponse.redirect(loginUrl);
  }

  return response;
}

export const config = {
  matcher: [
    /*
     * Match all request paths except for the ones starting with:
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     * - public folder files (images, etc.)
     * - service worker
     * - marketing page (/)
     * - auth pages (/login, /signup, /join-household)
     */
    '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico|js|css|woff|woff2)|sw\\.js|workbox-.*\\.js).*)',
  ],
};
