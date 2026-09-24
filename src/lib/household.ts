import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '@/types/database';
import { translate, type Language } from '@/lib/i18n';

type Membership = Pick<Database['public']['Tables']['household_members']['Row'], 'user_id' | 'role' | 'joined_at'>;
type Profile = Pick<Database['public']['Tables']['profiles']['Row'], 'id' | 'first_name' | 'last_name'>;

export type HouseholdMember = Membership & { fullName: string };

export type InvitationState =
  | { status: 'none' }
  | { status: 'creating' }
  | { status: 'active'; invitationId: string; token: string; expiresAt: string }
  | { status: 'revoking'; invitationId: string; token: string; expiresAt: string }
  // Hydrated from the read function after reload: no token by design (only a
  // digest is stored), so a pending invitation shows metadata + actions but
  // never the code again. Ticket #57.
  | {
      status: 'pending';
      invitationId: string;
      createdAt: string;
      expiresAt: string;
      consumed: boolean;
      revoked: boolean;
    };

export interface InvitationRow {
  invitation_id: string;
  created_at: string;
  expires_at: string;
  revoked_at: string | null;
  consumed_at: string | null;
}

/** Maps a read-function row to the pending state (pure, unit-tested). */
export function toPendingInvitation(row: InvitationRow | undefined): InvitationState {
  if (!row) return { status: 'none' };
  return {
    status: 'pending',
    invitationId: row.invitation_id,
    createdAt: row.created_at,
    expiresAt: row.expires_at,
    consumed: row.consumed_at !== null,
    revoked: row.revoked_at !== null,
  };
}

/**
 * Full shareable invite link for a raw token (ticket #57). Centralizes the
 * format previously built inline on the household page so the members panel
 * and the QR code cannot drift apart.
 */
export function buildInvitationLink(origin: string, token: string): string {
  return `${origin.replace(/\/+$/, '')}/join-household?code=${encodeURIComponent(token)}`;
}

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
  action: 'create' | 'join' | 'load' | 'invite' | 'revoke' | 'copy' | 'leave',
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
  // Ticket #57 : creating is owner-gated DB-side. Name the real cause instead
  // of the generic retry prompt (the panel itself stays reachable by every
  // member — equal-rights decision, members.spec.ts "no owner-only gate").
  if (action === 'invite' && error?.message?.includes('household owner required')) {
    return 'errors.household.owner_required';
  }

  const fallback = {
    create: 'errors.household.create_failed',
    join: 'errors.household.join_failed',
    load: 'errors.household.load_failed',
    invite: 'errors.household.invite_failed',
    revoke: 'errors.household.revoke_failed',
    copy: 'errors.household.copy_failed',
    leave: 'errors.household.leave_failed',
  } as const;

  return fallback[action];
}

/**
 * Quitter le foyer (PRD §4.8) : RPC leave_household SECURITY DEFINER.
 * household_members n'a aucun grant DELETE client ni policy DELETE — un
 * delete direct échoue en 42501. La RPC supprime la seule appartenance de
 * l'appelant (aucun paramètre : impossible de retirer l'autre membre).
 * L'autre membre garde tout intact sans limite de durée (rétention
 * indéfinie, aucune suppression côté inventaire).
 * L'appelant doit ensuite invalider l'état local (0 lecture inventaire)
 * puis signer out / rediriger.
 */
export async function leaveHousehold(
  supabase: SupabaseClient<Database>,
): Promise<{ error: string | null }> {
  const { error } = await supabase.rpc('leave_household');

  if (error) return { error: householdActionError('leave', error) };
  return { error: null };
}
