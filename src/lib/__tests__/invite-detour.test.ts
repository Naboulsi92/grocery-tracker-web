import {
  PENDING_INVITE_KEY,
  isSafeNextPath,
  joinWithCode,
  loginWithNext,
  resolvePostAuthRedirect,
} from '@/lib/invite-detour';

describe('isSafeNextPath (ticket #58)', () => {
  it.each([
    ['/join-household?code=abc', true],
    ['/home', true],
    ['/', true],
  ])('accepts %s', (value, expected) => {
    expect(isSafeNextPath(value)).toBe(expected);
  });

  it.each<[string | null, string]>([
    [null, 'null'],
    ['', 'empty'],
    ['https://evil.com', 'absolute URL'],
    ['//evil.com/path', 'protocol-relative'],
    ['javascript:alert(1)', 'scheme'],
    ['/\\evil.com', 'backslash escape'],
    ['join-household', 'relative path'],
  ])('rejects %s (%s)', (value) => {
    expect(isSafeNextPath(value)).toBe(false);
  });
});

describe('resolvePostAuthRedirect (ticket #58)', () => {
  it('prefers a safe ?next= target', () => {
    expect(
      resolvePostAuthRedirect('/join-household?code=abc', '/home', () => 'stashed')
    ).toBe('/join-household?code=abc');
  });

  it('falls back to a stashed token (consumed once)', () => {
    const takeStashed = jest.fn(() => 'stashed-token');
    expect(resolvePostAuthRedirect(null, '/home', takeStashed)).toBe(
      '/join-household?code=stashed-token'
    );
    expect(takeStashed).toHaveBeenCalledTimes(1);
  });

  it('rejects an unsafe ?next= and still honors the stash', () => {
    expect(
      resolvePostAuthRedirect('https://evil.com', '/home', () => 'stashed-token')
    ).toBe('/join-household?code=stashed-token');
  });

  it('uses the fallback with neither target nor stash', () => {
    expect(resolvePostAuthRedirect(null, '/home', () => null)).toBe('/home');
  });
});

describe('detour URL builders (ticket #58)', () => {
  it('builds the login target preserving the invitation', () => {
    expect(loginWithNext('/join-household?code=abc')).toBe(
      '/login?next=%2Fjoin-household%3Fcode%3Dabc'
    );
  });

  it('builds the join URL for a token', () => {
    expect(joinWithCode('abc')).toBe('/join-household?code=abc');
  });

  it('exposes a stable storage key', () => {
    expect(PENDING_INVITE_KEY).toBe('grocery.pending-invite-token');
  });
});
