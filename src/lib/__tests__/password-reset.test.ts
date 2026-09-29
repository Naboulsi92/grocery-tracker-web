import {
  AUTH_CALLBACK_PATH,
  FORGOT_PASSWORD_PATH,
  RESET_PASSWORD_PATH,
  buildPasswordResetRedirect,
  normalizeEmail,
  resolveResetRedirect,
} from '@/lib/password-reset';

describe('normalizeEmail (ticket #164)', () => {
  it('trims and lowercases', () => {
    expect(normalizeEmail('  User@Example.TEST ')).toBe('user@example.test');
  });
});

describe('buildPasswordResetRedirect (ticket #164)', () => {
  it('forwards the reset page without a destination', () => {
    expect(buildPasswordResetRedirect('https://example.com', null)).toBe(
      'https://example.com/auth/callback?next=%2Freset-password'
    );
  });

  it('forwards an original destination nested inside', () => {
    // Double-encoded by construction: the callback decodes once (reset page
    // with ?next=%2Fitems), the reset page decodes again (/items).
    expect(buildPasswordResetRedirect('https://example.com/', '/items')).toBe(
      'https://example.com/auth/callback?next=%2Freset-password%3Fnext%3D%252Fitems'
    );
  });

  it('drops unsafe destinations', () => {
    expect(buildPasswordResetRedirect('https://example.com', 'https://evil.com')).toBe(
      'https://example.com/auth/callback?next=%2Freset-password'
    );
  });
});

describe('resolveResetRedirect (ticket #164)', () => {
  it('accepts the reset page with a forwarded destination', () => {
    expect(resolveResetRedirect('/reset-password?next=%2Fitems', '/forgot-password')).toBe(
      '/reset-password?next=%2Fitems'
    );
  });

  it('rejects non-reset targets and unsafe values', () => {
    expect(resolveResetRedirect('/home', '/forgot-password')).toBe('/forgot-password');
    expect(resolveResetRedirect('https://evil.com', '/forgot-password')).toBe(
      '/forgot-password'
    );
    expect(resolveResetRedirect(null, '/forgot-password')).toBe('/forgot-password');
  });

  it('exposes stable path constants', () => {
    expect([FORGOT_PASSWORD_PATH, RESET_PASSWORD_PATH, AUTH_CALLBACK_PATH]).toEqual([
      '/forgot-password',
      '/reset-password',
      '/auth/callback',
    ]);
  });
});
