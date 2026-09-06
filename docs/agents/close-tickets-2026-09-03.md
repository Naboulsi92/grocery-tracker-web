# Close List — 15 already-implemented tickets

> Status: **BLOCKED** — the GitHub connector has read-only access (`issues: write` scope missing).
> All 15 comment writes returned `403 Resource not accessible by integration`.
> The code was verified present (see `triage-status-2026-09-03.md`); only the GitHub *write* action is blocked.

## How to apply

Pick one:
1. **Manual (fastest):** open each issue in the GitHub UI and close it, pasting the comment below.
2. **Reconnect the connector** with `issues: write` scope, then re-run `/triage` and I'll close them.
3. **Install + auth `gh` CLI** (`gh auth login`), then I can run `gh issue close <n>`.

## The 15 to close

| # | Comment to paste (already-implemented note) |
|---|---|
| 28 | Already implemented — closing. Code lives at `src/app/(marketing)/layout.tsx` and `src/app/(marketing)/page.tsx`. |
| 29 | Already implemented — closing. Code lives at `src/components/marketing/Hero.tsx`. |
| 30 | Already implemented — closing. Code lives at `src/components/marketing/Features.tsx`. |
| 31 | Already implemented — closing. Code lives at `src/components/marketing/HowItWorks.tsx`. |
| 32 | Already implemented — closing. Code lives at `src/components/marketing/FAQ.tsx`. |
| 33 | Already implemented — closing. Code lives at `src/components/marketing/CTA.tsx` + `src/app/(marketing)/page.tsx`. |
| 34 | Already implemented — closing. Code lives at `src/e2e/homepage.spec.ts`. |
| 35 | Already implemented — closing. Code lives at `src/app/(marketing)/layout.tsx`. |
| 19 | Already implemented — closing. Code lives at `src/hooks/useHousehold.ts`. |
| 20 | Already implemented — closing. Code lives at `src/app/home/page.tsx`. |
| 22 | Already implemented — closing. Code lives at `src/hooks/usePushManager.ts`. |
| 23 | Already implemented — closing. Code lives at `src/hooks/usePushSubscriptionSync.ts`. |
| 24 | Already implemented — closing. Code lives at `src/hooks/usePushNotifications.ts`. |
| 25 | Already implemented — closing. Code lives at `src/lib/itemOperations.ts`. |
| 26 | Already implemented — closing. Code lives at `src/app/items/page.tsx`. |

## Keep open

- **#21** (16-03: migrate remaining pages to useHousehold) — `categories/` and `to-buy/` still use inline Supabase; only `items` + `members` migrated. Leave open for an agent to finish.
