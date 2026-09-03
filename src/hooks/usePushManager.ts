'use client';

import { useCallback, useEffect, useState } from 'react';

const ENDPOINT_STORAGE_KEY = 'grocery-tracker.push-endpoint';

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

function getInitialSupport(): 'supported' | 'unsupported' {
  if (typeof window === 'undefined') return 'unsupported';
  const supported = 'Notification' in window
    && 'serviceWorker' in navigator
    && 'PushManager' in window;
  return supported ? 'supported' : 'unsupported';
}

function getInitialPermission(): NotificationPermission {
  if (typeof window === 'undefined') return 'default';
  if (!('Notification' in window)) return 'default';
  return Notification.permission;
}

export function usePushManager() {
  const [support] = useState<'supported' | 'unsupported'>(getInitialSupport);
  const [permission, setPermission] = useState<NotificationPermission>(getInitialPermission);
  const [subscription, setSubscription] = useState<PushSubscription | null>(null);
  const [endpoint, setEndpoint] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    let active = true;

    if (support !== 'supported') {
      return;
    }

    async function initialize() {
      try {
        const registration = await navigator.serviceWorker.register('/sw.js');
        const pushSubscription = await registration.pushManager.getSubscription();
        if (!active) return;

        const knownEndpoint = pushSubscription?.endpoint ?? localStorage.getItem(ENDPOINT_STORAGE_KEY);
        setSubscription(pushSubscription);
        setEndpoint(knownEndpoint);
      } catch (error) {
        console.error('Failed to initialize push manager:', error);
      }
    }

    void initialize();
    return () => { active = false; };
  }, [support]);

  const requestPermission = useCallback(async (): Promise<NotificationPermission> => {
    if (support !== 'supported') {
      throw new Error('Ce navigateur ne prend pas en charge les notifications push.');
    }

    setIsLoading(true);
    try {
      const result = await Notification.requestPermission();
      setPermission(result);
      return result;
    } finally {
      setIsLoading(false);
    }
  }, [support]);

  const subscribe = useCallback(async (vapidPublicKey: string): Promise<PushSubscription> => {
    if (support !== 'supported') {
      throw new Error('Ce navigateur ne prend pas en charge les notifications push.');
    }

    if (permission !== 'granted') {
      throw new Error('Autorisez d\'abord les notifications.');
    }

    setIsLoading(true);
    try {
      const registration = await navigator.serviceWorker.register('/sw.js');
      const existing = await registration.pushManager.getSubscription();
      
      if (existing) {
        localStorage.setItem(ENDPOINT_STORAGE_KEY, existing.endpoint);
        setSubscription(existing);
        setEndpoint(existing.endpoint);
        return existing;
      }

      const newSubscription = await registration.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(vapidPublicKey),
      });

      localStorage.setItem(ENDPOINT_STORAGE_KEY, newSubscription.endpoint);
      setSubscription(newSubscription);
      setEndpoint(newSubscription.endpoint);
      return newSubscription;
    } finally {
      setIsLoading(false);
    }
  }, [support, permission]);

  const unsubscribe = useCallback(async (): Promise<void> => {
    if (support !== 'supported') {
      throw new Error('Ce navigateur ne prend pas en charge les notifications push.');
    }

    setIsLoading(true);
    try {
      const registration = await navigator.serviceWorker.register('/sw.js');
      const currentSubscription = await registration.pushManager.getSubscription();
      
      if (currentSubscription) {
        await currentSubscription.unsubscribe();
      }

      localStorage.removeItem(ENDPOINT_STORAGE_KEY);
      
      setSubscription(null);
      setEndpoint(null);
    } finally {
      setIsLoading(false);
    }
  }, [support]);

  return {
    support,
    permission,
    subscription,
    endpoint,
    requestPermission,
    subscribe,
    unsubscribe,
    isLoading,
  };
}