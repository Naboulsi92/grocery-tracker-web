import type { PrivateAccess } from '@/contexts/AuthContext';

/**
 * Dashboard shell decision (ticket #56). Unlike the private-route guard
 * (redirects no-household to onboarding — the infinite loop that made
 * "return to my dashboard" impossible), the dashboard resolves the access
 * state itself:
 *   - anonymous → sign-in (the dashboard is not public).
 *   - no-household → onboarding prompt rendered IN the shell (header +
 *     create/join entry points), never a bounce. This also covers a
 *     household disappearing mid-session: the prompt replaces the data.
 *   - member → the dashboard as it is today.
 *   - error → error view with retry (explicit path, unchanged).
 * Pure: unit-tested across every access state.
 */
export type DashboardShellDecision =
  | { outcome: 'loading' }
  | { outcome: 'login' }
  | { outcome: 'onboarding' }
  | { outcome: 'member'; householdId: string }
  | { outcome: 'error' };

export function resolveDashboardShell(access: PrivateAccess): DashboardShellDecision {
  switch (access.status) {
    case 'loading':
      return { outcome: 'loading' };
    case 'anonymous':
      return { outcome: 'login' };
    case 'no-household':
      return { outcome: 'onboarding' };
    case 'member':
      return { outcome: 'member', householdId: access.householdId };
    case 'error':
      return { outcome: 'error' };
  }
}
