'use client';

import type { SupabaseClient } from '@supabase/supabase-js';
import { useEffect, useRef, useCallback } from 'react';

interface UseRealtimeTableOptions {
  supabase: SupabaseClient;
  householdId: string;
  tables: string[];
  debounceMs?: number;
}

export function useRealtimeTable({
  supabase,
  householdId,
  tables,
  debounceMs = 300,
}: UseRealtimeTableOptions) {
  const onChangeRef = useRef<() => void | undefined>(undefined);
  const debounceTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

  const setOnChange = useCallback((handler: () => void) => {
    onChangeRef.current = handler;
  }, []);

  useEffect(() => {
    const channels = tables.map((table) =>
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
            clearTimeout(debounceTimer.current);
            debounceTimer.current = setTimeout(() => {
              onChangeRef.current?.();
            }, debounceMs);
          }
        )
        .subscribe()
    );

    return () => {
      clearTimeout(debounceTimer.current);
      channels.forEach((channel) => {
        void supabase.removeChannel(channel);
      });
    };
  }, [supabase, householdId, tables.join(','), debounceMs]);

  return { setOnChange };
}
