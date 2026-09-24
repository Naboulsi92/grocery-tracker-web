import { act, renderHook, waitFor } from '@testing-library/react';
import { useHouseholdRealtime } from '@/hooks/useHouseholdRealtime';
import type { SupabaseClient } from '@supabase/supabase-js';

describe('useHouseholdRealtime', () => {
  let mockChannel: {
    on: jest.Mock;
    subscribe: jest.Mock;
  };
  let mockRemoveChannel: jest.Mock;
  let mockSupabase: jest.Mocked<SupabaseClient>;
  let onPatch: jest.Mock;
  let onResyncNeeded: jest.Mock;
  const householdId = 'test-household';

  const render = (debounceMs = 20) =>
    renderHook(() =>
      useHouseholdRealtime({
        supabase: mockSupabase,
        householdId,
        debounceMs,
        onPatch,
        onResyncNeeded,
      })
    );

  /** subscribe() status callback captured from the mock channel. */
  const subscribeCallback = () => mockChannel.subscribe.mock.calls[0][0] as (status: string) => void;
  /** postgres_changes handler for a table binding, in binding order. */
  const bindingHandler = (index: number) =>
    mockChannel.on.mock.calls[index][2] as (payload: unknown) => void;

  beforeEach(() => {
    jest.clearAllMocks();
    mockChannel = {
      on: jest.fn().mockReturnThis(),
      subscribe: jest.fn().mockResolvedValue({}),
    };
    mockRemoveChannel = jest.fn().mockResolvedValue(undefined);
    mockSupabase = {
      channel: jest.fn().mockReturnValue(mockChannel),
      removeChannel: mockRemoveChannel,
    } as unknown as jest.Mocked<SupabaseClient>;
    onPatch = jest.fn();
    onResyncNeeded = jest.fn();
  });

  it('opens exactly one channel with one binding per published table', async () => {
    render();

    await waitFor(() => {
      expect(mockSupabase.channel).toHaveBeenCalledTimes(1);
    });
    expect(mockSupabase.channel).toHaveBeenCalledWith(`household:${householdId}`);
    expect(mockChannel.on).toHaveBeenCalledTimes(2);

    const bindings = mockChannel.on.mock.calls.map((call) => call[1]);
    expect(bindings).toEqual([
      expect.objectContaining({
        event: '*',
        schema: 'public',
        table: 'categories',
        filter: `household_id=eq.${householdId}`,
      }),
      expect.objectContaining({
        event: '*',
        schema: 'public',
        table: 'items',
        filter: `household_id=eq.${householdId}`,
      }),
    ]);
    expect(mockChannel.subscribe).toHaveBeenCalledTimes(1);
  });

  it('forwards INSERT/UPDATE/DELETE payloads to onPatch synchronously (no refetch)', async () => {
    render();

    await waitFor(() => {
      expect(mockChannel.on).toHaveBeenCalledTimes(2);
    });

    const newItem = { id: 'i1', name: 'Lait', updated_at: '2026-09-24T10:00:00Z' };
    act(() => {
      bindingHandler(1)({ eventType: 'INSERT', new: newItem, old: null });
    });
    expect(onPatch).toHaveBeenCalledTimes(1);
    expect(onPatch).toHaveBeenCalledWith({
      table: 'items',
      event: 'INSERT',
      newRecord: newItem,
      oldRecord: null,
    });

    act(() => {
      bindingHandler(0)({
        eventType: 'DELETE',
        new: null,
        old: { id: 'c1', name: 'Fruits' },
      });
    });
    expect(onPatch).toHaveBeenCalledTimes(2);
    expect(onPatch).toHaveBeenLastCalledWith({
      table: 'categories',
      event: 'DELETE',
      newRecord: null,
      oldRecord: { id: 'c1', name: 'Fruits' },
    });

    // Patches never trigger a resync.
    expect(onResyncNeeded).not.toHaveBeenCalled();
  });

  it('schedules a single resync when the patch handler throws', async () => {
    onPatch.mockImplementation(() => {
      throw new Error('state mismatch');
    });
    render();

    await waitFor(() => {
      expect(mockChannel.on).toHaveBeenCalledTimes(2);
    });

    act(() => {
      bindingHandler(1)({ eventType: 'UPDATE', new: { id: 'i1' }, old: { id: 'i1' } });
      bindingHandler(1)({ eventType: 'UPDATE', new: { id: 'i1' }, old: { id: 'i1' } });
    });

    await waitFor(() => {
      expect(onResyncNeeded).toHaveBeenCalledTimes(1);
    });
    expect(onResyncNeeded).toHaveBeenCalledWith('patch-error');
  });

  it('reports SUBSCRIBED status and resyncs once on channel error', async () => {
    const { result } = render();

    await waitFor(() => {
      expect(mockChannel.subscribe).toHaveBeenCalled();
    });

    act(() => {
      subscribeCallback()('SUBSCRIBED');
    });
    expect(result.current.status).toBe('subscribed');

    act(() => {
      subscribeCallback()('CHANNEL_ERROR');
      subscribeCallback()('TIMED_OUT');
    });
    expect(result.current.status).toBe('error');

    // Two rapid failures coalesce into one debounced resync.
    await waitFor(() => {
      expect(onResyncNeeded).toHaveBeenCalledTimes(1);
    });
    expect(onResyncNeeded).toHaveBeenCalledWith('channel-error');
  });

  it('opens nothing until enabled with a household id', async () => {
    const { rerender } = renderHook(
      ({ enabled, id }) =>
        useHouseholdRealtime({
          supabase: mockSupabase,
          householdId: id,
          enabled,
          onPatch,
          onResyncNeeded,
        }),
      { initialProps: { enabled: false, id: householdId } }
    );

    await new Promise((resolve) => setTimeout(resolve, 50));
    expect(mockSupabase.channel).not.toHaveBeenCalled();

    rerender({ enabled: true, id: householdId });
    await waitFor(() => {
      expect(mockSupabase.channel).toHaveBeenCalledTimes(1);
    });
  });

  it('removes the channel on unmount and never fires a stale resync', async () => {
    const { unmount } = render(50);

    await waitFor(() => {
      expect(mockChannel.subscribe).toHaveBeenCalled();
    });

    act(() => {
      subscribeCallback()('CHANNEL_ERROR');
    });
    unmount();

    // The pending resync timer was invalidated by cleanup (resyncId bump).
    await new Promise((resolve) => setTimeout(resolve, 120));
    expect(onResyncNeeded).not.toHaveBeenCalled();
    expect(mockRemoveChannel).toHaveBeenCalledTimes(1);
  });
});
