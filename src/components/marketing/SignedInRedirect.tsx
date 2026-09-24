'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/contexts/AuthContext';

/**
 * Ticket #56 : signed-in visitors skip the marketing pitch and land on
 * their dashboard. Fires only once the session resolves — anonymous
 * visitors render the landing immediately with no waiting and no redirect.
 */
export function SignedInRedirect() {
  const { user, loading } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (!loading && user) {
      router.replace('/home');
    }
  }, [loading, user, router]);

  return null;
}
