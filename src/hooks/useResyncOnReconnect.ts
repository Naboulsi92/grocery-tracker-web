'use client';

import { useEffect, useRef } from 'react';
import { subscribe, getSnapshot, startOfflineQueue } from '@/lib/offlineQueue';

// PRD §4.12 + §5 : au retour du réseau, recharger intégralement l'état depuis
// la base en arrière-plan (fetch complet, jamais window.location.reload — la
// page ne recharge pas). Deux déclencheurs complémentaires :
//   1. événement 'online' — couvre la coupure prolongée (lecture seule, file
//      vide) : l'état affiché peut être obsolète, on resynchronise.
//   2. file vidée (transition actif → inactif du snapshot offlineQueue) —
//      couvre la micro-coupure : on resynchronise APRÈS le replay pour
//      afficher l'état post-replay, pas celui d'avant.
// LWW reste totalement silencieux (ADR 0006) : aucun conflit n'est signalé.
export function useResyncOnReconnect(onResync: () => void | Promise<void>): void {
  const callbackRef = useRef(onResync);

  useEffect(() => {
    callbackRef.current = onResync;
  });

  useEffect(() => {
    // Garantit que la file IndexedDB se vide même sur les pages sans
    // SyncingIndicator monté (catégories, historique). Idempotent.
    startOfflineQueue();

    let wasActive = getSnapshot().isSyncing || getSnapshot().pendingCount > 0;

    const handleOnline = () => {
      // File non vide : le replay en cours va la vider, et la transition
      // actif → inactif ci-dessous resynchronisera après le replay.
      const snapshot = getSnapshot();
      if (!snapshot.isSyncing && snapshot.pendingCount === 0) {
        void callbackRef.current();
      }
    };
    window.addEventListener('online', handleOnline);

    const unsubscribe = subscribe(() => {
      const snapshot = getSnapshot();
      const isActive = snapshot.isSyncing || snapshot.pendingCount > 0;
      if (wasActive && !isActive) {
        void callbackRef.current();
      }
      wasActive = isActive;
    });

    return () => {
      window.removeEventListener('online', handleOnline);
      unsubscribe();
    };
  }, []);
}
