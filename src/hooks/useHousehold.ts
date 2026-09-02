'use client';

import { useEffect, useState, useCallback } from 'react';
import type { SupabaseClient } from '@supabase/supabase-js';
import { createClient } from '@/utils/supabase/client';
import {
  householdActionError,
  mergeHouseholdMembers,
  type HouseholdMember,
  type InvitationState,
} from '@/lib/household';

interface Household {
  id: string;
  name: string;
}

interface UseHouseholdOptions {
  supabase?: SupabaseClient;
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
    copyInviteCode: () => Promise<void>;
    refresh: () => void;
  };
}

export function useHousehold(householdId: string, options: UseHouseholdOptions = {}): UseHouseholdResult {
  const supabase = options.supabase ?? createClient();

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
        ? await supabase.from('profiles').select('id, display_name').in('id', userIds)
        : { data: [], error: null };

      if (!active) return;
      if (profilesResult.error) {
        setError(householdActionError('load', profilesResult.error));
        setLoading(false);
        return;
      }

      setHousehold(householdResult.data);
      setMembers(mergeHouseholdMembers(memberships, profilesResult.data ?? []));
      setLoading(false);
    }

    void fetchData();
    return () => { active = false; };
  }, [householdId, options.supabase, refreshTrigger]);

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
    if (invitation.status !== 'active') return;
    const activeInvitation = invitation;
    setError('');
    setInvitation({ ...activeInvitation, status: 'revoking' });

    const { data: revoked, error: revokeError } = await supabase.rpc('revoke_household_invitation', {
      p_invitation_id: invitationId,
    });

    if (revokeError || !revoked) {
      setError(householdActionError('revoke', revokeError));
      setInvitation(activeInvitation);
      return;
    }

    setInvitation({ status: 'none' });
  }, [invitation, supabase]);

  const copyInviteCode = useCallback(async () => {
    if (invitation.status !== 'active') return;
    setError('');
    try {
      await navigator.clipboard.writeText(invitation.token);
    } catch (copyError) {
      setError(householdActionError('copy', copyError instanceof Error ? copyError : null));
    }
  }, [invitation]);

  return {
    household,
    members,
    invitation,
    loading,
    error,
    actions: {
      createInvitation,
      revokeInvitation,
      copyInviteCode: copyInviteCode,
      refresh,
    },
  };
}