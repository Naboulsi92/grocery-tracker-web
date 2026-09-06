'use client';

import { useEffect, useRef, useState, type ReactNode } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/contexts/AuthContext';
import { resolvePrivateRoute } from '@/lib/private-route';
import ThemeToggle from '@/components/ThemeToggle';

export function PrivateRoute({ children }: { children: ReactNode }) {
  const { access, retryHousehold } = useAuth();
  const router = useRouter();
  const decision = resolvePrivateRoute(access);
  const redirectHref = decision.outcome === 'redirect' ? decision.href : null;
  const retriedMembership = useRef(false);
  const [hasRenderedChildren, setHasRenderedChildren] = useState(false);
  const lastMemberAccess = useRef<{ householdId: string } | null>(null);

  useEffect(() => {
    if (access.status === 'no-household' && !retriedMembership.current) {
      retriedMembership.current = true;
      retryHousehold();
      return;
    }

    if (redirectHref) {
      router.replace(redirectHref);
    }
  }, [access.status, redirectHref, retryHousehold, router]);

  if (decision.outcome === 'render') {
    lastMemberAccess.current = { householdId: decision.householdId };
    if (!hasRenderedChildren) {
      setHasRenderedChildren(true);
    }
    return children;
  }

  // If we previously rendered children (background re-resolution), keep them mounted
  // Only if the last access was a valid member (not an error/no-household state)
  if (hasRenderedChildren && decision.outcome === 'loading' && lastMemberAccess.current) {
    return children;
  }

  // If we lost household membership during background re-resolution, clear the flag
  if (hasRenderedChildren && (decision.outcome === 'no-household' || decision.outcome === 'error')) {
    setHasRenderedChildren(false);
  }

  const retry = () => {
    retriedMembership.current = false;
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