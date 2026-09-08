'use client';

import { useEffect, useReducer, useRef, type ReactNode } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/contexts/AuthContext';
import { resolvePrivateRoute } from '@/lib/private-route';
import ThemeToggle from '@/components/ThemeToggle';

interface RouteState {
  hasRenderedChildren: boolean;
  lastMemberHouseholdId: string | null;
  needsRedirect: string | null;
}

type RouteAction =
  | { type: 'MEMBER_HOUSEHOLD'; householdId: string }
  | { type: 'RESET_FLAGS' }
  | { type: 'REDIRECT'; href: string };

function routeReducer(state: RouteState, action: RouteAction): RouteState {
  switch (action.type) {
    case 'MEMBER_HOUSEHOLD':
      return {
        ...state,
        lastMemberHouseholdId: action.householdId,
        hasRenderedChildren: true,
      };
    case 'RESET_FLAGS':
      return {
        ...state,
        hasRenderedChildren: false,
        lastMemberHouseholdId: null,
      };
    case 'REDIRECT':
      return {
        ...state,
        needsRedirect: action.href,
      };
  }
}

export function PrivateRoute({ children }: { children: ReactNode }) {
  const { access, retryHousehold } = useAuth();
  const router = useRouter();
  const decision = resolvePrivateRoute(access);
  const retriedRef = useRef(false);
  const prevStatusRef = useRef<typeof access.status | null>(null);
  const [state, dispatch] = useReducer(routeReducer, {
    hasRenderedChildren: false,
    lastMemberHouseholdId: null,
    needsRedirect: null,
  });

  useEffect(() => {
    if (prevStatusRef.current === access.status) return;
    prevStatusRef.current = access.status;

    if (access.status === 'no-household' && !retriedRef.current) {
      retriedRef.current = true;
      retryHousehold();
      return;
    }

    if (decision.outcome === 'redirect') {
      dispatch({ type: 'REDIRECT', href: decision.href });
    }

    if (decision.outcome === 'render') {
      dispatch({ type: 'MEMBER_HOUSEHOLD', householdId: decision.householdId });
    }

    if (access.status === 'no-household' || access.status === 'error') {
      dispatch({ type: 'RESET_FLAGS' });
    }
  }, [access.status, decision, retryHousehold]);

  useEffect(() => {
    if (state.needsRedirect) {
      router.replace(state.needsRedirect);
    }
  }, [state.needsRedirect, router]);

  // If currently rendering as member, show children
  if (decision.outcome === 'render') {
    return children;
  }

  // If we previously rendered children (background re-resolution), keep them mounted
  if (state.hasRenderedChildren && decision.outcome === 'loading' && state.lastMemberHouseholdId) {
    return children;
  }

  const retry = () => {
    retriedRef.current = false;
    retryHousehold();
  };

  return (
    <div className="page-container">
      <ThemeToggle />
      <div className="loading-container" role={decision.outcome === 'error' ? undefined : 'status'}>
        {decision.outcome === 'error' ? (
          <>
            <p role="alert">{decision.message}</p>
            <button className="btn btn-primary" onClick={retry}>Réessayer</button>
          </>
        ) : (
          <>
            <div className="loading-spinner" aria-hidden="true" />
            <p>Chargement...</p>
          </>
        )}
      </div>
    </div>
  );
}
