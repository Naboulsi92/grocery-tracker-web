import { renderHook } from '@testing-library/react';
import { useScrollAnimation } from '../useScrollAnimation';

// Mock IntersectionObserver
let mockObserve: jest.Mock;
let mockDisconnect: jest.Mock;
let capturedCallback: IntersectionObserverCallback;

// Helper to create a mock element with mocked classList
const createMockElement = () => {
  const element = document.createElement('div');
  element.classList.add = jest.fn();
  return element;
};

// Helper to create a mock IntersectionObserverEntry
const createMockEntry = (target: HTMLElement, isIntersecting: boolean): IntersectionObserverEntry => ({
  target,
  isIntersecting,
  boundingClientRect: target.getBoundingClientRect(),
  intersectionRatio: isIntersecting ? 1 : 0,
  intersectionRect: isIntersecting ? target.getBoundingClientRect() : new DOMRect(0, 0, 0, 0),
  rootBounds: null,
  time: Date.now(),
});

beforeAll(() => {
  mockObserve = jest.fn();
  mockDisconnect = jest.fn();

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  (global as any).IntersectionObserver = class IntersectionObserver {
    constructor(callback: IntersectionObserverCallback) {
      capturedCallback = callback;
    }
    observe = mockObserve;
    unobserve = jest.fn();
    disconnect = mockDisconnect;
  };
});

afterEach(() => {
  jest.clearAllMocks();
});

describe('useScrollAnimation', () => {
  it('should observe elements and add animation class when they intersect', () => {
    const ref1 = { current: createMockElement() };

    renderHook(() =>
      useScrollAnimation([ref1], { threshold: 0.1 })
    );

    // Simulate intersection using the captured callback
    capturedCallback([createMockEntry(ref1.current, true)], {} as IntersectionObserver);

    // Verify the animation class was added
    expect(ref1.current.classList.add).toHaveBeenCalledWith('v2-animate-fade-in-up');
  });

  it('should not add animation class when element is not intersecting', () => {
    const ref1 = { current: createMockElement() };

    renderHook(() =>
      useScrollAnimation([ref1], { threshold: 0.1 })
    );

    // Simulate non-intersection
    capturedCallback([createMockEntry(ref1.current, false)], {} as IntersectionObserver);

    // Verify the animation class was not added
    expect(ref1.current.classList.add).not.toHaveBeenCalled();
  });

  it('should set initial opacity to 0 and animation delay', () => {
    const ref1 = { current: createMockElement() };
    const ref2 = { current: createMockElement() };

    renderHook(() =>
      useScrollAnimation([ref1, ref2], { staggerDelay: '0.2s' })
    );

    // Verify initial styles
    expect(ref1.current.style.opacity).toBe('0');
    expect(ref2.current.style.opacity).toBe('0');

    // Verify animation delays (0s for first, 0.2s for second)
    expect(ref1.current.style.animationDelay).toBe('0s');
    expect(ref2.current.style.animationDelay).toBe('0.2s');
  });

  it('should use default options when none are provided', () => {
    const ref1 = { current: createMockElement() };

    renderHook(() => useScrollAnimation([ref1]));

    // Verify the observer was created with default options
    expect(mockObserve).toHaveBeenCalled();
  });

  it('should use custom threshold and rootMargin when provided', () => {
    const ref1 = { current: createMockElement() };

    renderHook(() =>
      useScrollAnimation([ref1], {
        threshold: 0.5,
        rootMargin: '10px',
        staggerDelay: '0.3s',
      })
    );

    // Verify the observer was created (custom options are passed to constructor)
    expect(mockObserve).toHaveBeenCalled();
  });

  it('should skip null refs', () => {
    const ref1 = { current: createMockElement() };
    const ref2 = { current: null };
    const ref3 = { current: createMockElement() };

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    renderHook(() => useScrollAnimation([ref1, ref2, ref3] as any));

    // Verify only non-null refs were observed
    expect(mockObserve).toHaveBeenCalledTimes(2);
  });

  it('should only observe once even if hook is re-rendered', () => {
    const ref1 = { current: createMockElement() };

    const { rerender } = renderHook(() =>
      useScrollAnimation([ref1], { threshold: 0.1 })
    );

    const initialCallCount = mockObserve.mock.calls.length;

    // Rerender with same refs
    rerender();

    // Verify observer was not called again (due to animationStarted ref)
    expect(mockObserve.mock.calls.length).toBe(initialCallCount);
  });

  it('should disconnect observer on unmount', () => {
    const ref1 = { current: createMockElement() };

    const { unmount } = renderHook(() =>
      useScrollAnimation([ref1])
    );

    // Unmount
    unmount();

    // Verify disconnect was called
    expect(mockDisconnect).toHaveBeenCalled();
  });

  it('should calculate stagger delays correctly for multiple elements', () => {
    const ref1 = { current: createMockElement() };
    const ref2 = { current: createMockElement() };
    const ref3 = { current: createMockElement() };

    renderHook(() =>
      useScrollAnimation([ref1, ref2, ref3], { staggerDelay: '0.15s' })
    );

    // Verify stagger delays
    expect(ref1.current.style.animationDelay).toBe('0s');
    expect(ref2.current.style.animationDelay).toBe('0.15s');
    expect(ref3.current.style.animationDelay).toBe('0.3s');
  });
});
