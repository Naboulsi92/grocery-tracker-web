'use client';

import type { SupabaseClient } from '@supabase/supabase-js';
import { useEffect, useRef } from 'react';

type LoadFunction = (showLoading?: boolean) => Promise<void>;

interface UseRealtimeTableOptions {
  supabase: SupabaseClient;
  householdId: string;
  tables: string[];
  loadFunction: LoadFunction;
  debounceMs?: number;
}

export function useRealtimeTable({
  supabase,
  householdId,
  tables,
  loadFunction,
  debounceMs = 300,
}: UseRealtimeTableOptions): void {
  const requestId = useRef<number>(0);
  const debounceTimer = useRef<ReturnType<typeof setTimeout>>();
  const channels = useRef<ReturnType<typeof supabase.channel>[]>([]);

  useEffect(() => {
    requestId.current = 0;
    channels.current = tables.map((table) =>
      supabase
        .channel(`realtime:${table}:${householdId}`)
        .on(
          'postgres_changes',
          {
            event: '*',
            schema: 'public',
            table,
            filter: `household_id=eq.${householdId}`,
          },
          () => {
            const currentRequestId = requestId.current;
            clearTimeout(debounceTimer.current);
            debounceTimer.current = setTimeout(() => {
              if (requestId.current === currentRequestId) {
                void loadFunction();
              }
            }, debounceMs);
          }
        )
        .subscribe()
    );

    return () => {
      requestId.current += 1;
      clearTimeout(debounceTimer.current);
      channels.current.forEach((channel) => {
        void supabase.removeChannel(channel);
      });
    };
  }, [supabase, householdId, tables.join(','), loadFunction, debounceMs]);
}
