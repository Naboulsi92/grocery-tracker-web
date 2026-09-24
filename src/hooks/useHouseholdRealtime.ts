'use client';

import type { RealtimePostgresChangesPayload, SupabaseClient } from '@supabase/supabase-js';
import { useEffect, useRef, useState } from 'react';

/**
 * Tables mirrored by the `supabase_realtime` publication
 * (see supabase/tests/database/security_contract.sql:13).
 * The hook binds EXACTLY these two — binding an unpublished table starves
 * the whole channel (lesson from #111: `category_positions`), so there is
 * deliberately no `tables` parameter to get wrong.
 */
export const REALTIME_TABLES = ['categories', 'items'] as const;
export type RealtimeTable = (typeof REALTIME_TABLES)[number];

export interface RealtimePatch {
  table: RealtimeTable;
  event: 'INSERT' | 'UPDATE' | 'DELETE';
  newRecord: Record<string, unknown> | null;
  oldRecord: Record<string, unknown> | null;
}

export type ResyncReason = 'patch-error' | 'channel-error';
export type RealtimeStatus = 'connecting' | 'subscribed' | 'error' | 'closed';

interface UseHouseholdRealtimeOptions {
  supabase: SupabaseClient;
  householdId: string;
  debounceMs?: number;
  /**
   * Pages render before auth resolves `householdId`. Pass `enabled: false`
   * (or an empty id) until then so no channel is opened on a bogus topic.
   */
  enabled?: boolean;
  onPatch: (patch: RealtimePatch) => void;
  onResyncNeeded: (reason: ResyncReason) => void;
}

/**
 * One multiplexed realtime channel per household (ticket #123).
 *
 * Replaces the copy-pasted per-page pipelines (fetch/requestId/debounce in
 * items/categories/to-buy) and the unused `useRealtimeTable` (one channel
 * per table + full-refetch callback).
 *
 * - Patches (`new`/`old` payloads) are delivered synchronously to `onPatch`
 *   — no debounce, no refetch; React batches the renders. LWW ordering
 *   (PRD §4.12) is the caller's job: it owns the state shape and compares
 *   `updated_at`.
 * - Full resync is a fallback only (`onResyncNeeded`): patch handler threw,
 *   unknown event type, or channel error. Resync scheduling reuses the #111
 *   anti-race pattern (monotonic id, invalidated on cleanup) with a single
 *   shared debounce timer, so N rapid failures → 1 resync.
 */
export function useHouseholdRealtime({
  supabase,
  householdId,
  debounceMs = 300,
  enabled = true,
  onPatch,
  onResyncNeeded,
}: UseHouseholdRealtimeOptions) {
  const [status, setStatus] = useState<RealtimeStatus>('connecting');
  const onPatchRef = useRef(onPatch);
  const onResyncRef = useRef(onResyncNeeded);

  useEffect(() => {
    onPatchRef.current = onPatch;
    onResyncRef.current = onResyncNeeded;
  });

  useEffect(() => {
    if (!enabled || !householdId) return;

    let resyncId = 0;
    let resyncTimer: ReturnType<typeof setTimeout> | undefined;
    const scheduleResync = (reason: ResyncReason) => {
      const current = ++resyncId;
      clearTimeout(resyncTimer);
      resyncTimer = setTimeout(() => {
        if (current === resyncId) {
          onResyncRef.current(reason);
        }
      }, debounceMs);
    };

    const handlePayload =
      (table: RealtimeTable) =>
      (payload: RealtimePostgresChangesPayload<{ [key: string]: unknown }>) => {
        const { eventType } = payload;
        if (eventType !== 'INSERT' && eventType !== 'UPDATE' && eventType !== 'DELETE') {
          scheduleResync('patch-error');
          return;
        }
        try {
          onPatchRef.current({
            table,
            event: eventType,
            newRecord: (payload.new ?? null) as Record<string, unknown> | null,
            oldRecord: (payload.old ?? null) as Record<string, unknown> | null,
          });
        } catch {
          scheduleResync('patch-error');
        }
      };

    const channel = supabase.channel(`household:${householdId}`);
    for (const table of REALTIME_TABLES) {
      channel.on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table,
          filter: `household_id=eq.${householdId}`,
        },
        handlePayload(table)
      );
    }
    channel.subscribe((subscribeStatus) => {
      if (subscribeStatus === 'SUBSCRIBED') {
        setStatus('subscribed');
      } else if (subscribeStatus === 'CHANNEL_ERROR' || subscribeStatus === 'TIMED_OUT') {
        setStatus('error');
        scheduleResync('channel-error');
      } else if (subscribeStatus === 'CLOSED') {
        setStatus('closed');
      }
    });

    return () => {
      resyncId += 1;
      clearTimeout(resyncTimer);
      void supabase.removeChannel(channel);
    };
  }, [supabase, householdId, debounceMs, enabled]);

  return { status };
}
