import { BACKOFF_SCHEDULE, getBackoffDelay } from '@/lib/offlineQueue';

// Note: jsdom does not ship a real IndexedDB, so the IDB-backed array methods
// (enqueueAction, getPendingActions, processQueue, ...) are exercised in the
// browser / e2e instead. Here we cover the pure queue helpers.

describe('offline queue backoff schedule', () => {
  it('defines the 1s → 30s exponential schedule', () => {
    expect([...BACKOFF_SCHEDULE]).toEqual([1000, 2000, 4000, 8000, 16000, 30000]);
  });

  it('uses the schedule for the first retry', () => {
    expect(getBackoffDelay(0)).toBe(1000);
    expect(getBackoffDelay(1)).toBe(2000);
    expect(getBackoffDelay(2)).toBe(4000);
    expect(getBackoffDelay(3)).toBe(8000);
    expect(getBackoffDelay(4)).toBe(16000);
  });

  it('clamps at 30s max once the schedule is exhausted', () => {
    expect(getBackoffDelay(5)).toBe(30000);
    expect(getBackoffDelay(100)).toBe(30000);
  });
});