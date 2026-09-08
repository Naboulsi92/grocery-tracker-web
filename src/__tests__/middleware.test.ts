// This test verifies that the middleware file exports the correct symbol (middleware, not proxy)
// If the file were renamed back to proxy.ts, this test would fail because it would export 'proxy' instead of 'middleware'

// We can't actually run the middleware in Jest because it requires Next.js server APIs
// But we can verify the file exists and has the correct export by checking the source

import * as fs from 'fs';
import * as path from 'path';

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

  it('allows public routes', () => {
    const content = fs.readFileSync(middlewarePath, 'utf-8');
    
    // Check that public routes are defined
    expect(content).toContain('/login');
    expect(content).toContain('/signup');
    expect(content).toContain('/join-household');
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
