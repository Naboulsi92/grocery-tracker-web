'use client';

import { AccessibleDialog } from './AccessibleDialog';

interface ConfirmDialogProps {
  title: string;
  message: string;
  confirmLabel: string;
  cancelLabel: string;
  confirmTestId?: string;
  cancelTestId?: string;
  pending?: boolean;
  pendingLabel?: string;
  tone?: 'danger' | 'primary';
  onConfirm: () => void;
  onCancel: () => void;
}

/**
 * Backwards-compatible alias: same props, accessible implementation
 * (focus trap, Escape, focus restore, dialog role on content, inert
 * background — ticket #119). Existing account/household call sites keep
 * working unchanged.
 */
export function ConfirmDialog(props: ConfirmDialogProps) {
  return <AccessibleDialog {...props} />;
}
