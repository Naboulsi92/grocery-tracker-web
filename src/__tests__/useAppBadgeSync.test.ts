import { renderHook } from '@testing-library/react';
import { useAppBadgeSync } from '@/hooks/useAppBadgeSync';

function installBadgeStubs() {
  const set = jest.fn(() => Promise.resolve());
  const clear = jest.fn(() => Promise.resolve());
  Reflect.defineProperty(window.navigator, 'setAppBadge', {
    value: set,
    configurable: true,
  });
  Reflect.defineProperty(window.navigator, 'clearAppBadge', {
    value: clear,
    configurable: true,
  });
  return { set, clear };
}

function installRejectingBadgeStubs() {
  const set = jest.fn(() => Promise.reject(new Error('badge rejected')));
  const clear = jest.fn(() => Promise.reject(new Error('badge rejected')));
  Reflect.defineProperty(window.navigator, 'setAppBadge', {
    value: set,
    configurable: true,
  });
  Reflect.defineProperty(window.navigator, 'clearAppBadge', {
    value: clear,
    configurable: true,
  });
  return { set, clear };
}

afterEach(() => {
  Reflect.deleteProperty(window.navigator, 'setAppBadge');
  Reflect.deleteProperty(window.navigator, 'clearAppBadge');
});

describe('useAppBadgeSync', () => {
  it('sets the exact count for a populated list', () => {
    const { set, clear } = installBadgeStubs();
    renderHook(() => useAppBadgeSync(3));
    expect(set).toHaveBeenCalledTimes(1);
    expect(set).toHaveBeenCalledWith(3);
    expect(clear).not.toHaveBeenCalled();
  });

  it('clears when the list is empty', () => {
    const { set, clear } = installBadgeStubs();
    renderHook(() => useAppBadgeSync(0));
    expect(clear).toHaveBeenCalledTimes(1);
    expect(set).not.toHaveBeenCalled();
  });

  it('touches nothing while the count is unknown', () => {
    const { set, clear } = installBadgeStubs();
    renderHook(() => useAppBadgeSync(null));
    expect(set).not.toHaveBeenCalled();
    expect(clear).not.toHaveBeenCalled();
  });

  it('stays silent for invalid counts (guard identical to the SW)', () => {
    const { set, clear } = installBadgeStubs();
    renderHook(() => useAppBadgeSync(-1));
    renderHook(() => useAppBadgeSync(2.5));
    expect(set).not.toHaveBeenCalled();
    expect(clear).not.toHaveBeenCalled();
  });

  it('clears when the count drops from 3 to 0 across rerenders', () => {
    const { set, clear } = installBadgeStubs();
    const { rerender } = renderHook(({ count }) => useAppBadgeSync(count), {
      initialProps: { count: 3 as number | null },
    });
    rerender({ count: 0 });
    expect(set).toHaveBeenCalledTimes(1);
    expect(set).toHaveBeenCalledWith(3);
    expect(clear).toHaveBeenCalledTimes(1);
  });

  it('swallows a rejected badge call without breaking the effect', async () => {
    const { set } = installRejectingBadgeStubs();
    expect(() => {
      renderHook(() => useAppBadgeSync(1));
    }).not.toThrow();
    expect(set).toHaveBeenCalledTimes(1);
    expect(set).toHaveBeenCalledWith(1);
  });

  it('is a silent no-op without the badge API (Firefox desktop)', () => {
    // Badge props never installed: cover both branches of the typeof guards.
    expect(() => {
      renderHook(() => useAppBadgeSync(1));
      renderHook(() => useAppBadgeSync(0));
    }).not.toThrow();
  });

  it('leaves the OS badge alone on unmount (no reset)', () => {
    const { set, clear } = installBadgeStubs();
    const { unmount } = renderHook(() => useAppBadgeSync(3));
    unmount();
    expect(set).toHaveBeenCalledTimes(1);
    expect(clear).not.toHaveBeenCalled();
  });

  it('follows null → first count → updated count across the production mount cycle', () => {
    const { set, clear } = installBadgeStubs();
    const { rerender } = renderHook(({ count }) => useAppBadgeSync(count), {
      initialProps: { count: null as number | null },
    });
    rerender({ count: 3 });
    rerender({ count: 5 });
    expect(set).toHaveBeenCalledTimes(2);
    expect(set).toHaveBeenNthCalledWith(1, 3);
    expect(set).toHaveBeenNthCalledWith(2, 5);
    expect(clear).not.toHaveBeenCalled();
  });
});
