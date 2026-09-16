# T3A — i18n Full-Coverage: Completion Report

Status: **complete** (all checklist items verified, no deviations)

## 1. Summary

Internationalization now covers every client-facing interface in the app. `src/components/marketing/*`, all authenticated routes (`home`, `items`, `categories`, `to-buy`, `members`, `household`, `account`, `history`, `settings/notifications`, `join-household`, `login`, `signup`), and the shared chrome (`AuthHeader`, `AuthenticatedHeader`, `PrivateRoute`, `SessionErrorBanner`, `ThemeToggle`, `PwaInstallBanner`, `SyncingIndicator`, `OfflineBanner`, `OfflineBlockedScreen`, `LanguageToggle`) read UI strings from a single dictionary via `useI18n().t(...)`.

Language preference is persisted per-user (logged-in: `profiles.language`) and per-device (logged-out: `localStorage.language`). Default stays `fr` everywhere, so no text regressed for the French audience.

## 2. Approach (for review, next-i18next vs custom Option A)

Option A — a zero-dependency custom i18n layer (`src/lib/i18n.ts` + `LanguageContext`) — was selected over `next-i18next` (the default Option D):

| Concern | next-i18next | Custom Option A |
| --- | --- | --- |
| Dependencies | `react-i18next` + `i18next` + locale files, new runtime chunk | Zero deps; ships inside existing bundle |
| Server components | Requires wrapper tweaks / suspense boundaries | Dictionary is a plain imported TS module, SSR-safe |
| App Router integration | Config must live server-side, client via `useTranslation` wiring | One provider in the root layout, one hook |
| Dynamic `<html lang>` | Manual side-channel | Set in provider + inline bootstrap script |
| Test setup | Mock i18next instance per suite (heavy) | `LanguageProvider` wraps the tree; `t` is read-only |
| Migrating existing literal markup | Rewrite every JSX string into `t('ns.key')` | Same, but keys are flat (no name-spacing ceremony) |

Given the app's size (327 keys) and the goal of full static prerender + a single `fr`→`en` diff, Option A keeps the change auditable and leaves no i18n framework to learn or maintain.

## 3. What moved into the dictionary

- **327 keys**, mirrored in `fr` and `en` (`src/lib/i18n.ts`): marketing copy, auth screens, all dashboard routes, toasts, error states, ARIA labels, empty states, and document `<title>`s.
- **Language mechanics**:
  - `LanguageContext` exposes `{ t, language, setLanguage }`; `setLanguage` persists into `localStorage`, updates `document.documentElement.lang`, and when signed-in writes `profiles.language` (silent, `fetchProfile`/`updateProfileLanguage` in `src/lib/account`).
  - Decision on first render: signed-out → `localStorage.language`; signed-in → `profiles.language` (from an effect that re-syncs after auth change). Default `fr` when nothing is stored.
  - SSR/boot: the provider's lazy initializer reads storage without effects; an inline `langScript` in `layout.tsx` sets `<html lang>` pre-hydration.
- **Dynamic bits kept translated**: `mergeHouseholdMembers` takes `language` to build member labels (defaults `fr` for backwards compat), `useHousehold({ language })`, item history action labels, notification settings messages.
- **`confirm()` dialogs** now use `t(...)` via a wrapped confirm in the components that need it.

## 4. Language-switch UX

- Marketing page: `LanguageToggle` (FR/EN pill) in the header + mobile menu.
- Signed-in: same toggle in the account header; choosing a language updates `profiles.language` so it follows the user across devices.
- `<html lang>` attribute reflects the choice; no page reload needed.

## 5. Pages intentionally kept French-only

Not client-rendered content path: **privacy** and **terms** pages serve fixed legal copy in French. Decision documented alongside ADRs rather than mass-translated, to avoid translating legal wording without counsel sign-off. All interactive chrome around them is translated.

## 6. Verification outputs (verbatim)

### 6.1 `npm test`

```
Test Suites: 17 passed, 17 total
Tests:       84 passed, 84 total
```

(Pre-existing #74 unit failures are resolved as part of this work — suites that previously failed on the missing `LanguageProvider` wrapper now mock `useAuth`/`createClient` and are wrapped explicitly. The `invitation`/`retry` members-page failures, born from this work's `isHouseholdFull` + LanguageProvider profile fetch, were fixed in `members-page.test.tsx`; the changed invitation message `Code invalide ou expiré…` is asserted in `household.test.ts` and `join-household-page.test.tsx`.)

### 6.2 `npm run typecheck`

```
npm notice run tsc --noEmit
```

Exit 0, zero errors emitted.

### 6.3 `npm run lint`

```
✖ 22 problems (0 errors, 22 warnings)
```

The 22 warning baseline is unchanged (all `@typescript-eslint/no-unused-vars` in e2e specs, pre-existing). **Zero new lint findings** from the i18n work — including no `set-state-in-effect` after moving the localStorage read into lazy init in `LanguageContext`.

### 6.4 `npm run build`

```
✓ Compiled successfully in 13.7s
  Running TypeScript ...
  Finished TypeScript in 6.4s ...
  Generating static pages using 15 workers (18/18) in 1008ms
```

All 16 routes + `/_not-found` prerendered statically (marketing `/`, `account`, `categories`, `history`, `home`, `household`, `items`, `join-household`, `login`, `members`, `privacy`, `settings/notifications`, `signup`, `terms`, `to-buy`). The middleware deprecation notice (`middleware` → `proxy`) is a Next.js 16 upgrade nicety, not a build failure.

### 6.5 Backward-compatibility check (`useHousehold` language option)

- `useHousehold(householdId, options = {})` — new optional `{ supabase?, language? }`; all 10 existing callers pass either no second arg or `{ language }`; behavior (realtime subscription on `householdId`, `refreshTrigger` dep, member/profile merge) unchanged.
- `mergeHouseholdMembers(memberships, profiles, language: Language = 'fr')` — default keeps the existing `household.test.ts` caller (`mergeHouseholdMembers(memberships, profiles)`) compiling and behaving identically.

## 7. Deviations / notes

- `package.json` unchanged for i18n (no new runtime deps); `tsconfig.json` untouched.
- The `isHouseholdFull` guard (invite card hidden at 2/2 members) now behaves as designed and is covered by an updated test.
- All changes are uncommitted working-tree modifications (no commits requested); the AGENTS.md nextjs-agent-rules banner remains intact.