# 001 — Fix the entrance cascade: backwards fill, capped staggers, opacity-only rows

- **Status**: DONE (implemented by #182 — both fill, fadeSoftIn rows, capped staggers; feel-checked on preview)
- **Commit**: c3c57f3
- **Severity**: HIGH
- **Category**: Interruptibility + Purpose & frequency
- **Estimated scope**: 1 CSS rule + ~8 tsx delay values

## Problem

`.animate-fade-in` has no `backwards` fill, so every staggered entrance flashes
visible during its `animation-delay`, then jumps to `opacity: 0` and fades in.
On the dashboard the cascade runs to 400 ms delay; on a 30-row items list to
600 ms. Every page visit replays it.

```css
/* src/app/globals.css:266-268 — current */
.animate-fade-in {
  animation: fadeIn 0.3s ease-out forwards;
}
```

```tsx
// src/app/home/page.tsx:252 — current (tail of the cascade)
<section className="dashboard-card notification-card animate-fade-in" style={{ animationDelay: '400ms' }} aria-labelledby="notifications-title">
```

```tsx
// src/app/items/page.tsx:420 — current (unbounded tail: index * 20ms)
<div className={`item-row animate-fade-in ${isLowStock ? 'low-stock' : ''}`} data-testid={`item-row-${item.name.toLowerCase()}`} style={{ animationDelay: `${index * 20}ms` }}>
```

Same unbounded pattern: `src/app/history/page.tsx:130` (`index * 20ms`),
`src/app/members/page.tsx:149` and `src/app/household/page.tsx:222`
(`index * 50ms`), `src/app/to-buy/page.tsx:202` (`index * 30ms`, in range but
keep consistent).

## Target

```css
/* target */
.animate-fade-in {
  animation: fadeIn 0.3s ease-out both;
}
```

```css
/* target — new, next to .animate-fade-in */
.animate-fade-in-soft {
  animation: fadeSoftIn 0.15s ease-out both;
}
@keyframes fadeSoftIn {
  from { opacity: 0; }
  to { opacity: 1; }
}
```

- Dashboard cards keep `animate-fade-in` but delays capped: `0,50,100,150,200,250,300,350ms`
  max (rewrite the eight `animationDelay` values in `src/app/home/page.tsx:159-252`).
- List rows (items, to-buy, history, members ×2, categories) switch from
  `animate-fade-in` to `animate-fade-in-soft` (opacity only — rows already move
  via realtime patches; translateY on every visit is decoration).
- Row staggers capped at 80 ms total: replace `` `${index * 20}ms` `` with
  `` `${Math.min(index, 4) * 20}ms` `` (same for the 30 ms and 50 ms variants,
  cap index at 4 and 2 respectively so the tail never exceeds ~80 ms).

## Repo conventions to follow

- Keyframes + utility classes live together in `src/app/globals.css`
  (exemplar: `@keyframes fadeIn` at `:261` + `.animate-fade-in` at `:266`).
- Stagger stays inline via `style={{ animationDelay }}` (exemplar: the
  dashboard cards); only the values change.

## Steps

1. `src/app/globals.css:267`: `forwards` → `both`.
2. `src/app/globals.css`: add `@keyframes fadeSoftIn` + `.animate-fade-in-soft`
   after `.animate-fade-in`.
3. `src/app/home/page.tsx:159-252`: cap the eight delays at `0,50,100,150,200,250,300,350ms`.
4. Items/history/to-buy/members/household/categories rows: class
   `animate-fade-in` → `animate-fade-in-soft`, stagger capped with `Math.min`
   as above.
5. `src/app/globals.css:548-553` reduced-motion block: add
   `.animate-fade-in, .animate-fade-in-soft { animation: fadeSoftIn 0.15s ease-out both; }`
   so movement is dropped but the opacity comprehension aid remains.
   (Full reduced-motion overhaul is plan 004; this line just keeps this plan
   consistent with it.)

## Boundaries

- Do NOT touch `v2-animate-*`, `v2-delay-*`, `useScrollAnimation` — dead code,
  explicitly out of scope (see plans/README.md housekeeping note).
- Do NOT touch `marketing.css` entrances (rarely-seen landing, exempt).
- Do NOT change markup/structure — class names and delay values only.
- Do NOT add new dependencies.
- If a step doesn't match the code you find (drift since the commit stamp), STOP and report instead of improvising.

## Verification

- **Mechanical**: `npm run typecheck` passes; `npm test -- src/__tests__` passes
  (no test asserts animation classes — if one does, update the expected class).
- **Feel check**: open /home, /items (30+ rows), throttle to Fast 3G, and confirm:
  - no card/row is ever visible-then-jumping — each appears once, in cascade order;
  - the last dashboard card is fully visible well under 1 s;
  - rows fade without any vertical drift.
  - In DevTools, set playback to 10% (Animations panel) and confirm each
    element starts hidden (backwards fill working).
- **Done when**: no `animationDelay` above 350 ms in tsx, no list row uses
  `animate-fade-in`, `forwards` no longer appears on that rule.
