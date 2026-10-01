# 004 — Reduced motion that keeps comprehension feedback

- **Status**: TODO
- **Commit**: c3c57f3
- **Severity**: MEDIUM
- **Category**: Accessibility
- **Estimated scope**: 2 CSS blocks rewritten + 1 tsx branch

## Problem

Per AUDIT.md, reduced motion means fewer/gentler animations — keep opacity
and color transitions, drop movement. The repo does the opposite: two blanket
nukes kill everything, and no movement has dedicated handling.

```css
/* src/app/globals.css:1155-1164 — current */
@media (prefers-reduced-motion: reduce) {
  *, *::before, *::after {
    scroll-behavior: auto !important;
    animation-duration: 0.01ms !important;
    animation-iteration-count: 1 !important;
    transition-duration: 0.01ms !important;
  }

  .btn-primary:hover, .dashboard-card:hover, .theme-toggle:hover { transform: none; }
}
```

```css
/* src/app/(marketing)/marketing.css:625-635 — current */
.mk-btn-primary, .mk-nav-cta, .mk-check, .mk-item-name, .mk-faq-chevron, .mk-live-dot { transition: none; animation: none; }
```

Uncovered movement (relies on the nukes today, breaks the day the nukes are
fixed): `.spinner` (`globals.css:429-435`, `animation: spin 0.8s linear infinite`),
`.loading-spinner` (`:750-756`), `.animate-pulse` sync dot (`:275-276`),
`v2-fade-in-up`/slide keyframes (`:1347-1377`), FAQ chevron rotate
(`marketing.css:524-531`), and JS smooth scroll:

```tsx
// src/components/marketing/Hero.tsx:26 — current
featuresSection.scrollIntoView({ behavior: 'smooth' });
```

## Target

```css
/* target — replaces the globals blanket */
@media (prefers-reduced-motion: reduce) {
  *, *::before, *::after {
    scroll-behavior: auto !important;
    animation-duration: 0.01ms !important;
    animation-iteration-count: 1 !important;
  }

  /* movement dies, comprehension feedback survives */
  .animate-fade-in, .animate-fade-in-soft, .v2-animate-fade-in-up,
  .v2-animate-slide-in-left, .v2-animate-slide-in-right {
    animation-name: fadeSoftIn !important;
    transform: none !important;
  }
  .spinner, .loading-spinner {
    animation: none !important;
    opacity: 1 !important;
  }
  .animate-pulse, .mk-live-dot, .skeleton {
    animation: none !important;
    opacity: 0.85 !important;
  }
  .mk-faq-chevron { transition: opacity 0.15s !important; }
  .btn-primary:hover, .dashboard-card:hover, .theme-toggle:hover { transform: none; }
}
```

(`fadeSoftIn` is introduced by plan 001. If 001 is not done yet, define the
`@keyframes fadeSoftIn { from { opacity: 0; } to { opacity: 1; } }` here at
root level instead and note it in plans/README.md so 001 reuses it.)

- `transition-duration: 0.01ms` is REMOVED from the blanket: color/opacity
  transitions (0.2 s) are the kept comprehension feedback.
- Marketing blanket (`:625-635`): same treatment — replace `transition: none;
  animation: none` with the movement-only kills above (scoped to its selector
  list).
- Hero scroll becomes reduced-motion aware:

```tsx
// target
const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
featuresSection.scrollIntoView({ behavior: reduceMotion ? 'auto' : 'smooth' });
```

## Repo conventions to follow

- Reduced-motion blocks live at the end of their stylesheet (exemplars:
  `globals.css:1155`, `marketing.css:625`).
- `useScrollAnimation.ts` is dead code — do NOT add branching there.

## Steps

1. Rewrite the `globals.css:1155` block as the target (keep the hover
   `transform: none` line).
2. Rewrite the `marketing.css:625` block the same way, scoped to its list.
3. Add the spinner/pulse/skeleton overrides inside the globals block.
4. Branch `Hero.tsx:26` on `matchMedia` as above.
5. If plan 001 is open, coordinate the single `fadeSoftIn` definition.

## Boundaries

- Do NOT gate anything behind JS `useReducedMotion()` — no such hook exists;
  CSS + the one `matchMedia` call only.
- Do NOT touch `useScrollAnimation` (dead).
- Do NOT change markup/structure — CSS + one expression only.
- Do NOT add new dependencies.
- If a step doesn't match the code you find (drift since the commit stamp), STOP and report instead of improvising.

## Verification

- **Mechanical**: `npm run typecheck` passes.
- **Feel check**: with `prefers-reduced-motion` emulated (Rendering panel):
  - page entrances fade gently with zero vertical/horizontal drift;
  - spinners and the sync dot sit static but fully visible (loading state
    still communicated);
  - button hovers still recolor instantly (feedback kept);
  - the Hero CTA jumps (no smooth scroll).
  - Without emulation: everything animates exactly as before.
- **Done when**: neither blanket contains `transition-duration` or a bare
  `animation: none` on an opacity-feedback element; Hero branches on matchMedia.
