'use client';

import { useCallback, useEffect, useReducer, useState } from 'react';
import { createClient } from '@/utils/supabase/client';
import type { Json } from '@/types/database';
import {
  initialPushNotificationState,
  pushNotificationReducer,
} from './pushNotificationsModel';

const ENDPOINT_STORAGE_KEY = 'grocery-tracker.push-endpoint';
const MISSING_VAPID_ERROR = 'Les notifications sont indisponibles : la clé VAPID publique n’est pas configurée.';

export function usePushNotifications(userId: string | null) {
  const [state, dispatch] = useReducer(pushNotificationReducer, initialPushNotificationState);
  const [supabase] = useState(createClient);

  const syncSubscription = useCallback(async (subscription: PushSubscription) => {
    if (!userId) return;
    dispatch({ type: 'syncing' });
    const subscriptionJson = subscription.toJSON();
    const serializedSubscription: Json = {
      endpoint: subscription.endpoint,
      expirationTime: subscriptionJson.expirationTime ?? null,
      keys: subscriptionJson.keys
        ? { auth: subscriptionJson.keys.auth, p256dh: subscriptionJson.keys.p256dh }
        : null,
    };
    const { error } = await supabase.from('push_subscriptions').upsert({
      user_id: userId,
      endpoint: subscription.endpoint,
      subscription: serializedSubscription,
    }, { onConflict: 'user_id,endpoint' });

    if (error) {
      const syncError = pushDatabaseError('sync', error);
      dispatch({ type: 'failed', error: syncError.message, serverSync: true });
      throw syncError;
    }
    dispatch({ type: 'synced' });
  }, [supabase, userId]);

  useEffect(() => {
    let active = true;
    const supported = 'Notification' in window
      && 'serviceWorker' in navigator
      && 'PushManager' in window;

    if (!supported) {
      dispatch({ type: 'unsupported' });
      return;
    }

    dispatch({ type: 'permission', permission: Notification.permission });

    async function initialize() {
      try {
        const registration = await navigator.serviceWorker.register('/sw.js');
        const subscription = await registration.pushManager.getSubscription();
        if (!active) return;

        const knownEndpoint = subscription?.endpoint ?? localStorage.getItem(ENDPOINT_STORAGE_KEY);
        dispatch({ type: 'local', subscribed: Boolean(subscription), endpoint: knownEndpoint });

        if (!process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY) {
          dispatch({ type: 'failed', error: MISSING_VAPID_ERROR });
          return;
        }

        if (userId && subscription) {
          await syncSubscription(subscription);
        }
      } catch (error) {
        if (active) dispatch({ type: 'failed', error: errorMessage(error, 'Impossible d’initialiser les notifications.') });
      }
    }

    void initialize();
    return () => { active = false; };
  }, [userId, syncSubscription]);

  async function requestPermission() {
    dispatch({ type: 'operation', operation: 'enabling' });

    try {
      if (state.support !== 'supported') throw new Error('Ce navigateur ne prend pas en charge les notifications push.');
      if (!userId) throw new Error('Vous devez être connecté pour activer les notifications.');
      if (!process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY) throw new Error(MISSING_VAPID_ERROR);

      const permission = await Notification.requestPermission();
      dispatch({ type: 'permission', permission });
      if (permission !== 'granted') {
        throw new Error(permission === 'denied'
          ? 'Les notifications sont bloquées dans les réglages du navigateur.'
          : 'L’autorisation des notifications n’a pas été accordée.');
      }

      return await subscribeCurrentDevice();
    } catch (error) {
      const normalized = asError(error, 'Impossible d’activer les notifications.');
      dispatch({ type: 'failed', error: normalized.message });
      return { error: normalized };
    }
  }

  async function subscribe() {
    dispatch({ type: 'operation', operation: 'enabling' });

    try {
      if (Notification.permission !== 'granted') throw new Error('Autorisez d’abord les notifications.');
      return await subscribeCurrentDevice();
    } catch (error) {
      const normalized = asError(error, 'Impossible d’activer les notifications.');
      dispatch({ type: 'failed', error: normalized.message });
      return { error: normalized };
    }
  }

  async function unsubscribe() {
    dispatch({ type: 'operation', operation: 'disabling' });

    try {
      if (state.support !== 'supported') throw new Error('Ce navigateur ne prend pas en charge les notifications push.');
      if (!userId) throw new Error('Vous devez être connecté pour désactiver les notifications.');

      const registration = await navigator.serviceWorker.register('/sw.js');
      const subscription = await registration.pushManager.getSubscription();
      const endpoint = subscription?.endpoint ?? state.endpoint ?? localStorage.getItem(ENDPOINT_STORAGE_KEY);

      if (subscription) await subscription.unsubscribe();
      dispatch({ type: 'local', subscribed: false, endpoint });

      if (endpoint) {
        dispatch({ type: 'syncing' });
        const { error } = await supabase
          .from('push_subscriptions')
          .delete()
          .eq('user_id', userId)
          .eq('endpoint', endpoint);
        if (error) throw pushDatabaseError('delete', error);
      }

      localStorage.removeItem(ENDPOINT_STORAGE_KEY);
      dispatch({ type: 'local', subscribed: false, endpoint: null });
      dispatch({ type: 'synced' });
      dispatch({ type: 'finished' });
      return { error: null };
    } catch (error) {
      const normalized = asError(error, 'Impossible de désactiver les notifications.');
      dispatch({ type: 'failed', error: normalized.message, serverSync: true });
      return { error: normalized };
    }
  }

  async function subscribeCurrentDevice() {
    if (!userId) throw new Error('Vous devez être connecté pour activer les notifications.');
    const vapidPublicKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
    if (!vapidPublicKey) throw new Error(MISSING_VAPID_ERROR);

    const registration = await navigator.serviceWorker.register('/sw.js');
    const existing = await registration.pushManager.getSubscription();
    const subscription = existing ?? await registration.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: urlBase64ToUint8Array(vapidPublicKey),
    });

    localStorage.setItem(ENDPOINT_STORAGE_KEY, subscription.endpoint);
    dispatch({ type: 'local', subscribed: true, endpoint: subscription.endpoint });
    await syncSubscription(subscription);
    dispatch({ type: 'finished' });
    return { error: null };
  }

  return {
    ...state,
    requestPermission,
    subscribe,
    unsubscribe,
    isSupported: state.support === 'supported',
    isLoading: state.operation !== 'idle',
  };
}

