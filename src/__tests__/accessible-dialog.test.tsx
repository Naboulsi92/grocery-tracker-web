import { render, screen, fireEvent } from '@testing-library/react';
import { AccessibleDialog } from '@/components/AccessibleDialog';

const labels = {
  title: 'Supprimer ?',
  message: 'Irréversible.',
  confirmLabel: 'Supprimer',
  cancelLabel: 'Annuler',
};

function setup(overrides: Partial<Parameters<typeof AccessibleDialog>[0]> = {}) {
  const onConfirm = jest.fn();
  const onCancel = jest.fn();
  render(<AccessibleDialog {...labels} onConfirm={onConfirm} onCancel={onCancel} {...overrides} />);
  return { onConfirm, onCancel };
}

describe('AccessibleDialog (ticket #119)', () => {
  it('exposes role=dialog with labelledby/describedby on the content', () => {
    setup({ dialogTestId: 'dlg', confirmTestId: 'ok', cancelTestId: 'ko' });
    const dialog = screen.getByTestId('dlg');
    expect(dialog).toHaveAttribute('role', 'dialog');
    expect(dialog).toHaveAttribute('aria-modal', 'true');
    const labelledBy = dialog.getAttribute('aria-labelledby');
    const describedBy = dialog.getAttribute('aria-describedby');
    expect(labelledBy).toBeTruthy();
    expect(describedBy).toBeTruthy();
    expect(document.getElementById(labelledBy!)).toHaveTextContent(labels.title);
    expect(document.getElementById(describedBy!)).toHaveTextContent(labels.message);
  });

  it('focuses confirm initially, traps Shift+Tab, closes on Escape', () => {
    const { onCancel } = setup({ confirmTestId: 'ok', cancelTestId: 'ko' });
    const confirm = screen.getByTestId('ok');
    const cancel = screen.getByTestId('ko');
    expect(document.activeElement).toBe(confirm);
    cancel.focus();
    fireEvent.keyDown(document, { key: 'Tab', shiftKey: true });
    expect(document.activeElement).toBe(confirm);
    fireEvent.keyDown(document, { key: 'Escape' });
    expect(onCancel).toHaveBeenCalledTimes(1);
  });

  it('restores focus to the trigger on unmount', () => {
    const trigger = document.createElement('button');
    document.body.appendChild(trigger);
    trigger.focus();
    const { unmount } = render(
      <AccessibleDialog {...labels} onConfirm={jest.fn()} onCancel={jest.fn()} />,
    );
    unmount();
    expect(document.activeElement).toBe(trigger);
    trigger.remove();
  });

  it('calls onConfirm from the confirm button', () => {
    const { onConfirm } = setup({ confirmTestId: 'ok' });
    screen.getByTestId('ok').click();
    expect(onConfirm).toHaveBeenCalledTimes(1);
  });

  it('inerts the background siblings while open and restores them', () => {
    const host = document.createElement('div');
    const background = document.createElement('p');
    const mount = document.createElement('div');
    host.append(background, mount);
    document.body.appendChild(host);
    const { unmount } = render(<AccessibleDialog {...labels} onConfirm={jest.fn()} onCancel={jest.fn()} />, {
      container: mount,
    });
    expect(background.hasAttribute('inert')).toBe(true);
    unmount();
    expect(background.hasAttribute('inert')).toBe(false);
    host.remove();
  });
});
