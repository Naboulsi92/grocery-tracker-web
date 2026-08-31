import type { Database } from '@/types/database';

type Membership = Pick<Database['public']['Tables']['household_members']['Row'], 'user_id' | 'role' | 'joined_at'>;
type Profile = Pick<Database['public']['Tables']['profiles']['Row'], 'id' | 'display_name'>;

export type HouseholdMember = Membership & { displayName: string };

export type InvitationState =
  | { status: 'none' }
  | { status: 'creating' }
  | { status: 'active'; invitationId: string; token: string; expiresAt: string }
  | { status: 'revoking'; invitationId: string; token: string; expiresAt: string };

export function normalizeInvitationToken(value: string): string {
  return value.trim();
}

export function mergeHouseholdMembers(memberships: Membership[], profiles: Profile[]): HouseholdMember[] {
  const profilesById = new Map(profiles.map((profile) => [profile.id, profile]));

  return memberships.map((membership) => ({
    ...membership,
    displayName: profilesById.get(membership.user_id)?.display_name?.trim() || 'Membre du foyer',
  }));
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

  if (action === 'join' && error?.message?.includes('invitation is invalid or unavailable')) {
    return "Cette invitation est invalide, expirée, révoquée ou déjà utilisée.";
  }
  if ((action === 'invite' || action === 'revoke') && error?.message?.includes('household owner required')) {
    return 'Seul le propriétaire du foyer peut gérer les invitations.';
  }

  const fallback = {
    create: 'Impossible de créer le foyer. Vous pouvez réessayer.',
    join: 'Impossible de rejoindre le foyer. Vérifiez le code et réessayez.',
    load: 'Impossible de charger le foyer. Vous pouvez réessayer.',
    invite: "Impossible de créer l’invitation. Vous pouvez réessayer.",
    revoke: "Impossible de révoquer l’invitation. Vous pouvez réessayer.",
    copy: "Impossible de copier l’invitation. Sélectionnez le code pour le copier manuellement.",
  } as const;

  return fallback[action];
}
