<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->

# Grocery Tracker Web - Agent Best Practices

## Deployment & Environment

### Environment variables (Preview, Production, Development)
- Always add new variables (e.g. `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`) to **Preview**, **Production**, AND **Development** in Vercel — missing Preview vars break deployments and block PR reviews.
- Verify in the Vercel dashboard (Settings → Environment Variables) before deploying.
- Changes apply to **new** deployments only — redeploy after changing a value, then smoke-test (`curl` homepage → `HTTP 200`).
- Preview vars can be scoped per branch: `vercel env add <VAR> preview <branch>` (overrides the default preview value).
- Use `.env.local.example` as a template for new contributors.
- Full reference (Vercel/GitHub/Supabase environments, Supabase preview branching, end-to-end flow): `docs/research/github-vercel-supabase-environments.md`

## Git & PR Workflow

### Branch naming
- `feature/<description>` for new features
- `fix/<description>` for bug fixes
- `docs/<description>` for documentation

### Descriptive PRs
- What changed / why / how to test + `Closes #<n>`; screenshots for UI changes.

### Merge procedure
- Canonical: `gh pr merge <n> --squash --delete-branch` (squash keeps main history clean).
- With linked worktrees `gh pr merge` fails (`fatal: 'main' is already used by worktree ...`) — merge via the API instead:
  ```powershell
  gh api repos/<owner>/<repo>/pulls/<n>/merge --method PUT -f merge_method=squash
  gh api repos/<owner>/<repo>/git/refs/heads/<branch> --method DELETE
  ```
