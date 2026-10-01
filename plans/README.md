# Animation plans

Audit of `c3c57f3` (standard effort, plain-CSS motion, no motion library).
Bar: Emil Kowalski's philosophy per `AUDIT.md`. Plans are self-contained —
an executor needs nothing but the plan file.

## Recommended order

| # | Plan | Severity | Status | Depends on |
|---|---|---|---|---|
| 003 | [transitions-tokens](003-transitions-tokens.md) | MEDIUM | DONE (#178) | — (defines `--ease-out`; 002/005/006 reuse or hardcode+note) |
| 001 | [entrance-cascade](001-entrance-cascade.md) | HIGH | TODO | — (defines `fadeSoftIn`; 004 reuses or defines once) |
| 002 | [press-feedback](002-press-feedback.md) | HIGH | DONE (#178) | 003 for the token (fallback inside) |
| 004 | [reduced-motion](004-reduced-motion.md) | MEDIUM | TODO | 001 for `fadeSoftIn` (fallback inside) |
| 005 | [modal-entrance](005-modal-entrance.md) | MEDIUM | TODO | 003 for the token (fallback inside) |
| 006 | [trigger-micro-motion](006-trigger-micro-motion.md) | LOW | TODO | 003 for the token (fallback inside) |

Execution order ≠ numbering: run 003 first (tokens unblock the rest), then
001 + 002 (highest leverage), then 004, 005, 006.

Reconcile 2026-10-01 (post-#178): 002 + 003 DONE via the redesign (same
tokens/values as spec'd — executors must reuse, not redefine). Bonus: the
ungated-hover finding (no plan) is also fixed (hover lifts gated behind
hover/pointer:fine). Remaining: 001, 004, 005, 006 — all references verified
fresh against 46b1215.

Reconcile 2026-10-01 (post-#185, closes #181): ALL DONE — 001 (#182),
004 (#184), 005 (#183), 006 (#185). Feel-checks on preview via chrome-devtools
+ playwright: mobile menu opens with mkMenuIn from top-center, tokens resolve
in both motion modes, RM path drops movement but keeps feedback (chevron →
opacity-only), normal path keeps full motion. Remaining work is human QA on
authenticated UI (dashboard cascade, modal, qty pop — needs a session).

## Findings rejected at vetting (do NOT re-plan)

- `pulse`/`skeleton-pulse` easing → `linear`: opacity-only pulses using the
  Tailwind-canonical curve; no movement involved. Not a violation in spirit.
- v2 motion durations (0.4–0.6 s), `v2-delay-*`, `useScrollAnimation` 150 ms
  stagger: **dead code** — zero tsx consumers (only the hook's own test
  imports it). Feel impact: none.
- Save badges (`household:210`, `notifications:346`) using keyframes:
  conditional-mount re-announcement is correct by design.
- Missing stagger on the categories nav list: entering at once is crisper —
  correct as-is.

## Housekeeping note (not motion — no plan)

The dead v2 motion system (`v2-animate-*`, `v2-delay-*`, `--v2-transition-*`
tokens consumed only by dead classes, `src/hooks/useScrollAnimation.ts` +
its test) is unused. Removing it is a judgment call for the repo owner
(bundle hygiene, not feel) — deliberately left out of these plans.
