'use client';

import type { SupabaseClient } from '@supabase/supabase-js';
import { useEffect, useRef } from 'react';

interface UseRealtimeTableOptions {
  supabase: SupabaseClient;
  householdId: string;
  tables: string[];
  onRealtimeChange: () => void;
  debounceMs?: number;
}

export function useRealtimeTable({
  supabase,
  householdId,
  tables,
  onRealtimeChange,
  debounceMs = 300,
}: UseRealtimeTableOptions): void {
  const debounceTimer = useRef<ReturnType<typeof setTimeout>>();
  const channels = useRef<ReturnType<typeof supabase.channel>[]>([]);

  useEffect(() => {
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
            clearTimeout(debounceTimer.current);
            debounceTimer.current = setTimeout(() => {
              onRealtimeChange();
            }, debounceMs);
          }
        )
        .subscribe()
    );

    return () => {
      clearTimeout(debounceTimer.current);
      channels.current.forEach((channel) => {
        void supabase.removeChannel(channel);
      });
    };
  }, [supabase, householdId, tables.join(','), onRealtimeChange, debounceMs]);
}
