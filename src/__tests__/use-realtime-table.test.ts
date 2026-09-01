import { act, renderHook, waitFor } from '@testing-library/react';
import { useRealtimeTable } from '@/hooks/useRealtimeTable';
import { createClient } from '@/utils/supabase/client';

jest.mock('@/utils/supabase/client', () => ({
  createClient: jest.fn(),
}));

describe('useRealtimeTable', () => {
  let mockChannel: {
    on: jest.Mock;
    subscribe: jest.Mock;
  };
  let mockRemoveChannel: jest.Mock;
  let mockSupabase: ReturnType<typeof jest.fn>;

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
    };
    (createClient as jest.Mock).mockReturnValue(mockSupabase);
  });

  it('subscribes to specified tables on mount', async () => {
    const onRealtimeChange = jest.fn();
    const householdId = 'test-household';

    renderHook(() =>
      useRealtimeTable({
        supabase: mockSupabase,
        householdId,
        tables: ['items', 'categories'],
        onRealtimeChange,
      })
    );

    await waitFor(() => {
      expect(mockSupabase.channel).toHaveBeenCalledTimes(2);
      expect(mockSupabase.channel).toHaveBeenCalledWith(`realtime:items:${householdId}`);
      expect(mockSupabase.channel).toHaveBeenCalledWith(`realtime:categories:${householdId}`);
    });

    expect(mockChannel.on).toHaveBeenCalledTimes(2);
    expect(mockChannel.subscribe).toHaveBeenCalledTimes(2);
  });

  it('debounces load function calls', async () => {
    const onRealtimeChange = jest.fn();
    const householdId = 'test-household';

    const { result } = renderHook(() =>
      useRealtimeTable({
        supabase: mockSupabase,
        householdId,
        tables: ['items'],
        debounceMs: 100,
      })
    );

    await waitFor(() => {
      expect(mockChannel.on).toHaveBeenCalled();
    });

    // Set the handler
    act(() => {
      result.current.setOnChange(onRealtimeChange);
    });

    const handler = mockChannel.on.mock.calls[0][2];

    handler();
    handler();
    handler();

    expect(onRealtimeChange).not.toHaveBeenCalled();

    await waitFor(() => {
      expect(onRealtimeChange).toHaveBeenCalledTimes(1);
    }, { timeout: 200 });
  });

  it('cleans up channels on unmount', async () => {
    const onRealtimeChange = jest.fn();
    const householdId = 'test-household';

    const { unmount } = renderHook(() =>
      useRealtimeTable({
        supabase: mockSupabase,
        householdId,
        householdId,
        tables: ['items'],
        onRealtimeChange,
      })
    );

    await waitFor(() => {
      expect(mockChannel.subscribe).toHaveBeenCalled();
    });

    unmount();

    await waitFor(() => {
      expect(mockRemoveChannel).toHaveBeenCalled();
    });
  });

  it('prevents stale responses with requestId', async () => {
    const onRealtimeChange = jest.fn();
    const householdId = 'test-household';

    const { result } = renderHook(() =>
      useRealtimeTable({
        supabase: mockSupabase,
        householdId,
        tables: ['items'],
        debounceMs: 50,
      })
    );

    await waitFor(() => {
      expect(mockChannel.on).toHaveBeenCalled();
    });

    // Set the handler
    act(() => {
      result.current.setOnChange(onRealtimeChange);
    });

    const handler = mockChannel.on.mock.calls[0][2];

    handler();
    await waitFor(() => {
      expect(onRealtimeChange).toHaveBeenCalledTimes(1);
    });

    onRealtimeChange.mockClear();
    handler();
    handler();

    await waitFor(() => {
      expect(onRealtimeChange).toHaveBeenCalledTimes(1);
    }, { timeout: 150 });
  });
});
