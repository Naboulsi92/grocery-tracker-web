import { act, renderHook, waitFor } from '@testing-library/react';
import { useHouseholdMembersLive } from '@/hooks/useHouseholdMembersLive';
import type { SupabaseClient } from '@supabase/supabase-js';

// Ticket #173 : member arrivals/departures refresh the roster live, so the
// manual header refresh button can go. One binding (household_members),
// any event -> onMembersChanged (the caller refetches: roster + profiles).
describe('useHouseholdMembersLive', () => {
  let mockChannel: { on: jest.Mock; subscribe: jest.Mock };
  let mockRemoveChannel: jest.Mock;
  let mockSupabase: jest.Mocked<SupabaseClient>;
  let onMembersChanged: jest.Mock;
  const householdId = 'household-1';

  const render = (enabled = true) =>
    renderHook(() =>
      useHouseholdMembersLive({ supabase: mockSupabase, householdId, enabled, onMembersChanged })
    );

  const bindingHandler = () => mockChannel.on.mock.calls[0][2] as (payload: unknown) => void;

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
    onMembersChanged = jest.fn();
  });

  it('opens one members channel bound to household_members of this household', async () => {
    render();

    await waitFor(() => {
      expect(mockSupabase.channel).toHaveBeenCalledTimes(1);
    });
    expect(mockSupabase.channel).toHaveBeenCalledWith(`household:${householdId}:members`);
    expect(mockChannel.on).toHaveBeenCalledTimes(1);
    expect(mockChannel.on).toHaveBeenCalledWith(
      'postgres_changes',
      {
        event: '*',
        schema: 'public',
        table: 'household_members',
        filter: `household_id=eq.${householdId}`,
      },
      expect.any(Function)
    );
    expect(mockChannel.subscribe).toHaveBeenCalledTimes(1);
  });

  it.each(['INSERT', 'UPDATE', 'DELETE'])('notifies on %s (join, role change, leave)', async (eventType) => {
    render();

    await waitFor(() => {
      expect(mockChannel.on).toHaveBeenCalledTimes(1);
    });
    act(() => {
      bindingHandler()({ eventType, new: { user_id: 'u2' }, old: null });
    });
    expect(onMembersChanged).toHaveBeenCalledTimes(1);
  });

  it('opens no channel while disabled or without household id', async () => {
    const { unmount } = render(false);
    unmount();

    renderHook(() =>
      useHouseholdMembersLive({ supabase: mockSupabase, householdId: '', enabled: true, onMembersChanged })
    ).unmount();

    expect(mockSupabase.channel).not.toHaveBeenCalled();
  });

  it('removes the channel on unmount', async () => {
    const { unmount } = render();

    await waitFor(() => {
      expect(mockSupabase.channel).toHaveBeenCalledTimes(1);
    });
    unmount();

    expect(mockRemoveChannel).toHaveBeenCalledTimes(1);
  });
});
