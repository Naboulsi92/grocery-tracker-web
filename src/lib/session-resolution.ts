import type { User } from '@supabase/supabase-js';

export type UserId = string;

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

const NO_OP_EVENTS: ReadonlySet<AuthEvent> = new Set([
  'TOKEN_REFRESHED',
  'PASSWORD_RECOVERY',
  'MFA_CHALLENGE_VERIFIED',
]);

export function shouldReResolve(input: SessionResolutionInput): boolean {
  const { event, previousUser, nextUser, hasResolvedBefore } = input;

  if (NO_OP_EVENTS.has(event)) {
    return false;
  }

  const previousUserId = previousUser?.id ?? null;
  const nextUserId = nextUser?.id ?? null;
  const userIdentityChanged = previousUserId !== nextUserId;

  switch (event) {
    case 'SIGNED_IN':
      return true;
    case 'SIGNED_OUT':
      return true;
    case 'USER_UPDATED':
      return previousUser !== null && userIdentityChanged;
    case 'INITIAL_SESSION':
      return !hasResolvedBefore;
    default:
      return false;
  }
}

export function getUserId(user: User | null): UserId | null {
  return user?.id ?? null;
}

export function hasUserIdentityChanged(previousUser: User | null, nextUser: User | null): boolean {
  return getUserId(previousUser) !== getUserId(nextUser);
}