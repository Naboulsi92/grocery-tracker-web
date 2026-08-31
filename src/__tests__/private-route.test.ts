import { resolvePrivateRoute } from '@/lib/private-route';

describe('resolvePrivateRoute', () => {
  it.each([
    [{ status: 'loading' } as const, { outcome: 'loading' }],
    [{ status: 'anonymous' } as const, { outcome: 'redirect', href: '/login' }],
  ])('resolves %p', (access, expected) => {
    expect(resolvePrivateRoute(access)).toEqual(expected);
  });

  it('sends an authenticated user without a household to onboarding', () => {
    expect(resolvePrivateRoute({ status: 'no-household', user: { id: 'user-1' } as never }))
      .toEqual({ outcome: 'redirect', href: '/join-household' });
  });

  it('exposes recoverable membership errors', () => {
    const warn = jest.spyOn(console, 'warn').mockImplementation(() => undefined);
    expect(resolvePrivateRoute({ status: 'error', user: { id: 'user-1' } as never, error: new Error('database internals') }))
      .toEqual({ outcome: 'error', message: 'Impossible de vérifier votre foyer. Vous pouvez réessayer.' });
    expect(JSON.stringify(warn.mock.calls)).not.toContain('database internals');
    warn.mockRestore();
  });

  it('exposes the validated household to private pages', () => {
    expect(resolvePrivateRoute({ status: 'member', user: { id: 'user-1' } as never, householdId: 'home-1' }))
      .toEqual({ outcome: 'render', householdId: 'home-1' });
  });
});
