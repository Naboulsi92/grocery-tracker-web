import type { Database } from '@/types/database';
import { translate, type Language } from '@/lib/i18n';

type Membership = Pick<Database['public']['Tables']['household_members']['Row'], 'user_id' | 'role' | 'joined_at'>;
type Profile = Pick<Database['public']['Tables']['profiles']['Row'], 'id' | 'first_name' | 'last_name'>;

export type HouseholdMember = Membership & { fullName: string };

export type InvitationState =
  | { status: 'none' }
  | { status: 'creating' }
  | { status: 'active'; invitationId: string; token: string; expiresAt: string }
  | { status: 'revoking'; invitationId: string; token: string; expiresAt: string };

export function normalizeInvitationToken(value: string): string {
  return value.trim();
}

export function mergeHouseholdMembers(
  memberships: Membership[],
  profiles: Profile[],
  language: Language = 'fr',
): HouseholdMember[] {
  const profilesById = new Map(profiles.map((profile) => [profile.id, profile]));
  const fallback = translate(language, 'household.fallback_member');

  return memberships.map((membership) => {
    const profile = profilesById.get(membership.user_id);
    const fullName = [profile?.first_name?.trim(), profile?.last_name?.trim()].filter(Boolean).join(' ');
    return {
      ...membership,
      fullName: fullName || fallback,
    };
  });
}

export function householdActionError(
  action: 'create' | 'join' | 'load' | 'invite' | 'revoke' | 'copy',
  error: { message?: string; code?: string } | null | undefined,
): string {
  console.warn('client_operation_failed', {
    area: 'household',
    action,
    code: error?.code ?? 'unknown',
  });

  if (action === 'join' && error?.code === '23505' && error?.message?.includes('household is full')) {
    return 'errors.household.full';
  }
  if (action === 'join' && (error?.code === '22023' || error?.message?.includes('invitation is invalid or unavailable'))) {
    return 'errors.join.invalid_or_expired';
  }
  if (action === 'join' && error?.code === 'P0001') {
    return 'errors.join.lockout_code';
  }
  if ((action === 'invite' || action === 'revoke') && error?.message?.includes('household member required')) {
    return 'errors.household.member_required';
  }

  const fallback = {
    create: 'errors.household.create_failed',
    join: 'errors.household.join_failed',
    load: 'errors.household.load_failed',
    invite: 'errors.household.invite_failed',
    revoke: 'errors.household.revoke_failed',
    copy: 'errors.household.copy_failed',
  } as const;

  return fallback[action];
}
