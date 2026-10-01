# 002 — Add press feedback to the highest-frequency controls

- **Status**: DONE (implemented by #178, commit 46b1215 — :active rules + 160ms transform transitions live in globals.css)
- **Commit**: c3c57f3
- **Severity**: HIGH
- **Category**: Physicality & origin
- **Estimated scope**: 1 CSS file, ~4 rules added

## Problem

The only `:active` rule in the repo is the drag handle
(`src/app/globals.css:857`). The ± stepper buttons (tapped dozens of times
per day), `.btn`, `.action-btn` (edit/delete), and dashboard cards press with
zero feedback — they feel dead under the finger.

```css
/* src/app/globals.css:959-975 — current */
.qty-btn {
  width: 44px;
  height: 44px;
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: var(--radius-sm);
  font-size: 1.125rem;
  font-weight: 500;
  color: var(--color-text-secondary);
  transition: all 0.2s;
}

.qty-btn:hover {
  background: var(--color-surface);
  color: var(--color-text);
}
```

Same shape (hover-only, `transition: all 0.2s`, no `:active`): `.btn` at
`src/app/globals.css:153`, `.action-btn` at `:818`, `.dashboard-card` at
`:585` (hover lift at `:696`).

## Target

Per AUDIT.md: `transform: scale(0.97)` on `:active` with
`transition: transform 160ms ease-out`. Keep it subtle (0.95–0.98).

```css
/* target */
.qty-btn {
  /* ... unchanged ... */
  transition: background-color 0.2s var(--ease-out), color 0.2s var(--ease-out), transform 160ms var(--ease-out);
}
.qty-btn:active {
  transform: scale(0.95);
}
```

- `.qty-btn:active`: `scale(0.95)` (44 px touch target, needs the clearest feedback).
- `.btn:active`, `.action-btn:active`: `scale(0.97)`.
- `.dashboard-card:active` (it is a link): `scale(0.98)`.
- Each rule's `transition: all 0.2s` becomes the explicit property list above
  (this also retires 4 of the 13 `transition: all` findings; the rest are plan 003).
- `var(--ease-out)` is introduced by plan 003. If 003 is not done yet, define
  it here exactly as `--ease-out: cubic-bezier(0.23, 1, 0.32, 1);` on `:root`
  next to the `--v2-transition-*` tokens (`src/app/globals.css:1216`) and note
  in plans/README.md that 003 must reuse (not duplicate) it.

## Repo conventions to follow

- Button/hover styles live in `src/app/globals.css` next to their base rule
  (exemplar: `.qty-btn:hover` directly under `.qty-btn`).
- `:root` tokens live with the `--v2-transition-*` block at `:1216`.

## Steps

1. Add `--ease-out: cubic-bezier(0.23, 1, 0.32, 1);` to `:root` (skip if plan
   003 already did — check first).
2. `.qty-btn`: replace `transition: all 0.2s` with the explicit list; add the
   `:active` rule with `scale(0.95)`.
3. `.btn`, `.action-btn`: same, with `scale(0.97)`.
4. `.dashboard-card`: same, with `scale(0.98)`.

## Boundaries

- Do NOT add press feedback to `.dnd-drag-handle` (already has its own).
- Do NOT touch hover styles — lift on hover stays as-is.
- Do NOT change markup/structure — CSS only.
- Do NOT add new dependencies.
- If a step doesn't match the code you find (drift since the commit stamp), STOP and report instead of improvising.

## Verification

- **Mechanical**: `npm run typecheck` passes; `npx playwright test --list` parses.
- **Feel check**: on a real phone (or touch emulation), tap ± rapidly and confirm:
  - every tap visibly dents the button (no dead presses);
  - spamming never sticks the button in a scaled state (transition retargets mid-press);
  - edit/delete buttons and dashboard cards dent subtly on press.
  - Toggle `prefers-reduced-motion` (Rendering panel): press feedback is
    transform-based — confirm it is dropped per plan 004's rule if 004 is
    done; if not, note it in the PR.
- **Done when**: `grep -n ":active" src/app/globals.css` shows the four new
  rules; no `transition: all` remains on those four selectors.
