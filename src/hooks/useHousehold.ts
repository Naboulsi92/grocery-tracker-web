'use client';

import { useEffect, useState, useCallback } from 'react';
import type { SupabaseClient } from '@supabase/supabase-js';
import { createClient } from '@/utils/supabase/client';
import type { Language } from '@/lib/i18n';
import {
  householdActionError,
  leaveHousehold,
  mergeHouseholdMembers,
  toPendingInvitation,
  type HouseholdMember,
  type InvitationState,
} from '@/lib/household';

export interface Household {
  id: string;
  name: string;
}

interface UseHouseholdOptions {
  supabase?: SupabaseClient;
  language?: Language;
}

interface UseHouseholdResult {
  household: Household | null;
  members: HouseholdMember[];
  invitation: InvitationState;
  loading: boolean;
  error: string;
  actions: {
    createInvitation: () => Promise<void>;
    revokeInvitation: (invitationId: string) => Promise<void>;
    copyInviteCode: () => Promise<boolean>;
    copyText: (text: string) => Promise<boolean>;
    leave: (userId: string) => Promise<{ error: string | null }>;
    refresh: () => void;
  };
}

export function useHousehold(householdId: string, options: UseHouseholdOptions = {}): UseHouseholdResult {
  const [defaultClient] = useState(createClient);
  const supabase = options.supabase ?? defaultClient;
  const language: Language = options.language ?? 'fr';

  const [household, setHousehold] = useState<Household | null>(null);
  const [members, setMembers] = useState<HouseholdMember[]>([]);
  const [invitation, setInvitation] = useState<InvitationState>({ status: 'none' });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [refreshTrigger, setRefreshTrigger] = useState(0);

  const refresh = useCallback(() => {
    setRefreshTrigger((prev) => prev + 1);
  }, []);

  useEffect(() => {
    let active = true;

    async function fetchData() {
      if (!householdId) return;
      setLoading(true);
      setError('');

      const [householdResult, membersResult] = await Promise.all([
        supabase.from('households').select('id, name').eq('id', householdId).maybeSingle(),
        supabase
          .from('household_members')
          .select('user_id, role, joined_at')
          .eq('household_id', householdId)
          .order('joined_at', { ascending: true }),
      ]);

      if (!active) return;
      if (householdResult.error || membersResult.error || !householdResult.data) {
        setError(householdActionError('load', householdResult.error || membersResult.error));
        setLoading(false);
        return;
      }

      const memberships = membersResult.data ?? [];
      const userIds = memberships.map((membership) => membership.user_id);
      const profilesResult = userIds.length
        ? await supabase.from('profiles').select('id, first_name, last_name').in('id', userIds)
        : { data: [], error: null };

      if (!active) return;
      if (profilesResult.error) {
        setError(householdActionError('load', profilesResult.error));
        setLoading(false);
        return;
      }

      setHousehold(householdResult.data);
      setMembers(mergeHouseholdMembers(memberships, profilesResult.data ?? [], language));
      setLoading(false);

      // Ticket #57 : hydrate the live invitation from the read function so it
      // survives a reload. Only fills the 'none' state — a fresh 'active'
      // token (or an in-flight transition) is never clobbered.
      const { data: invitationRows } = await supabase.rpc('get_household_invitation', {
        p_household_id: householdId,
      });
      if (!active) return;
      setInvitation((current) =>
        current.status === 'none' ? toPendingInvitation(invitationRows?.[0]) : current
      );
    }

    void fetchData();
    return () => { active = false; };
  }, [householdId, supabase, refreshTrigger, language]);

  const createInvitation = useCallback(async () => {
    if (!householdId) return;
    setError('');
    setInvitation({ status: 'creating' });

    const { data, error: invitationError } = await supabase.rpc('create_household_invitation', {
      p_household_id: householdId,
    });
    const created = data?.[0];

    if (invitationError || !created) {
      setError(householdActionError('invite', invitationError));
      setInvitation({ status: 'none' });
      return;
    }

    setInvitation({
      status: 'active',
      invitationId: created.invitation_id,
      token: created.token,
      expiresAt: created.expires_at,
    });
  }, [householdId, supabase]);

  const revokeInvitation = useCallback(async (invitationId: string) => {
    if (invitation.status !== 'active' && invitation.status !== 'pending') return;
    const previousInvitation = invitation;
    setError('');
    setInvitation(
      invitation.status === 'active'
        ? { ...invitation, status: 'revoking' }
        : { status: 'none' }
    );

    const { data: revoked, error: revokeError } = await supabase.rpc('revoke_household_invitation', {
      p_invitation_id: invitationId,
    });

    if (revokeError || !revoked) {
      setError(householdActionError('revoke', revokeError));
      setInvitation(previousInvitation);
      return;
    }

    // Back to 'none' with an immediate create affordance. The revoked row
    // surfaces as a pending(revoked) note on the next reload via hydration.
    setInvitation({ status: 'none' });
  }, [invitation, supabase]);

  const copyText = useCallback(async (text: string) => {
    setError('');
    try {
      await navigator.clipboard.writeText(text);
      return true;
    } catch (copyError) {
      setError(householdActionError('copy', copyError instanceof Error ? copyError : null));
      return false;
    }
  }, []);

  const copyInviteCode = useCallback(async () => {
    if (invitation.status !== 'active') return false;
    return copyText(invitation.token);
  }, [invitation, copyText]);

  // PRD §4.8 : après départ, 0 lecture inventaire — on vide l'état local
  // immédiatement (avant même signOut/redirect), la RLS refusant ensuite
  // toute lecture serveur.
  const leave = useCallback(async (userId: string) => {
    if (!userId) return { error: householdActionError('leave', null) };
    setError('');
    const { error: leaveError } = await leaveHousehold(supabase);
    if (leaveError) {
      setError(leaveError);
      return { error: leaveError };
    }
    setHousehold(null);
    setMembers([]);
    setInvitation({ status: 'none' });
    return { error: null };
  }, [supabase]);

  return {
    household,
    members,
    invitation,
    loading,
    error,
    actions: {
      createInvitation,
      revokeInvitation,
      copyInviteCode,
      copyText,
      leave,
      refresh,
    },
  };
}