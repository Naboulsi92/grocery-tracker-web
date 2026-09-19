'use client';

import { useSyncExternalStore } from 'react';
import { subscribe, getSnapshot, type QueueSnapshot } from '@/lib/offlineQueue';

export type OfflineQueueStatus = {
  pendingCount: number;
  isSyncing: boolean;
  failedCount: number;
  hasPending: boolean;
  hasFailed: boolean;
  snapshot: QueueSnapshot;
};

export function useOfflineQueueStatus(): OfflineQueueStatus {
  const snapshot = useSyncExternalStore(subscribe, getSnapshot);

  return {
    pendingCount: snapshot.pendingCount,
    isSyncing: snapshot.isSyncing,
    failedCount: snapshot.failedActions.length,
    hasPending: snapshot.pendingCount > 0,
    hasFailed: snapshot.failedActions.length > 0,
    snapshot,
  };
}
