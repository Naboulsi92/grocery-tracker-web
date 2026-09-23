# CLI & MCP command reference

Moved out of `AGENTS.md` (refactor: that file references this runbook instead).
Command syntax drifts with tool versions — when in doubt, check
`<tool> --help` or the current upstream docs rather than trusting this page.

## Local browsers: Edge only

This machine has Microsoft Edge and NO Chrome/Chromium — never run
`npx playwright install` locally (a stale bundled-Chromium cache may exist
under `%LOCALAPPDATA%\ms-playwright`; ignore it). CI keeps using bundled
Chromium (`npx playwright install --with-deps chromium` in the workflows).

### Playwright CLI: Edge via ephemeral config

The committed `playwright.config.ts` targets the `chromium` project (CI).
Locally, override the channel with an ephemeral config (same pattern as the
dedicated-port override — create, use, delete after the run; collection
verified via `npx playwright test --list --config <file>`):

```ts
// playwright.local-edge.config.ts — EPHEMERAL, delete after use
import { defineConfig, devices } from '@playwright/test';
import baseConfig from './playwright.config';

export default defineConfig({
  ...baseConfig,
  webServer: undefined, // bring your own server on the E2E_BASE_URL port
  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'], channel: 'msedge' } }],
});
```

```powershell
$env:E2E_BASE_URL = 'http://127.0.0.1:3101'  # your dedicated dev server
npx playwright test --config playwright.local-edge.config.ts src/e2e/i18n.spec.ts
Remove-Item playwright.local-edge.config.ts
```

`browserName` stays `'chromium'` with the `msedge` channel, so the
`test.skip(browserName !== 'chromium', ...)` guards in the specs keep working.

### MCP servers: already Edge

The global `opencode.json` launches both MCP servers on Edge — do not change:
- Playwright MCP: `@playwright/mcp --browser msedge --isolated`
- chrome-devtools MCP: `--executablePath=<Edge install path>\msedge.exe --isolated`

## GitHub CLI (`gh`)

```bash
# Issues
gh issue list --limit 20
gh issue view <number> --json title,body,labels
gh issue create --title "..." --body "..."
gh issue close <number> --reason completed
gh issue comment <number> --body "..."

# PRs
gh pr create --title "..." --body "..."
gh pr view <number> --json title,body,state
gh pr merge <number> --squash --delete-branch
gh pr list --state open
```

Note: with linked worktrees `gh pr merge` fails
(`fatal: 'main' is already used by worktree ...`) — merge via the API
instead (see "Merge procedure" in `AGENTS.md`).

## Supabase MCP + CLI

- MCP for database work on remote projects: `supabase_list_tables` (inspect schema), `supabase_execute_sql` (queries), `supabase_apply_migration` (DDL on linked project), `supabase_list_migrations`, `supabase_get_advisors` (security/performance), `supabase_generate_typescript_types`. Never read server-side files or run OS commands via SQL.
- CLI (installed globally `npm i -g supabase`; complements MCP, do NOT remove MCP) for Edge Functions deploys/secrets — prod project ref `oizfmmnuoqkdqkguynfv` (linked via `supabase link --project-ref <ref>`, auth via `supabase login`):
  ```powershell
  supabase projects list                                        # verify auth + linkage (● = linked)
  supabase functions deploy <name> --no-verify-jwt --use-api --project-ref <ref>  # --use-api avoids Docker; --no-verify-jwt required for cron callers (else 403 before x-cron-secret check)
  supabase secrets set KEY=value --project-ref <ref>           # or --env-file <file>; NO redeploy needed after (live immediately)
  supabase secrets list --project-ref <ref>                    # names + digests only — values are write-only, regenerate if lost
  ```
- Cron-function triage: `POST` without `x-cron-secret` → `401 {"error":"Unauthorized"}` = deployed + fail-closed OK; `404 NOT_FOUND` = function not deployed OR wrong `SUPABASE_URL`; enqueue `200` + process `500` on notify-thresholds = `VAPID_*` secrets missing (`getEnv` throw). Generate VAPID via temp script + `--env-file`, then delete the file; only the public key is shareable (`NEXT_PUBLIC_VAPID_PUBLIC_KEY` → Vercel ×3 envs + `.env.local`).

## Context7

- Always call `context7_resolve-library-id` first, then `context7_query-docs` with specific questions. Use for Next.js, Supabase, Vercel, React, Tailwind, etc. Don't rely on training data for API syntax.

## Vercel CLI

- Already authenticated as `naboulsi92`, project `grocery-tracker-web` linked via `.vercel/project.json`:
  ```powershell
  vercel env ls                                            # audit vars per environment
  vercel env add NAME preview --value "<v>" --yes          # non-interactive; repeat for preview/production/development (piped stdin also works but preview prompts for Git branch)
  vercel ls --prod                                         # latest production deployment URL (top row)
  vercel redeploy <prod-deployment-url>                    # rebuild existing deployment with current env vars — PREFER over `vercel --prod` when the local tree is dirty (avoids shipping uncommitted WIP)
  ```

## Browser & DevTools MCP

- `playwright_browser_*`: interactive exploration and quick checks against local dev (`snapshot`, `click`, `type`, `evaluate`, `network_requests`, `console_messages`). Logs land in `.playwright-mcp/` (not gitignored: do NOT commit). Prefer the CLI for full suites, shards, and CI parity.
- `chrome-devtools_*`: deep inspection without writing scripts — `take_snapshot` (prefer over screenshots for acting), `list_console_messages`, `list_network_requests`, `lighthouse_audit`, `performance_start/stop_trace`, `evaluate_script`, `navigate_page`.
