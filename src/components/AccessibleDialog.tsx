'use client';

import { useEffect, useId, useRef } from 'react';

export interface AccessibleDialogProps {
  title: string;
  message: string;
  confirmLabel: string;
  cancelLabel: string;
  confirmTestId?: string;
  cancelTestId?: string;
  dialogTestId?: string;
  pending?: boolean;
  pendingLabel?: string;
  tone?: 'danger' | 'primary';
  onConfirm: () => void;
  onCancel: () => void;
}

const FOCUSABLE_SELECTOR =
  'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])';

/**
 * Accessible modal dialog (WCAG 2.1 AA, ticket #119):
 * - `role="dialog"` + `aria-modal` + labelledby/describedby on the CONTENT
 *   (never the overlay),
 * - focus trap (Tab cycles inside), Escape cancels,
 * - initial focus on the confirm action, focus restored to the trigger,
 * - background siblings made `inert` while open.
 */
export function AccessibleDialog({
  title,
  message,
  confirmLabel,
  cancelLabel,
  confirmTestId,
  cancelTestId,
  dialogTestId,
  pending = false,
  pendingLabel,
  tone = 'danger',
  onConfirm,
  onCancel,
}: AccessibleDialogProps) {
  const contentRef = useRef<HTMLDivElement>(null);
  const confirmRef = useRef<HTMLButtonElement>(null);
  const triggerRef = useRef<Element | null>(null);
  const titleId = useId();
  const messageId = useId();
  const onCancelRef = useRef(onCancel);
  useEffect(() => {
    onCancelRef.current = onCancel;
  });

  useEffect(() => {
    // Remember the trigger for focus restoration (the element focused when
    // the dialog mounts is the button that opened it).
    triggerRef.current = document.activeElement;
    confirmRef.current?.focus();
    // Inert the page background while open: walk from the overlay up to
    // <body>, inerting each ancestor's siblings (never the dialog's own
    // chain — a single level misses background outside the mount parent,
    // e.g. the header when the dialog renders inside <main>).
    // Restored on cleanup.
    const inerted: Element[] = [];
    let node: Element | null = contentRef.current?.parentElement ?? null;
    while (node && node !== document.body) {
      const parent = node.parentElement;
      if (!parent) break;
      for (const sibling of Array.from(parent.children)) {
        if (sibling !== node && !sibling.hasAttribute('inert')) {
          sibling.setAttribute('inert', '');
          inerted.push(sibling);
        }
      }
      node = parent;
    }
    return () => {
      for (const sibling of inerted) sibling.removeAttribute('inert');
      const trigger = triggerRef.current;
      if (trigger instanceof HTMLElement) trigger.focus();
    };
  }, []);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.stopPropagation();
        onCancelRef.current();
        return;
      }
      if (event.key !== 'Tab') return;
      const content = contentRef.current;
      if (!content) return;
      const focusables = Array.from(content.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR)).filter(
        (element) => !element.hasAttribute('disabled') && element.getAttribute('aria-hidden') !== 'true',
      );
      if (focusables.length === 0) {
        event.preventDefault();
        return;
      }
      const first = focusables[0];
      const last = focusables[focusables.length - 1];
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    };
    document.addEventListener('keydown', onKeyDown, true);
    return () => document.removeEventListener('keydown', onKeyDown, true);
  }, []);

  return (
    <div className="modal-overlay" onClick={onCancel}>
      <div
        ref={contentRef}
        className="modal-content"
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        aria-describedby={messageId}
        data-testid={dialogTestId}
        onClick={(event) => event.stopPropagation()}
      >
        <h3 id={titleId}>{title}</h3>
        <p id={messageId} className="text-muted" style={{ margin: '0.75rem 0 1.5rem' }}>
          {message}
        </p>
        <div style={{ display: 'flex', gap: '0.75rem', justifyContent: 'flex-end' }}>
          <button
            type="button"
            className="btn btn-secondary"
            onClick={onCancel}
            disabled={pending}
            data-testid={cancelTestId}
          >
            {cancelLabel}
          </button>
          <button
            ref={confirmRef}
            type="button"
            className={tone === 'danger' ? 'btn btn-danger' : 'btn btn-primary'}
            onClick={onConfirm}
            disabled={pending}
            data-testid={confirmTestId}
          >
            {pending && pendingLabel ? pendingLabel : confirmLabel}
          </button>
        </div>
      </div>
      <style>{`
        .modal-overlay {
          position: fixed;
          inset: 0;
          background: rgba(0, 0, 0, 0.5);
          display: flex;
          align-items: center;
          justify-content: center;
          z-index: 100;
          padding: 1rem;
        }
        .modal-content {
          background: var(--color-surface);
          border: 1px solid var(--color-border-subtle);
          border-radius: var(--radius-md);
          padding: 1.5rem;
          max-width: 400px;
          width: 100%;
          box-shadow: var(--shadow-lg);
        }
        .modal-content h3 {
          font-size: 1.125rem;
        }
        .btn-danger {
          background: var(--color-danger);
          color: #fff;
        }
        .btn-danger:hover {
          opacity: 0.9;
          transform: translateY(-1px);
          box-shadow: var(--shadow-md);
        }
        .btn-danger:disabled {
          opacity: 0.5;
          cursor: not-allowed;
          transform: none;
        }
      `}</style>
    </div>
  );
}
