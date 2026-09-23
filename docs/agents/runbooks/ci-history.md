# CI history (archived)

Moved out of `AGENTS.md` during the refactor — that file must stay free of
dated numbers. Do NOT quote anything below as current; recompute live
(`npx playwright test --list`, `npm test`, `npm run lint`).

## #73 (secrets scan) — CLOSED

`npm run scan:secrets` → "Secret scan passed." (audit 2026-09-19 + local 2026-09-21). Allowlist of fake E2E values in `scripts/scan-secrets.mjs:23-39`, regression test `scripts/scan-secrets.test.mjs:17-23`. E2E literals are all fakes (`src/e2e/error-states.spec.ts:25-26,41-43,58-60,75-76`, `@example.com` / `wrongpassword123` / `Password123!`).

## #74 (8 unit failures) — CLOSED via `b65dee0` + `279f240`

Audit 2026-09-19: 18 suites/104 jest + 5 node = 109, 0 fail. Since #116 `npm test` = `jest --runInBand quality src && node --test scripts/*.test.mjs` covers the 8 orphan suites (`src/lib/__tests__` + `src/hooks/__tests__`): local 2026-09-21 = 30 suites / 358 tests, 0 fail. Guard `npm run test:guard` (`scripts/check-test-count.mjs`, wired in `web-quality.yml`) fails below ≥26 suites / ≥280 tests; `testPathIgnorePatterns` excludes `scripts/` from Jest (`jest.config.mjs`).

## Baselines 2026-09-21 (Windows, warm)

`npm run typecheck` green (exit 0), `npm run scan:secrets` PASS, `npm run lint` (= `eslint src supabase scripts`) 0 errors / 19 warnings in ~14s (cold first run ~158s; unscoped `eslint` takes >120s). Only NEW failures introduced by a branch block it.

## E2E drag saga, #113 / PR #143 (2026-09-22)

Four CI roundtrips (~7 min each) before the green run; each failure had a
distinct mechanical cause, found by parsing the Playwright trace + network log:
1. Drop fired on a stale `over` (no gate) → reorder silently no-ops.
2. Two dnd-kit assertive live regions → strict-mode violation; read live text via `evaluate` instead of a locator.
3. `closestCenter` follows the axis-clamped dragged rect, not the pointer; `.categories-grid` is multi-column with a vertical-axis restriction → horizontal drags can never change `over` (proven by trace mouse coordinates: `x: 101 → 640`, `y` unchanged).
4. Fix: strictly vertical drag + gate the drop on active displacement AND neighbor shift (same commit as `over`).

Lesson distilled in `AGENTS.md` ("Debugging E2E drag tests").
