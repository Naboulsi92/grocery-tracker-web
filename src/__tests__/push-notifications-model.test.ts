import {
  initialPushNotificationState,
  pushNotificationReducer,
} from '@/hooks/pushNotificationsModel';

describe('push notification state model', () => {
  it('keeps permission, local subscription and server sync independent', () => {
    const permitted = pushNotificationReducer(initialPushNotificationState, {
      type: 'permission',
      permission: 'granted',
    });
    const local = pushNotificationReducer(permitted, {
      type: 'local',
      subscribed: true,
      endpoint: 'https://push.example.test/device',
    });
    const syncing = pushNotificationReducer(local, { type: 'syncing' });

    expect(syncing).toMatchObject({
      permission: 'granted',
      localSubscription: 'subscribed',
      serverSync: 'syncing',
      operation: 'idle',
    });
  });

  it('records a server error without losing the known device endpoint', () => {
    const state = {
      ...initialPushNotificationState,
      support: 'supported' as const,
      localSubscription: 'unsubscribed' as const,
      serverSync: 'syncing' as const,
      operation: 'disabling' as const,
      endpoint: 'https://push.example.test/known-device',
    };

    expect(pushNotificationReducer(state, {
      type: 'failed',
      error: 'Supabase indisponible',
      serverSync: true,
    })).toEqual({
      ...state,
      operation: 'idle',
      serverSync: 'error',
      error: 'Supabase indisponible',
    });
  });

  it('finishes an idempotent disable as unsubscribed and synced', () => {
    const disabling = {
      ...initialPushNotificationState,
      support: 'supported' as const,
      permission: 'granted' as const,
      localSubscription: 'unsubscribed' as const,
      serverSync: 'syncing' as const,
      operation: 'disabling' as const,
      endpoint: null,
    };
    const synced = pushNotificationReducer(disabling, { type: 'synced' });
    const finished = pushNotificationReducer(synced, { type: 'finished' });

    expect(finished).toMatchObject({
      permission: 'granted',
      localSubscription: 'unsubscribed',
      serverSync: 'synced',
      operation: 'idle',
      endpoint: null,
      error: null,
    });
  });
});
