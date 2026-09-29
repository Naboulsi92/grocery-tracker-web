import {
  OAUTH_CALLBACK_PATH,
  buildOAuthCallbackUrl,
  resolveOAuthRedirect,
  takeOAuthNext,
} from '@/lib/oauth-redirect';

describe('buildOAuthCallbackUrl (ticket #166)', () => {
  it('forwards a safe destination', () => {
    expect(buildOAuthCallbackUrl('https://example.com/', '/items')).toBe(
      'https://example.com/auth/callback?next=%2Fitems'
    );
  });

  it('omits unsafe or missing destinations', () => {
    expect(buildOAuthCallbackUrl('https://example.com', null)).toBe(
      'https://example.com/auth/callback'
    );
    expect(buildOAuthCallbackUrl('https://example.com', 'https://evil.com')).toBe(
      'https://example.com/auth/callback'
    );
  });

  it('exposes a stable callback path', () => {
    expect(OAUTH_CALLBACK_PATH).toBe('/auth/callback');
  });
});

describe('resolveOAuthRedirect (ticket #166)', () => {
  it('prefers a safe ?next= without touching the stash', () => {
    const takeStashed = jest.fn(() => 'stashed');
    expect(resolveOAuthRedirect('/items', '/home', takeStashed)).toBe('/items');
    expect(takeStashed).not.toHaveBeenCalled();
  });

  it('consumes the stash once when ?next= is absent', () => {
    const takeStashed = jest.fn(() => '/join-household');
    expect(resolveOAuthRedirect(null, '/home', takeStashed)).toBe('/join-household');
    expect(takeStashed).toHaveBeenCalledTimes(1);
  });

  it('ignores unsafe ?next= values without poisoning the stash fallback', () => {
    expect(resolveOAuthRedirect('//evil.com', '/home', () => null)).toBe('/home');
    // An unsafe ?next= never blocks a valid stashed destination either.
    expect(resolveOAuthRedirect('//evil.com', '/home', () => '/items')).toBe('/items');
  });
});

describe('takeOAuthNext storage glue (ticket #166)', () => {
  beforeEach(() => sessionStorage.clear());

  it('round-trips a safe value once', async () => {
    const { stashOAuthNext, peekOAuthNext } = await import('@/lib/oauth-redirect');
    stashOAuthNext('/items');
    expect(peekOAuthNext()).toBe('/items');
    expect(takeOAuthNext()).toBe('/items');
    expect(peekOAuthNext()).toBeNull();
  });

  it('refuses unsafe values', async () => {
    const { stashOAuthNext, peekOAuthNext } = await import('@/lib/oauth-redirect');
    stashOAuthNext('https://evil.com');
    expect(peekOAuthNext()).toBeNull();
  });
});
