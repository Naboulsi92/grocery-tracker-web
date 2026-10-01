# 003 — Easing tokens + kill `transition: all` and bare easings

- **Status**: DONE (implemented by #178, commit 46b1215 — --ease-out/--ease-in-out in :root, zero live transition:all; dead v2 lines + unused page.module.css deliberately untouched)
- **Commit**: c3c57f3
- **Severity**: MEDIUM
- **Category**: Easing & duration + Cohesion & tokens
- **Estimated scope**: 1 token block + ~18 declaration swaps across 3 CSS files

## Problem

No `--ease-*` token exists anywhere (verified zero hits). Every curve is a
weak built-in (`ease`, `ease-out`) and every `transition: all` animates
unintended properties off-GPU. Durations are hand-typed per rule.

```css
/* src/app/globals.css:1216-1218 — current */
--v2-transition-fast: 0.2s ease;
--v2-transition-smooth: 0.3s ease;
--v2-transition-slow: 0.5s ease;
```

```css
/* src/app/globals.css:163 (.btn), :294 (.theme-toggle), :329 (.language-toggle__button),
   :590 (.dashboard-card), :770 (.back-link), :792 (.category-card), :826 (.action-btn),
   :877 (.icon-option), :923 (.item-row), :969 (.qty-btn), :992 (.to-buy-item) — current */
transition: all 0.2s;
```

```css
/* src/app/(marketing)/marketing.css:349 — current */
transition: all 0.25s ease;
```

```css
/* src/app/(marketing)/marketing.css:527 (.mk-faq-chevron), :54, :167 — current */
transition: transform 0.2s ease;
transition: background-color 0.2s, transform 0.15s;
```

```css
/* src/app/globals.css:267 — current */
animation: fadeIn 0.3s ease-out forwards;
```

(`forwards` here becomes `both` if plan 001 landed first — check; do not revert it.)

## Target

Exact AUDIT.md values, as `:root` tokens next to the `--v2-transition-*` block:

```css
/* target */
--ease-out: cubic-bezier(0.23, 1, 0.32, 1);
--ease-in-out: cubic-bezier(0.77, 0, 0.175, 1);
```

- Every `transition: all 0.2s` (and `page.module.css:81`'s bare `transition: 0.2s`,
  which defaults to `all`) becomes an explicit list, e.g.:
  `transition: background-color 0.2s var(--ease-out), border-color 0.2s var(--ease-out), color 0.2s var(--ease-out), transform 0.2s var(--ease-out), box-shadow 0.2s var(--ease-out);`
  Trim the list per selector where the hover rule proves fewer properties move
  (e.g. a color-only hover needs just `background-color, border-color, color`),
  but never reintroduce `all`.
- `fadeIn` entrance: `ease-out` → `var(--ease-out)`.
- `.mk-faq-chevron` rotate: `ease` → `var(--ease-in-out)` (on-screen movement).
- Marketing buttons (`:54`, `:167`) and `globals.css:141`
  (`border-color 0.2s, box-shadow 0.2s`): keep durations, swap any bare easing
  for `var(--ease-out)`.

## Repo conventions to follow

- Tokens live in the `:root` block at `src/app/globals.css:1216` (exemplar:
  `--v2-transition-fast`). Marketing CSS consumes globals tokens already
  (verify one `var(--color-*)` use in marketing.css before duplicating).
- If plan 002 already defined `--ease-out`, reuse it — do NOT define twice
  (check `:root` first).

## Steps

1. Add the two tokens to `:root` (unless 002 did).
2. Replace each of the 11 `transition: all 0.2s` in globals.css with the
   explicit list (same file order: 163, 294, 329, 590, 770, 792, 826, 877,
   923, 969, 992). Skip 1248/1269/1293 — dead v2 classes, out of scope.
3. `marketing.css:349`: `all 0.25s ease` → explicit list + `var(--ease-out)`.
4. `page.module.css:81`: bare `transition: 0.2s` → explicit list for the
   properties its `:hover` (gated at `:98`) actually moves.
5. Chevron `:527` → `var(--ease-in-out)`; `fadeIn :267` → `var(--ease-out)`.

## Boundaries

- Do NOT touch `1248/1269/1293` (`transition: all var(--v2-transition-smooth)`
  on dead v2 classes), `v2-delay-*`, `useScrollAnimation` — dead code
  (see plans/README.md housekeeping note).
- Do NOT change durations (0.2 s stays 0.2 s) — curves only in this plan.
- Do NOT change markup/structure — CSS declarations only.
- Do NOT add new dependencies.
- If a step doesn't match the code you find (drift since the commit stamp), STOP and report instead of improvising.

## Verification

- **Mechanical**: `npm run typecheck` passes; `grep -rn "transition: all" src/app/*.css src/app/**/*.css` returns only the three dead v2 lines; `grep -rn "0.2s ease[;,)]" src/app` returns nothing (bare easings gone from transitions).
- **Feel check**: hover every button/card/toggle and confirm the motion feels
  identical-or-snappier (curves change, durations don't); FAQ chevron rotates
  with a slight settle instead of a linear-feeling swing.
- **Done when**: `--ease-out`/`--ease-in-out` exist once in `:root`; zero live
  `transition: all`; zero bare `ease`/`ease-out` in transition/animation
  declarations outside keyframes-timing for infinite loaders.
