// This test verifies that the middleware file exports the correct symbol (middleware, not proxy)
// If the file were renamed back to proxy.ts, this test would fail because it would export 'proxy' instead of 'middleware'

// We can't actually run the middleware in Jest because it requires Next.js server APIs
// But we can verify the file exists and has the correct export by checking the source

import * as fs from 'fs';
import * as path from 'path';

jest.mock('@supabase/ssr', () => ({
  createServerClient: jest.fn(),
}));

jest.mock('next/server', () => ({
  NextResponse: {
    next: jest.fn(() => ({ cookies: { set: jest.fn() } })),
    redirect: jest.fn((url: URL | string) => ({ status: 307, url: url.toString() })),
  },
}));

import { createServerClient } from '@supabase/ssr';
import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { middleware } from '../middleware';

describe('middleware', () => {
  const middlewarePath = path.resolve(__dirname, '../middleware.ts');

  it('middleware.ts file exists', () => {
    expect(fs.existsSync(middlewarePath)).toBe(true);
  });

  it('exports a function named middleware (not proxy)', () => {
    const content = fs.readFileSync(middlewarePath, 'utf-8');
    
    // Check that it exports 'middleware' function
    expect(content).toContain('export async function middleware');
    
    // Check that it does NOT export 'proxy' function (the old name)
    expect(content).not.toContain('export async function proxy');
  });

  it('has the correct matcher config', () => {
    const content = fs.readFileSync(middlewarePath, 'utf-8');
    
    // Check that the matcher excludes static assets, marketing page, and auth pages
    expect(content).toContain('_next/static');
    expect(content).toContain('_next/image');
    expect(content).toContain('favicon.ico');
    // The source has double-escaped backslashes in the regex
    expect(content).toContain('sw\\\\.js');
    expect(content).toContain('workbox-.*\\\\.js');
  });

  it('protects authenticated routes', () => {
    const content = fs.readFileSync(middlewarePath, 'utf-8');
    
    // Check that protected routes are defined
    expect(content).toContain('/home');
    expect(content).toContain('/items');
    expect(content).toContain('/categories');
    expect(content).toContain('/to-buy');
    expect(content).toContain('/members');
  });

  it('protects the previously orphan private routes (deny-default, #115)', () => {
    const content = fs.readFileSync(middlewarePath, 'utf-8');

    // The 4 routes missing from PROTECTED_ROUTES (served as 200 shell to anonymous users)
    expect(content).toContain('/account');
    expect(content).toContain('/history');
    expect(content).toContain('/household');
    expect(content).toContain('/settings/notifications');
  });

  it('fails closed on any non-public route (deny-default)', () => {
    const content = fs.readFileSync(middlewarePath, 'utf-8');

    // Enforcement must not rely on the explicit list alone
    expect(content).toContain('deny-default');
    expect(content).toMatch(/!\s*isPublicRoute/);
  });

  it('keeps the landing and auth pages public (no regression)', () => {
    const content = fs.readFileSync(middlewarePath, 'utf-8');

    expect(content).toMatch(/PUBLIC_ROUTES = \[[^\]]*'\/'/);
    expect(content).toContain('/login');
    expect(content).toContain('/signup');
    expect(content).toContain('/join-household');
  });

  it('keeps crawler files public (sitemap/robots, #120)', () => {
    const content = fs.readFileSync(middlewarePath, 'utf-8');

    // The matcher lets images through but NOT .xml/.txt: without these
    // entries deny-default redirects crawlers to /login.
    expect(content).toContain('/sitemap.xml');
    expect(content).toContain('/robots.txt');
  });

  it('matcher comment no longer claims / and auth pages are excluded', () => {
    const content = fs.readFileSync(middlewarePath, 'utf-8');

    // The matcher regex never excluded them (session refresh must run there);
    // the stale comment claimed otherwise.
    expect(content).not.toContain('- marketing page (/)');
    expect(content).not.toContain('- auth pages (/login, /signup, /join-household)');
  });

  it('refreshes session cookie', () => {
    const content = fs.readFileSync(middlewarePath, 'utf-8');
    
    // Check that it calls getSession to refresh the cookie
    expect(content).toContain('getSession');
    expect(content).toContain('createServerClient');
  });

  it('fails closed on protected routes when session refresh throws', () => {
    const content = fs.readFileSync(middlewarePath, 'utf-8');
    
    // Check that a session-refresh failure redirects to login with the error
    expect(content).toContain('session_refresh_failed');
    expect(content).toContain('NextResponse.redirect(loginUrl)');
  });

  it('only fails closed outside the test environment', () => {
    const content = fs.readFileSync(middlewarePath, 'utf-8');
    
    // Check that the fail-closed redirect is gated to the test environment so
    // Supabase may be unconfigured locally
    expect(content).toContain("process.env.NODE_ENV !== 'test'");
  });

  it('calls getSession exactly once (no duplication)', () => {
    const content = fs.readFileSync(middlewarePath, 'utf-8');
    
    // Check that the session is refreshed a single time instead of being
    // duplicated across branches
    expect(content.match(/getSession\(\)/g)?.length).toBe(1);
  });

  it('fails closed when getSession resolves with an error on protected routes', () => {
    const content = fs.readFileSync(middlewarePath, 'utf-8');
    // The resolved-error path must redirect to login with session_refresh_failed
    expect(content).toMatch(/const \{ data, error.*\} = await supabase\.auth\.getSession\(\)/);
    expect(content).toContain('session_refresh_failed');
  });
});

describe('middleware deny-default behavior (#115)', () => {
  const mockGetSession = jest.fn();
  const mockCreateServerClient = createServerClient as jest.Mock;

  function makeRequest(pathname: string): NextRequest {
    return {
      nextUrl: { pathname },
      url: `http://localhost:3000${pathname}`,
      cookies: { getAll: () => [], set: jest.fn() },
    } as unknown as NextRequest;
  }

  type RedirectResult = { status: number; url: string };

  beforeEach(() => {
    jest.clearAllMocks();
    mockCreateServerClient.mockReturnValue({ auth: { getSession: mockGetSession } });
    // Anonymous by default: no session, no error
    mockGetSession.mockResolvedValue({ data: { session: null }, error: null });
  });

  it.each(['/account', '/history', '/household', '/settings/notifications'])(
    'redirects anonymous %s to /login with 307',
    async pathname => {
      const result = (await middleware(makeRequest(pathname))) as unknown as RedirectResult;

      expect(NextResponse.redirect).toHaveBeenCalledTimes(1);
      expect(result.status).toBe(307);
      expect(result.url).toBe('http://localhost:3000/login');
    }
  );

  it('redirects anonymous nested private routes (e.g. /settings/notifications/email)', async () => {
    const result = (await middleware(
      makeRequest('/settings/notifications/email')
    )) as unknown as RedirectResult;

    expect(result.status).toBe(307);
    expect(result.url).toBe('http://localhost:3000/login');
  });

  it.each(['/', '/login', '/signup', '/join-household'])(
    'lets anonymous %s through without redirect',
    async pathname => {
      await middleware(makeRequest(pathname));

      expect(NextResponse.redirect).not.toHaveBeenCalled();
    }
  );

  it('lets an authenticated user reach a private route', async () => {
    mockGetSession.mockResolvedValue({
      data: { session: { user: { id: 'user-1' } } },
      error: null,
    });

    await middleware(makeRequest('/account'));

    expect(NextResponse.redirect).not.toHaveBeenCalled();
  });
});
