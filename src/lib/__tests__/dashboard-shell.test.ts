import { resolveDashboardShell } from '@/lib/dashboard-shell';

describe('resolveDashboardShell (ticket #56)', () => {
  it('loads on the initial resolution', () => {
    expect(resolveDashboardShell({ status: 'loading' })).toEqual({ outcome: 'loading' });
  });

  it('sends anonymous visitors to sign-in', () => {
    expect(resolveDashboardShell({ status: 'anonymous' })).toEqual({ outcome: 'login' });
  });

  it('renders the onboarding prompt instead of bouncing (the former loop)', () => {
    expect(
      resolveDashboardShell({ status: 'no-household', user: { id: 'u1' } as never })
    ).toEqual({ outcome: 'onboarding' });
  });

  it('renders the dashboard for members with their household', () => {
    expect(
      resolveDashboardShell({ status: 'member', user: { id: 'u1' } as never, householdId: 'h1' })
    ).toEqual({ outcome: 'member', householdId: 'h1' });
  });

  it('keeps the explicit error path', () => {
    expect(
      resolveDashboardShell({ status: 'error', user: null, error: new Error('down') })
    ).toEqual({ outcome: 'error' });
  });
});
