import { act, renderHook, waitFor } from '@testing-library/react';
import { usePushNotifications } from '@/hooks/usePushNotifications';
import { createClient } from '@/utils/supabase/client';

const endpoint = 'https://push.example.test/device-1';
const getSubscription = jest.fn();
const subscribe = jest.fn();
const register = jest.fn();
const requestPermission = jest.fn();
const upsert = jest.fn();
const deleteEq = jest.fn();
let deleteError: { code: string; message: string } | null;

jest.mock('@/utils/supabase/client', () => ({ createClient: jest.fn() }));

function subscription(unsubscribe = jest.fn().mockResolvedValue(true)) {
  return {
    endpoint,
    unsubscribe,
    toJSON: () => ({ expirationTime: null, keys: { auth: 'auth-key', p256dh: 'p256dh-key' } }),
  } as unknown as PushSubscription;
}

describe('usePushNotifications', () => {
  const originalVapidKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;

  beforeEach(() => {
    jest.clearAllMocks();
    localStorage.clear();
    process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY = 'AQIDBA';

    Object.defineProperty(window, 'PushManager', { configurable: true, value: function PushManager() {} });
    Object.defineProperty(window, 'Notification', {
      configurable: true,
      value: { permission: 'default', requestPermission },
    });
    Object.defineProperty(navigator, 'serviceWorker', {
      configurable: true,
      value: { register },
    });

    getSubscription.mockResolvedValue(null);
    subscribe.mockResolvedValue(subscription());
    register.mockResolvedValue({ pushManager: { getSubscription, subscribe } });
    requestPermission.mockResolvedValue('granted');
    upsert.mockResolvedValue({ error: null });
    const deleteBuilder = {
      eq: deleteEq,
      then: (resolve: (result: { error: typeof deleteError }) => unknown) => Promise.resolve({ error: deleteError }).then(resolve),
    };
    deleteEq.mockReturnValue(deleteBuilder);
    deleteError = null;
    jest.mocked(createClient).mockReturnValue({
      from: () => ({
        upsert,
        delete: () => deleteBuilder,
      }),
    } as never);
  });

  afterAll(() => {
    process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY = originalVapidKey;
  });

  it('registers the worker and reports an unsubscribed supported device', async () => {
    const { result } = renderHook(() => usePushNotifications('user-1'));

    await waitFor(() => expect(result.current.localSubscription).toBe('unsubscribed'));
    expect(register).toHaveBeenCalledWith('/sw.js');
    expect(result.current.isSupported).toBe(true);
    expect(upsert).not.toHaveBeenCalled();
  });

  it('requests permission, creates a browser subscription and syncs it', async () => {
    const created = subscription();
    subscribe.mockResolvedValue(created);
    const { result } = renderHook(() => usePushNotifications('user-1'));
    await waitFor(() => expect(result.current.localSubscription).toBe('unsubscribed'));

    await act(async () => {
      expect(await result.current.requestPermission()).toEqual({ error: null });
    });

    expect(subscribe).toHaveBeenCalledWith(expect.objectContaining({ userVisibleOnly: true }));
    expect(upsert).toHaveBeenCalledWith(expect.objectContaining({ user_id: 'user-1', endpoint }), {
      onConflict: 'user_id,endpoint',
    });
    expect(localStorage.getItem('grocery-tracker.push-endpoint')).toBe(endpoint);
    expect(result.current).toMatchObject({ localSubscription: 'subscribed', serverSync: 'synced' });
  });

  it('removes the known remote endpoint when no local subscription remains', async () => {
    localStorage.setItem('grocery-tracker.push-endpoint', endpoint);
    const { result } = renderHook(() => usePushNotifications('user-1'));
    await waitFor(() => expect(result.current.endpoint).toBe(endpoint));

    await act(async () => {
      expect(await result.current.unsubscribe()).toEqual({ error: null });
    });

    expect(deleteEq).toHaveBeenCalledWith('user_id', 'user-1');
    expect(deleteEq).toHaveBeenCalledWith('endpoint', endpoint);
    expect(localStorage.getItem('grocery-tracker.push-endpoint')).toBeNull();
    expect(result.current).toMatchObject({ localSubscription: 'unsubscribed', serverSync: 'synced' });
  });

  it('retains the endpoint after a remote deletion failure so retry is idempotent', async () => {
    localStorage.setItem('grocery-tracker.push-endpoint', endpoint);
    deleteError = { code: '08006', message: 'database connection details' };
    const warn = jest.spyOn(console, 'warn').mockImplementation(() => undefined);
    const { result } = renderHook(() => usePushNotifications('user-1'));
    await waitFor(() => expect(result.current.endpoint).toBe(endpoint));

    await act(async () => {
      expect((await result.current.unsubscribe()).error?.message)
        .toContain('Réessayez pour supprimer l’abonnement distant');
    });

    expect(localStorage.getItem('grocery-tracker.push-endpoint')).toBe(endpoint);
    expect(result.current).toMatchObject({ localSubscription: 'unsubscribed', endpoint, serverSync: 'error' });
    expect(warn).toHaveBeenLastCalledWith('client_operation_failed', {
      area: 'push_notifications', action: 'delete', code: '08006',
    });
    expect(JSON.stringify(warn.mock.calls)).not.toContain('database connection details');

    deleteError = null;
    await act(async () => {
      expect(await result.current.unsubscribe()).toEqual({ error: null });
    });
    expect(localStorage.getItem('grocery-tracker.push-endpoint')).toBeNull();
    warn.mockRestore();
  });

  it('returns a recoverable error when VAPID configuration is missing', async () => {
    delete process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
    const { result } = renderHook(() => usePushNotifications('user-1'));
    await waitFor(() => expect(result.current.error).toContain('VAPID'));

    await act(async () => {
      const response = await result.current.requestPermission();
      expect(response.error?.message).toContain('VAPID');
    });
    expect(subscribe).not.toHaveBeenCalled();
  });
});
