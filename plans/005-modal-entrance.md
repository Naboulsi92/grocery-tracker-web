# 005 — Give the confirm modal a standard entrance

- **Status**: TODO
- **Commit**: c3c57f3
- **Severity**: MEDIUM
- **Category**: Missed opportunities (spatially-connected UI)
- **Estimated scope**: 1 file, 1 style block

## Problem

`AccessibleDialog` (used by `ConfirmDialog` for destructive confirms —
leave-household, invitation regen, item delete) teleports in: overlay and
content have base styles but zero entrance motion.

```tsx
// src/components/AccessibleDialog.tsx:154-173 — current (colocated <style>)
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
```

Per AUDIT.md, occasional UI (modals) gets a standard animation: 200–500 ms,
entering with `ease-out`, appearing from `scale(0.9–0.97)` + `opacity: 0`.
Modals appear centered — `transform-origin: center` is correct here and is
explicitly NOT a finding.

## Target

```css
/* target — added to the same colocated <style> block */
.modal-overlay {
  /* ... unchanged ... */
  animation: modalFadeIn 200ms var(--ease-out) both;
}
.modal-content {
  /* ... unchanged ... */
  animation: modalPopIn 250ms var(--ease-out) both;
  transform-origin: center;
}
@keyframes modalFadeIn {
  from { opacity: 0; }
  to { opacity: 1; }
}
@keyframes modalPopIn {
  from { opacity: 0; transform: scale(0.96); }
  to { opacity: 1; transform: scale(1); }
}
```

- `var(--ease-out)` is introduced by plan 003 as
  `cubic-bezier(0.23, 1, 0.32, 1)`. If 003 is not done yet, hardcode the
  cubic-bezier here and note in plans/README.md that 003 must tokenize it.
- Exit: none (unmount is instant — deliberate; exit animation would need
  deferred unmount, out of scope).

## Repo conventions to follow

- Modal styles live in the colocated `<style>` block of
  `src/components/AccessibleDialog.tsx` (that is where `.modal-overlay` and
  `.modal-content` already are) — extend it, do not move styles to globals.css.
- `ConfirmDialog.tsx` wraps `AccessibleDialog` — no changes needed there.

## Steps

1. In the `<style>` block, add `animation: modalFadeIn 200ms … both` to
   `.modal-overlay` and `animation: modalPopIn 250ms … both` +
   `transform-origin: center` to `.modal-content`.
2. Append the two `@keyframes` at the end of the same `<style>` block.

## Boundaries

- Do NOT add exit animation / deferred unmount.
- Do NOT restyle the dialog (colors, layout, buttons) — entrance only.
- Do NOT touch `ConfirmDialog.tsx` call sites.
- Do NOT add new dependencies.
- If a step doesn't match the code you find (drift since the commit stamp), STOP and report instead of improvising.

## Verification

- **Mechanical**: `npm run typecheck` passes; `npx playwright test --list` parses.
- **Feel check**: trigger a destructive confirm (delete an item) and confirm:
  - the overlay fades (no flash of un-dimmed page);
  - the dialog scales up from center, settling without overshoot (bounce must
    be zero — this is a confirm, not a celebration);
  - in DevTools at 10% playback the content starts at scale(0.96)/opacity 0.
  - With `prefers-reduced-motion` emulated: gentle fade only (plan 004's
    blanket covers keyframes globally; verify no movement remains).
- **Done when**: opening any confirm shows the 200/250 ms entrance; closing stays instant.
