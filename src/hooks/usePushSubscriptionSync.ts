'use client';

import { useCallback, useReducer, useState } from 'react';
import { createClient } from '@/utils/supabase/client';
import type { Json } from '@/types/database';

interface PushSubscriptionData {
  endpoint: string;
  subscription: Json;
}

interface State {
  syncStatus: 'idle' | 'syncing' | 'synced' | 'error';
  error: string | null;
}

type Action =
  | { type: 'syncing' }
  | { type: 'synced' }
  | { type: 'error'; error: string };

function reducer(state: State, action: Action): State {
  switch (action.type) {
    case 'syncing':
      return { syncStatus: 'syncing', error: null };
    case 'synced':
      return { syncStatus: 'synced', error: null };
    case 'error':
      return { syncStatus: 'error', error: action.error };
  }
}

export function usePushSubscriptionSync(userId: string | null) {
  const [state, dispatch] = useReducer(reducer, { syncStatus: 'idle', error: null });
  const [supabase] = useState(createClient);

  const upsert = useCallback(async (subscription: PushSubscriptionData) => {
    if (!userId) {
      dispatch({ type: 'error', error: 'Vous devez être connecté.' });
      return;
    }

    dispatch({ type: 'syncing' });

    const { error } = await supabase.from('push_subscriptions').upsert(
      {
        user_id: userId,
        endpoint: subscription.endpoint,
        subscription: subscription.subscription,
      },
      { onConflict: 'user_id,endpoint' }
    );

    if (error) {
      console.warn('push_subscription_upsert_failed', { code: error.code });
      dispatch({ type: 'error', error: 'Impossible de sauvegarder l\'abonnement. Veuillez réessayer.' });
      return;
    }

    dispatch({ type: 'synced' });
  }, [supabase, userId]);

  const remove = useCallback(async (endpoint: string) => {
    if (!userId) {
      dispatch({ type: 'error', error: 'Vous devez être connecté.' });
      return;
    }

    dispatch({ type: 'syncing' });

    const { error } = await supabase
      .from('push_subscriptions')
      .delete()
      .eq('user_id', userId)
      .eq('endpoint', endpoint);

    if (error) {
      console.warn('push_subscription_delete_failed', { code: error.code });
      dispatch({ type: 'error', error: 'Impossible de supprimer l\'abonnement. Veuillez réessayer.' });
      return;
    }

    dispatch({ type: 'synced' });
  }, [supabase, userId]);

  return {
    syncStatus: state.syncStatus,
    error: state.error,
    actions: {
      upsert,
      remove,
    },
  };
}