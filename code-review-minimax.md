## Code Review: Two-Axis Analysis - Minimax

---

### Standards

**Findings (3 issues - all baseline smells, judgement calls):**

1. **Indentation Inconsistency** — `src/app/items/page.tsx:90-97`
   - The function body uses 2-space indent here, but the surrounding code uses 4-space. This creates inconsistent formatting within the same file.

2. **Speculative Generality** — `src/components/marketing/Footer.tsx:17-24`
   - Links to non-existent pages (`/about`, `/contact`, `/terms`) added prematurely. The TODO comment acknowledges the pages don't exist yet.

3. **Potential Bug** — `src/hooks/useHousehold.ts:94`
   - Changed from `supabase` to `options.supabase`, but `supabase` is defined earlier in the hook while `options.supabase` may be undefined. This could cause the effect to receive different values than intended.

---

### Spec

**Missing Requirements (4):**

1. **`next/image` not used** — Spec line 52: "Leverage Next.js built-ins: `next/image` for optimized images"
   - No `<Image />` components found in marketing components. All images use emoji or text only.

2. **`next/font` not fully used** — Spec line 53: "`next/font` for performant typography"
   - Only `Inter` imported in layout.tsx, but not applied consistently. Hero, Features, FAQ, HowItWorks, CTA sections don't explicitly use font class.

3. **Visual regression tests missing** — Spec lines 96-100
   - No visual/screenshot regression tests found in the diff.

4. **Page view tracking incomplete** — Spec line 57
   - Plausible script loads but relies on auto-tracking. No explicit `plausible('pageview')` call for Next.js SPA navigation.

**Scope Creep (2):**

1. **Dark mode implemented** — Spec line 123: "Dark mode: Not required for initial launch"
   - Found 31 instances of `dark:` Tailwind classes across all marketing components.

2. **Footer links to non-existent pages** — Footer.tsx links to `/about`, `/contact`, `/terms` which don't exist (noted in TODO comment).

**Implementation Issues (2):**

1. **Plausible analytics with Next.js** — The script uses `strategy="lazyOnload"` but doesn't call `plausible('pageview')` manually. Plausible's auto-tracking may not work correctly with Next.js client-side navigation.

2. **Duplicate analytics components** — Both `ScrollTracker.tsx` and `PageViewTracker.tsx` track scroll depth independently with slightly different implementations.

---

### Summary

- **Standards**: 3 findings (all judgement calls - no hard violations)
- **Spec**: 8 findings (4 missing, 2 scope creep, 2 implementation issues)

**Worst issues per axis:**
- Standards: Potential bug in `useHousehold.ts` dependency array
- Spec: Dark mode implemented despite being explicitly out of scope (decision needed)

---

### Note on Qwen's Response

Qwen accepted and implemented 8 fixes from the previous review. The remaining issues are either:
- Already justified as acceptable trade-offs (e.g., dark mode for UX)
- Low priority (e.g., visual regression tests)
- Intentional placeholders (e.g., footer links with TODO)