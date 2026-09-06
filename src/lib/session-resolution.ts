import type { Session, User } from '@supabase/supabase-js';

export type AuthEvent =
  | 'INITIAL_SESSION'
  | 'SIGNED_IN'
  | 'SIGNED_OUT'
  | 'TOKEN_REFRESHED'
  | 'USER_UPDATED'
  | 'PASSWORD_RECOVERY'
  | 'MFA_CHALLENGE_VERIFIED';

export interface SessionResolutionInput {
  event: AuthEvent;
  previousUser: User | null;
  nextUser: User | null;
  hasResolvedBefore: boolean;
}

export function shouldReResolve(input: SessionResolutionInput): boolean {
  const { event, previousUser, nextUser, hasResolvedBefore } = input;

  const previousUserId = previousUser?.id ?? null;
  const nextUserId = nextUser?.id ?? null;

  const userIdentityChanged = previousUserId !== nextUserId;

  switch (event) {
    case 'SIGNED_IN':
      return true;
    case 'SIGNED_OUT':
      return true;
    case 'USER_UPDATED':
      // USER_UPDATED should not fire for null -> user transitions (that's SIGNED_IN)
      // Only re-resolve if we had a previous user and the identity changed
      return previousUser !== null && userIdentityChanged;
    case 'TOKEN_REFRESHED':
      return false;
    case 'INITIAL_SESSION':
      return !hasResolvedBefore;
    case 'PASSWORD_RECOVERY':
    case 'MFA_CHALLENGE_VERIFIED':
      return false;
    default:
      return false;
  }
}

export function getUserId(user: User | null): string | null {
  return user?.id ?? null;
}

export function hasUserIdentityChanged(previousUser: User | null, nextUser: User | null): boolean {
  return getUserId(previousUser) !== getUserId(nextUser);
}