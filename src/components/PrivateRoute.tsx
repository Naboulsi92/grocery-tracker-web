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
  const currentHouseholdId = decision.outcome === 'render' ? decision.householdId : null;
  const retriedMembership = useRef(false);
  const [hasRenderedChildren, setHasRenderedChildren] = useState(false);
  const [lastMemberHouseholdId, setLastMemberHouseholdId] = useState<string | null>(null);

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

  // Track when we've successfully rendered children as a member
  useEffect(() => {
    if (currentHouseholdId) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setLastMemberHouseholdId(currentHouseholdId);
      if (!hasRenderedChildren) {
        // eslint-disable-next-line react-hooks/set-state-in-effect
        setHasRenderedChildren(true);
      }
    }
  }, [currentHouseholdId, hasRenderedChildren]);

  // Clear flag when access is lost (no-household or error)
  useEffect(() => {
    if (hasRenderedChildren && (access.status === 'no-household' || access.status === 'error')) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setHasRenderedChildren(false);
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setLastMemberHouseholdId(null);
    }
  }, [hasRenderedChildren, access.status]);

  // If currently rendering as member, show children
  if (decision.outcome === 'render') {
    return children;
  }

  // If we previously rendered children (background re-resolution), keep them mounted
  // Only if the last access was a valid member (not an error/no-household state)
  if (hasRenderedChildren && decision.outcome === 'loading' && lastMemberHouseholdId) {
    return children;
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