- Then remove the local worktree + branch (`git worktree remove ../<goal-slug>`, `git branch -D feature/<goal-slug>`) and fast-forward local main: `git pull --ff-only origin main` (safe alongside unrelated uncommitted changes as long as the merge didn't touch those files).

## Testing

### Verify before pushing
```bash
npm run typecheck    # tsc --noEmit
npm test             # jest --runInBand quality src && node --test scripts/*.test.mjs
npm run lint         # eslint src supabase scripts
npx playwright test  # E2E (Chromium engine; Edge locally, bundled Chromium on CI)
```

### Add tests for new features
- Unit tests for new hooks/components; E2E tests for critical user flows (signup, login, core features); success + error cases; regression tests for bug fixes; keep the suite green.

### Local E2E (Playwright CLI)
- Config (`playwright.config.ts`): `testDir ./src/e2e`, Chromium only, `trace: 'on-first-retry'`, `baseURL` from `E2E_BASE_URL` (default `:3000`).
- Gates (`quality/e2e-environment.ts`): `E2E_ALLOW_WRITES=true` plus local Supabase credentials (`NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `E2E_SUPABASE_URL`, `E2E_SUPABASE_SERVICE_ROLE_KEY`) enable write specs. Without a local backend (no Docker here) only public-page tests run and write specs skip. Remote targets require `E2E_ALLOW_REMOTE=true` + `E2E_TARGET_ENV=test|staging`.
- Parallel sessions: never touch another session's dev `:3000` — start a dedicated server on another port (e.g. 3101) with an ephemeral config pointing `E2E_BASE_URL` at it; delete the config after use.
- `npx playwright test --list` validates collection (parse/imports) without running — use after every new spec.
- CI artifacts: `gh run download <id> --name playwright-report`; inspect `0-trace.trace` (mouse coordinates expose wrong layout assumptions) and `0-trace.network` (prove POST/PATCH persistence calls) with small node scripts. `test-results/` and `playwright-report/` are gitignored.
- Local browsers: Edge only — no Chrome/Chromium here. CLI runs override the channel via an ephemeral `playwright.local-edge.config.ts` (pattern + snippet in the runbook); both MCP servers already launch Edge. CI keeps bundled Chromium.

### Debugging E2E drag tests
- Trace-first, never hypothesis-first: read the library source (`node_modules/@dnd-kit/...`) and the layout CSS (grid vs list, axis restrictions, collision inputs) BEFORE the first push — each CI roundtrip costs ~7 min.
- If the same test fails twice on CI, switch to the `diagnosing-bugs` skill instead of stacking hypotheses (see "Bug diagnosis" under "Agent Workflow").

## Security

### Secrets
- Never commit `.env.local` (gitignored) — only `.env.local.example` with placeholder values.
- `NEXT_PUBLIC_*` only for truly public values; never expose service-role keys or secrets; validate environment variables at startup; never print secret values (Supabase secret values are write-only — regenerate if lost).

### Supabase Row Level Security (RLS)
- Always test RLS policies with different user roles; users must only access their own household data; review policies when adding new tables.

## Monitoring & CI

### CI signal
- Tests run on every PR; merges are blocked on failure.
- SQL changes are verified by the CI database job (`psql -v ON_ERROR_STOP=1 -f supabase/tests/database/security_contract.sql`) — a green database job means the security contract passes. Docker is NOT available locally.
- History & baselines live in `docs/agents/runbooks/ci-history.md` (closed items, dated numbers). Recompute counts live; never quote archived numbers as current and never attribute old numbers to new branches. Only NEW failures introduced by a branch block it.
- #75 (E2E auth harness) is an ACTIVE WORK SITE, not an accepted failure: no reusable session (`storageState`), each spec signs up via UI against local Supabase, and without a backend the suite skips instead of testing. Target state per `audit-testing.md`: `authenticatedPage` fixture + `storageState` reuse, fail (not skip) when a write-spec lacks a backend, replace `waitForTimeout` with web-first assertions.

### Checking CI runs
```bash
gh run list --limit 5
gh run view <run-id> --log-failed
```
- Don't block turns on `gh run watch`; prefer a bounded `Start-Sleep` + single `gh run view ... --json conclusion,jobs` status check.

### Vercel deployments
- Share Preview URLs for team review; test on real devices before merging; check deployment logs for errors.
- After merging: verify the Production deployment for the merge commit is READY, smoke-test the live site (`HTTP 200`), check runtime errors.
- Env-var changes need a redeploy; prefer `vercel redeploy <url>` over `vercel --prod` when the tree is dirty (see "Vercel CLI" under "Tooling Reference").

### Production monitoring
- Watch Vercel deployment status and Supabase API usage; set up alerts for critical failures.

## Code Quality

### TypeScript first
- Strict mode (already enabled ✅); avoid `any` — use proper types; define interfaces for API responses and database rows.

### Component structure
- Keep components small and focused; extract custom hooks for reusable logic; use composition over prop drilling.

### Error handling
- Handle Supabase errors gracefully; show user-friendly error messages; log errors for debugging (but not secrets!).

### Code comments
- Comment complex logic; explain "why" not just "what"; update comments when refactoring.

## Documentation

### Keep README.md updated
- Local development setup steps; environment variable requirements; how to run tests; deployment process.

### Document new features
- Add to `CONTEXT.md` if they affect the domain model; update API documentation if endpoints change; add ADRs for major architectural decisions.

## Agent Workflow

### Worktree isolation
- Before any work, create a dedicated worktree: `git worktree add ../<goal-slug> -b feature/<goal-slug>` (from the repo root). All workers edit and verify INSIDE that worktree (absolute paths + bash `workdir`). Workers commit each completed step to the branch. This keeps parallel goal sessions from interfering with each other.

### Implement
- Load the `implement` skill when building from a spec or tickets. Work on the goal branch inside its worktree: TDD, regular `typecheck`. Split large work by files/modules into parallel sub-agents. Do NOT run the full suite yet — committing comes first (next step).

### Commit the implementation (standalone step)
- Commit the implementation BEFORE running the full suite: the commit is a checkpoint, not a certification. If tests reveal a mess, a committed tree lets you `diff`, `stash`, or reset cleanly.
- Keep implementation (`feat:`) and test-fix (`fix:`) commits separate, so reviewers can tell feature work apart from test-driven fixes.
- Never push red — push only when green. Squash-merge keeps `main` clean regardless of intermediate granularity.

### Verify: tests first (blocking gate before review)
- After committing the implementation, run the FULL verification suite and require it GREEN before requesting any code review:
  ```bash
  npm run typecheck    # tsc --noEmit
  npm test             # jest --runInBand quality src && node --test scripts/*.test.mjs
  npm run lint         # eslint src supabase scripts
npx playwright test  # E2E (Chromium engine; Edge locally, bundled Chromium on CI)
  ```
- No review on red. If anything fails, enter the `diagnosing-bugs` loop: reproduce → diagnose evidence-first → fix → commit each fix separately → re-run the FULL suite (not just the failing test) until everything is green. Never "fix forward" inside the review.
- For new E2E specs, validate collection first (`npx playwright test --list`), then run the affected specs locally when a backend or public-page path allows it; otherwise CI is the signal — but a red CI still routes back through `diagnosing-bugs`, never straight to review.

### Code review
- Request a review ONLY on a green tree (typecheck + tests + lint all passing — see "Verify: tests first" above). Invoke the `code-review` skill with full arguments up front: fixed point (`origin/main`, three-dot diff `git diff origin/main...HEAD`), the goal worktree as bash `workdir`, the spec (issue via `gh issue view`, PRD section refs). Bare invocations stall on clarification questions and a typo in the ref kills the run.
- Review = read-only: never modify files, commit, or create tickets during review. Fixes require an explicit user go-ahead.
- Two axes, Standards + Spec, run in parallel sub-agents; verdicts are per axis (`APPROVED` or a findings list), no damping. Both axes must approve the final HEAD before merge; a re-review after fixes covers the new commits.
- Triage findings as accept (fix) or deny (PR comment with `file:line` evidence). Pre-existing-on-main items are denials, not fixes. Post the exchange as a PR comment; reviewers concede incorrect claims.

### Bug diagnosis
- Phase 1 = build a tight local feedback loop (repro) BEFORE any hypothesis; evidence-first, never theory without a repro. Load the `diagnosing-bugs` skill for stubborn bugs. If a bug surfaces during review, trace it in a GitHub bug ticket BEFORE fixing it, then fix.
- Lesson (#113 drag saga): theorizing from CI artifacts cost 4 roundtrips (~7 min each) — switch to this skill at the 2nd CI failure on the same test.

### Merge & cleanup
- After both axes approve: merge (see "Merge procedure"), remove the worktree + branch, verify auto-close (`gh issue view <n> --json state,stateReason`), verify Vercel READY + smoke test. File follow-ups only for PRE-EXISTING CI failures — don't fix them in the same PR unless they're yours.

### Issue tracker
- GitHub Issues for tracking work; link PRs to issues; workflow in `docs/agents/issue-tracker.md`.

## Tooling Reference

### Agent skills location
- Skills resolve by name via the `skill` tool from two scopes: global (`~/.agents/skills/`) and repo-local (`.agents/skills/`). Never hardcode a scope, and never install the same upstream skill twice — `agent/skills/` was removed 2026-09-23 as a byte-identical duplicate of the same `supabase/agent-skills` release.

### CLI & MCP command reference
- Full command reference lives in `docs/agents/runbooks/cli-reference.md` (GitHub CLI, Supabase MCP + CLI, Context7, Vercel CLI, Playwright and chrome-devtools MCP).
- `.playwright-mcp/` logs are not gitignored: do NOT commit them.

## Common Pitfalls to Avoid

- ❌ Don't commit `.env.local` with real credentials
- ❌ Don't merge without running tests first
- ❌ Don't request a code review unless typecheck + tests + lint are green
- ❌ Don't merge unless both Standards and Spec review axes approved
- ❌ Don't add environment variables to only Production (add to Preview too!)
- ❌ Don't leave feature branches active after merge
- ❌ Don't use `any` in TypeScript without justification
- ❌ Don't hardcode API keys or secrets
- ❌ Don't skip error handling for Supabase operations
- ❌ Don't forget to update tests when changing behavior

## Pre-Deployment Checklist

Before merging a PR:
- [ ] All tests pass (unit + E2E)
- [ ] Typecheck passes
- [ ] Linting passes
- [ ] Both Standards and Spec review axes approved
- [ ] Manual testing on local dev server
- [ ] Environment variables configured for Preview (if new variables added)
- [ ] PR description is clear and links to issues
- [ ] No console errors or warnings
- [ ] Responsive design tested (mobile, tablet, desktop)

After merging:
- [ ] Verify Production deployment succeeds in Vercel
- [ ] Test live site functionality
- [ ] Delete feature branch
- [ ] Close linked issues