function urlBase64ToUint8Array(base64String: string): ArrayBuffer {
  const padding = '='.repeat((4 - base64String.length % 4) % 4);
  const base64 = (base64String + padding)
    .replace(/-/g, '+')
    .replace(/_/g, '/');

  const rawData = window.atob(base64);
  const outputArray = new Uint8Array(rawData.length);

  for (let i = 0; i < rawData.length; ++i) {
    outputArray[i] = rawData.charCodeAt(i);
  }
  return outputArray.buffer;
}

function asError(error: unknown, fallback: string) {
  if (error instanceof Error) return error;
  if (typeof error === 'object' && error !== null && 'message' in error && typeof error.message === 'string') {
    return new Error(error.message);
  }
  return new Error(fallback);
}

function errorMessage(error: unknown, fallback: string) {
  return asError(error, fallback).message;
}

function pushDatabaseError(action: 'sync' | 'delete', error: { code?: string }) {
  console.warn('client_operation_failed', {
    area: 'push_notifications',
    action,
    code: error.code ?? 'unknown',
  });
  return new Error(action === 'sync'
    ? 'Impossible de synchroniser les notifications. Vous pouvez réessayer.'
    : 'Impossible de finaliser la désactivation. Réessayez pour supprimer l’abonnement distant.');
}
