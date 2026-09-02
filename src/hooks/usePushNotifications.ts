'use client';

import { useCallback, useMemo, useState } from 'react';
import { usePushManager } from './usePushManager';
import { usePushSubscriptionSync } from './usePushSubscriptionSync';
import type { Json } from '@/types/database';

type PushOperation = 'idle' | 'enabling' | 'disabling';

interface PushSubscriptionData {
  endpoint: string;
  expirationTime: number | null;
  keys: { auth: string; p256dh: string } | null;
  [key: string]: string | number | null | { auth: string; p256dh: string } | undefined;
}

const MISSING_VAPID_ERROR = 'Les notifications sont indisponibles : la clé VAPID publique n\'est pas configurée.';

function subscriptionToJson(subscription: PushSubscription): PushSubscriptionData {
  const subscriptionJson = subscription.toJSON();
  return {
    endpoint: subscription.endpoint,
    expirationTime: subscriptionJson.expirationTime ?? null,
    keys: subscriptionJson.keys
      ? { auth: subscriptionJson.keys.auth, p256dh: subscriptionJson.keys.p256dh }
      : null,
  };
}

export function usePushNotifications(userId: string | null) {
  const pushManager = usePushManager();
  const sync = usePushSubscriptionSync(userId);
  const [operation, setOperation] = useState<PushOperation>('idle');

  const isSupported = pushManager.support === 'supported';
  const isLoading = pushManager.isLoading || pushManager.permission === 'default' || operation !== 'idle';

  const requestPermission = useCallback(async () => {
    if (!isSupported) {
      return { error: new Error('Ce navigateur ne prend pas en charge les notifications push.') };
    }
    if (!userId) {
      return { error: new Error('Vous devez être connecté pour activer les notifications.') };
    }
    if (!process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY) {
      return { error: new Error(MISSING_VAPID_ERROR) };
    }

    setOperation('enabling');
    try {
      const permission = await pushManager.requestPermission();
      if (permission !== 'granted') {
        setOperation('idle');
        return {
          error: new Error(
            permission === 'denied'
              ? 'Les notifications sont bloquées dans les réglages du navigateur.'
              : 'L\'autorisation des notifications n\'a pas été accordée.'
          ),
        };
      }

      const result = await subscribeCurrentDevice();
      setOperation('idle');
      return result;
    } catch (error) {
      setOperation('idle');
      const normalized = error instanceof Error ? error : new Error('Impossible d\'activer les notifications.');
      return { error: normalized };
    }
  }, [isSupported, userId, pushManager]);

  const subscribe = useCallback(async () => {
    if (!isSupported) {
      return { error: new Error('Ce navigateur ne prend pas en charge les notifications push.') };
    }
    if (pushManager.permission !== 'granted') {
      return { error: new Error('Autorisez d\'abord les notifications.') };
    }
    if (!userId) {
      return { error: new Error('Vous devez être connecté pour activer les notifications.') };
    }
    if (!process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY) {
      return { error: new Error(MISSING_VAPID_ERROR) };
    }

    setOperation('enabling');
    const result = await subscribeCurrentDevice();
    setOperation('idle');
    return result;
  }, [isSupported, pushManager.permission, userId]);

  const unsubscribe = useCallback(async () => {
    if (!isSupported) {
      return { error: new Error('Ce navigateur ne prend pas en charge les notifications push.') };
    }
    if (!userId) {
      return { error: new Error('Vous devez être connecté pour désactiver les notifications.') };
    }

    setOperation('disabling');
    try {
      await pushManager.unsubscribe();

      const endpoint = pushManager.endpoint;
      if (endpoint) {
        await sync.actions.remove(endpoint);
      }

      setOperation('idle');
      return { error: null };
    } catch (error) {
      setOperation('idle');
      const normalized = error instanceof Error ? error : new Error('Impossible de désactiver les notifications.');
      return { error: normalized };
    }
  }, [isSupported, userId, pushManager, sync]);

  const subscribeCurrentDevice = useCallback(async () => {
    if (!userId) {
      return { error: new Error('Vous devez être connecté pour activer les notifications.') };
    }
    const vapidPublicKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
    if (!vapidPublicKey) {
      return { error: new Error(MISSING_VAPID_ERROR) };
    }

    try {
      const subscription = await pushManager.subscribe(vapidPublicKey);
      const subscriptionData = {
        endpoint: subscription.endpoint,
        subscription: subscriptionToJson(subscription),
      };
      await sync.actions.upsert(subscriptionData);
      return { error: null };
    } catch (error) {
      const normalized = error instanceof Error ? error : new Error('Impossible d\'activer les notifications.');
      return { error: normalized };
    }
  }, [userId, pushManager, sync]);

  const localSubscription = useMemo(() => {
    if (pushManager.support === 'unsupported') return 'unsubscribed';
    if (pushManager.subscription) return 'subscribed';
    return 'unsubscribed';
  }, [pushManager.support, pushManager.subscription]);

  const serverSync: 'idle' | 'syncing' | 'synced' | 'error' = useMemo(() => {
    if (sync.syncStatus === 'error') return 'error';
    return sync.syncStatus;
  }, [sync.syncStatus]);

  return {
    support: pushManager.support,
    permission: pushManager.permission,
    localSubscription,
    serverSync,
    operation,
    endpoint: pushManager.endpoint,
    error: sync.error,
    requestPermission,
    subscribe,
    unsubscribe,
    isSupported,
    isLoading,
  };
}