'use client';

import type { RealtimePostgresChangesPayload, SupabaseClient } from '@supabase/supabase-js';
import { useEffect, useRef } from 'react';

interface UseHouseholdMembersLiveOptions {
  supabase: SupabaseClient;
  householdId: string;
  enabled?: boolean;
  onMembersChanged: () => void;
}

/**
 * Live roster (ticket #173): one channel binding household_members of this
 * household. Any INSERT/UPDATE/DELETE (the other member joins, leaves, role
 * change) notifies the caller, which refetches roster + profiles silently
 * (PRD §4.12) — replacing the manual header refresh button.
 *
 * Deliberately separate from useHouseholdRealtime (#123): that hook owns the
 * inventory pipeline (patches + LWW); roster changes are rare, so a plain
 * refetch beats patch plumbing. Binds ONLY a published table
 * (household_members, see security_contract.sql) — the #111 starvation
 * lesson applies here too. RLS delivers (household_members_select_member
 * covers the whole household).
 */
export function useHouseholdMembersLive({
  supabase,
  householdId,
  enabled = true,
  onMembersChanged,
}: UseHouseholdMembersLiveOptions) {
  const callbackRef = useRef(onMembersChanged);

  useEffect(() => {
    callbackRef.current = onMembersChanged;
  });

  useEffect(() => {
    if (!enabled || !householdId) return;

    const channel = supabase.channel(`household:${householdId}:members`);
    channel.on(
      'postgres_changes',
      {
        event: '*',
        schema: 'public',
        table: 'household_members',
        filter: `household_id=eq.${householdId}`,
      },
      (
        payload: RealtimePostgresChangesPayload<{ [key: string]: unknown }>
      ) => {
        if (
          payload.eventType !== 'INSERT' &&
          payload.eventType !== 'UPDATE' &&
          payload.eventType !== 'DELETE'
        ) {
          return;
        }
        callbackRef.current();
      }
    );
    channel.subscribe();

    return () => {
      void supabase.removeChannel(channel);
    };
  }, [supabase, householdId, enabled]);
}
