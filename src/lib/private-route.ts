import type { PrivateAccess } from '@/contexts/AuthContext';

export type PrivateRouteDecision =
  | { outcome: 'loading' }
  | { outcome: 'redirect'; href: '/login' | '/join-household' }
  | { outcome: 'error'; message: string }
  | { outcome: 'render'; householdId: string };

export function resolvePrivateRoute(access: PrivateAccess): PrivateRouteDecision {
  switch (access.status) {
    case 'loading':
      return { outcome: 'loading' };
    case 'anonymous':
      return { outcome: 'redirect', href: '/login' };
    case 'no-household':
      return { outcome: 'redirect', href: '/join-household' };
    case 'error':
      console.warn('client_operation_failed', {
        area: 'household',
        action: 'access_check',
        code: 'unknown',
      });
      return { outcome: 'error', message: 'Impossible de vérifier votre foyer. Vous pouvez réessayer.' };
    case 'member':
      return { outcome: 'render', householdId: access.householdId };
  }
}
