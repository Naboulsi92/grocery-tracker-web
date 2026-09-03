import { renderHook } from '@testing-library/react';
import { useCtaTracking } from '../useCtaTracking';

describe('useCtaTracking', () => {
  it('should call trackCtaClick when an element with data-cta-name is clicked', () => {
    const trackCtaClick = jest.fn();
    const { unmount } = renderHook(() =>
      useCtaTracking({ trackCtaClick })
    );

    // Create a clickable element with data-cta-name
    const button = document.createElement('button');
    button.setAttribute('data-cta-name', 'Test_CTA');
    button.setAttribute('href', '/test');
    document.body.appendChild(button);

    // Click the button
    button.click();

    // Verify the callback was called
    expect(trackCtaClick).toHaveBeenCalledTimes(1);
    expect(trackCtaClick).toHaveBeenCalledWith({
      name: 'Test_CTA',
      element: 'BUTTON',
      href: '/test',
    });

    // Cleanup
    unmount();
    document.body.removeChild(button);
  });

  it('should handle clicks on nested elements inside data-cta-name elements', () => {
    const trackCtaClick = jest.fn();
    const { unmount } = renderHook(() =>
      useCtaTracking({ trackCtaClick })
    );

    // Create a parent with data-cta-name and a nested child
    const parent = document.createElement('div');
    parent.setAttribute('data-cta-name', 'Nested_CTA');
    const child = document.createElement('span');
    parent.appendChild(child);
    document.body.appendChild(parent);

    // Click the child element
    child.click();

    // Verify the callback was called with the parent's data-cta-name
    expect(trackCtaClick).toHaveBeenCalledTimes(1);
    expect(trackCtaClick).toHaveBeenCalledWith({
      name: 'Nested_CTA',
      element: 'SPAN',
      href: undefined,
    });

    // Cleanup
    unmount();
    document.body.removeChild(parent);
  });

  it('should not call trackCtaClick when clicking an element without data-cta-name', () => {
    const trackCtaClick = jest.fn();
    const { unmount } = renderHook(() =>
      useCtaTracking({ trackCtaClick })
    );

    // Create a regular button without data-cta-name
    const button = document.createElement('button');
    document.body.appendChild(button);

    // Click the button
    button.click();

    // Verify the callback was not called
    expect(trackCtaClick).not.toHaveBeenCalled();

    // Cleanup
    unmount();
    document.body.removeChild(button);
  });

  it('should handle elements without href attribute', () => {
    const trackCtaClick = jest.fn();
    const { unmount } = renderHook(() =>
      useCtaTracking({ trackCtaClick })
    );

    // Create a div with data-cta-name but no href
    const div = document.createElement('div');
    div.setAttribute('data-cta-name', 'Div_CTA');
    document.body.appendChild(div);

    // Click the div
    div.click();

    // Verify the callback was called with undefined href
    expect(trackCtaClick).toHaveBeenCalledTimes(1);
    expect(trackCtaClick).toHaveBeenCalledWith({
      name: 'Div_CTA',
      element: 'DIV',
      href: undefined,
    });

    // Cleanup
    unmount();
    document.body.removeChild(div);
  });

  it('should clean up event listener on unmount', () => {
    const trackCtaClick = jest.fn();
    const addEventListenerSpy = jest.spyOn(document, 'addEventListener');
    const removeEventListenerSpy = jest.spyOn(document, 'removeEventListener');

    const { unmount } = renderHook(() =>
      useCtaTracking({ trackCtaClick })
    );

    // Verify addEventListener was called
    expect(addEventListenerSpy).toHaveBeenCalledWith('click', expect.any(Function));

    // Unmount the hook
    unmount();

    // Verify removeEventListener was called
    expect(removeEventListenerSpy).toHaveBeenCalledWith('click', expect.any(Function));

    // Cleanup spies
    addEventListenerSpy.mockRestore();
    removeEventListenerSpy.mockRestore();
  });

  it('should use the latest trackCtaClick callback when it changes', () => {
    const trackCtaClick1 = jest.fn();
    const trackCtaClick2 = jest.fn();

    const { rerender } = renderHook(
      ({ trackCtaClick }: { trackCtaClick: (data: any) => void }) =>
        useCtaTracking({ trackCtaClick }),
      { initialProps: { trackCtaClick: trackCtaClick1 } }
    );

    // Create and click an element
    const button = document.createElement('button');
    button.setAttribute('data-cta-name', 'Test_CTA');
    document.body.appendChild(button);
    button.click();

    expect(trackCtaClick1).toHaveBeenCalledTimes(1);
    expect(trackCtaClick2).not.toHaveBeenCalled();

    // Rerender with new callback
    rerender({ trackCtaClick: trackCtaClick2 });

    // Click again
    button.click();

    expect(trackCtaClick1).toHaveBeenCalledTimes(1);
    expect(trackCtaClick2).toHaveBeenCalledTimes(1);

    // Cleanup
    document.body.removeChild(button);
  });
});
