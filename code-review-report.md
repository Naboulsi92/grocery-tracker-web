## Code Review: Two-Axis Analysis

---

### Standards

**Findings (7 issues - all baseline smells, judgement calls):**

1. **Duplicated Code** — `usePushSubscriptionSync.ts:39,65`
   - Error message `'Vous devez être connecté.'` appears twice. Extract to a constant.

2. **Speculative Generality** — `usePushSubscriptionSync.ts:7-10`
   - `PushSubscriptionData` interface defined but only used within this single hook.

3. **Feature Envy** — `Hero.tsx:14-32`
   - CTA click handler reaches extensively into `window.plausible`. Consider extracting to a `usePlausibleAnalytics()` hook.

4. **Message Chains** — `Hero.tsx:19-20`
   - Long type-cast chain: `(window as unknown as { plausible?: ... }).plausible(...)`

5. **Dead Links** — `Footer.tsx:12-20`
   - All footer links use `href="#"` - placeholders that should either work or be removed.

6. **Duplicated Data Definitions** — `FAQ.tsx`, `Features.tsx`, `HowItWorks.tsx`
   - Static data arrays defined inline in each component. Could be consolidated.

7. **Potential Stale Closure** — `useHousehold.ts:94`
   - Dependency array includes `options.supabase` - could cause unnecessary re-runs.

---

### Spec

**Missing Requirements (5):**

1. **`next/image` not used** — Spec line 52: "Leverage Next.js built-ins: `next/image` for optimized images"
2. **`next/font` not used** — Spec line 53: "`next/font` for performant typography"
3. **FID performance test missing** — Spec line 105: "FID < 100ms"
4. **Visual regression tests missing** — Spec lines 96-100
5. **Conversion funnel tracking incomplete** — Spec line 57

**Scope Creep (2):**

1. **Dark mode implemented** — Spec line 123: "Dark mode: Not required for initial launch"
2. **Footer links to non-existent pages** — `/about`, `/contact`, `/terms` don't exist

**Implementation Issues (2):**

1. **Plausible analytics** — `PageViewTracker.tsx` calls `plausible('pageview')` manually but Plausible auto-tracks in SPAs. May cause double-counting with Next.js client-side routing.
2. **CTA section missing wrapper id** — In `page.tsx`, CTA is rendered without `<section id="cta">` wrapper like other sections.

---

### Summary

- **Standards**: 7 findings (all judgement calls - no hard violations)
- **Spec**: 9 findings (5 missing, 2 scope creep, 2 implementation issues)

**Worst issues per axis:**
- Standards: Duplicated error message in `usePushSubscriptionSync.ts` (easy fix)
- Spec: Dark mode implemented despite being explicitly out of scope (decision needed)