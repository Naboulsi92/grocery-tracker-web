# 006 — Micro-transitions on the three teleporting state changes

- **Status**: DONE (implemented by #185 — menu/qty/checkoff; feel-checked on preview, opacity appended not replaced)
- **Commit**: c3c57f3
- **Severity**: LOW
- **Category**: Missed opportunities (teleporting state changes)
- **Estimated scope**: 3 small CSS additions across 2 files

## Problem

Three high-visibility state changes swap instantly with no motion explaining
the change:

1. Marketing mobile menu teleports open (trigger-anchored panel with no origin motion):

```css
/* src/app/(marketing)/marketing.css:194-198 — current */
.mk-mobile-menu {
  display: grid;
  gap: 0.5rem;
  padding: 1rem 1.5rem 1.25rem;
}
```

```tsx
// src/components/marketing/Header.tsx:64-65 — current
{mobileMenuOpen && (
  <div className="mk-mobile-menu">
```

2. The item quantity readout swaps instantly on every stepper tap (highest-frequency UI in the app):

```tsx
// src/app/items/page.tsx:428 — current
<span className="qty-value" aria-live="polite">{item.quantity} {item.unit}</span>
```

3. To-buy check-off swaps controls→badge + strikethrough instantly:

```css
/* src/app/globals.css:1035-1044 — current */
.to-buy-item.checked {
  border-left-color: var(--color-success);
  background: var(--color-accent-muted);
  opacity: 0.65;
}
```

## Target

```css
/* target — marketing.css, next to .mk-mobile-menu */
.mk-mobile-menu {
  /* ... unchanged ... */
  animation: mkMenuIn 200ms var(--ease-out) both;
  transform-origin: top center;
}
@keyframes mkMenuIn {
  from { opacity: 0; transform: translateY(-6px); }
  to { opacity: 1; transform: translateY(0); }
}
```

```css
/* target — globals.css, next to .qty-value */
.qty-value {
  display: inline-block;
  transition: transform 120ms var(--ease-out), opacity 120ms var(--ease-out);
}
.qty-value-flash {
  animation: qtyPop 160ms var(--ease-out);
}
@keyframes qtyPop {
  0% { transform: scale(1.25); }
  100% { transform: scale(1); }
}
```

```css
/* target — globals.css, extend .to-buy-item.checked */
.to-buy-item {
  transition: background-color 0.2s var(--ease-out), border-color 0.2s var(--ease-out), opacity 0.2s var(--ease-out);
}
```

- The qty flash needs a re-trigger: in `src/app/items/page.tsx`, add
  `key={item.quantity}` to the `.qty-value` span so each value change
  remounts it and replays `qtyPop`. (`key` on a span is markup-minimal and
  keeps `aria-live="polite"` intact — the one sanctioned markup change.)
- `var(--ease-out)` comes from plan 003 (`cubic-bezier(0.23, 1, 0.32, 1)`);
  hardcode it here if 003 is not done, and note the duplication in
  plans/README.md for 003 to tokenize.
- Durations stay ≤200 ms everywhere: these fire dozens of times per day and
  must never feel slow.

## Repo conventions to follow

- Component CSS lives in `globals.css` / `marketing.css` next to the base rule
  (exemplar: `.qty-btn:hover` under `.qty-btn`).
- Stagger/entrance values stay inline in tsx; keyframe utilities stay in CSS.

## Steps

1. `marketing.css`: add the `mkMenuIn` keyframes + `animation` + `transform-origin` on `.mk-mobile-menu`.
2. `globals.css`: add `.qty-value` transition + `.qty-value-flash` + `qtyPop` keyframes.
3. `src/app/items/page.tsx:428`: add `key={item.quantity}` and class `qty-value-flash` to the span.
4. `globals.css`: give `.to-buy-item` (base rule at `:983`) the explicit
   background/border/opacity transition (this also retires one `transition: all`).

## Boundaries

- Do NOT animate layout properties (no height/width transitions on the menu —
  opacity + 6 px drift only).
- Do NOT add spring/bounce anywhere here (daily-use UI stays crisp).
- Do NOT change markup except the single sanctioned `key` addition.
- Do NOT add new dependencies.
- If a step doesn't match the code you find (drift since the commit stamp), STOP and report instead of improvising.

## Verification

- **Mechanical**: `npm run typecheck` passes; `npm test -- src/__tests__` passes
  (if a test snapshots the qty span, the `key` prop does not appear in DOM —
  no snapshot churn expected).
- **Feel check**: tap ± rapidly and confirm the number pops (never restarts
  mid-tap into a stuck scale — transitions retarget, the key remount replays
  cleanly per value); open/close the mobile menu and confirm it drops from its
  trigger; check off a to-buy item and confirm the row crossfades instead of
  snapping.
- **Done when**: all three interactions show ≤200 ms motion; no instant swaps remain on these paths.
