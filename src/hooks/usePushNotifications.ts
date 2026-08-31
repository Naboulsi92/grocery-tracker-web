'use client';

import { useEffect, useState } from 'react';
import { createClient } from '@/utils/supabase/client';

export function usePushNotifications(userId: string | null) {
  const [permission, setPermission] = useState<NotificationPermission>('default');
  const [subscription, setSubscription] = useState<PushSubscription | null>(null);
  const [isSupported, setIsSupported] = useState(false);
  const [supabase, setSupabase] = useState<ReturnType<typeof createClient> | null>(null);

  useEffect(() => {
    setSupabase(createClient());
  }, []);

  useEffect(() => {
    const supported = 'Notification' in window && 'serviceWorker' in navigator;
    setIsSupported(supported);

    if (!supported) {
      console.log('This browser does not support notifications');
      return;
    }

    setPermission(Notification.permission);

    if (userId && supabase) {
      loadSubscription();
    }
  }, [userId, supabase]);

  async function loadSubscription() {
    if (!supabase || !userId) return;
    
    try {
      const { data } = await supabase
        .from('push_subscriptions')
        .select('*')
        .eq('user_id', userId)
        .maybeSingle();

      if (data) {
        const existingSub = await navigator.serviceWorker.ready.then(registration => 
          registration.pushManager.getSubscription()
        );
        if (existingSub) {
          setSubscription(existingSub);
        }
      }
    } catch (err) {
      console.warn('Failed to load push subscription:', err);
    }
  }

  async function requestPermission() {
    if (!('Notification' in window)) {
      return { error: new Error('Notifications not supported') };
    }

    const result = await Notification.requestPermission();
    setPermission(result);

    if (result === 'granted') {
      await subscribe();
    }

    return { error: result === 'granted' ? null : new Error(result) };
  }

  async function subscribe() {
    if (!supabase || !userId) return { error: new Error('Not authenticated') };

    try {
      const registration = await navigator.serviceWorker.register('/sw.js');
      console.log('Service Worker registered');

      const vapidPublicKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
      
      if (!vapidPublicKey) {
        console.warn('VAPID public key not configured - skipping push subscription');
        return { error: null };
      }

      const pushSub = await registration.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(vapidPublicKey)
      });

      setSubscription(pushSub);

      await supabase.from('push_subscriptions').upsert({
        user_id: userId,
        subscription: JSON.stringify(pushSub),
        created_at: new Date().toISOString()
      });

      return { error: null };
    } catch (err) {
      console.warn('Push subscription failed:', err);
      return { error: err as Error };
    }
  }

  async function unsubscribe() {
    if (subscription && supabase) {
      await subscription.unsubscribe();
      setSubscription(null);
      
      if (userId) {
        await supabase.from('push_subscriptions').delete().eq('user_id', userId);
      }
    }
  }

  return {
    permission,
    subscription,
    requestPermission,
    subscribe,
    unsubscribe,
    isSupported
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