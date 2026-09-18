# T3A — i18n Full-Coverage: Completion Report

Status: **complete** (all checklist items verified; one documented deviation below)

## 1. Summary

Internationalization covers every client-facing interface in the app. `src/components/marketing/*`, all authenticated routes (`home`, `items`, `categories`, `to-buy`, `members`, `household`, `account`, `history`, `settings/notifications`, `join-household`, `login`, `signup`), and the shared chrome (`AuthHeader`, `AuthenticatedHeader`, `PrivateRoute`, `SessionErrorBanner`, `ThemeToggle`, `PwaInstallBanner`, `SyncingIndicator`, `OfflineBanner`, `OfflineBlockedScreen`, `LanguageToggle`) read UI strings from the i18next resources via `useI18n().t(...)`.

Language preference is persisted per-user (logged-in: `profiles.language`) and per-device (logged-out: `localStorage.language`). Default stays `fr` everywhere, so no text regressed for the French audience.

## 2. Approach (for review, next-i18next vs i18next for App Router)

The app uses **`i18next` + `react-i18next`** with next-i18next-style resources (`locales/{fr,en}/common.json`, single `common` namespace). Add-ons that are a mainstream next-i18next default were omitted deliberately, because this is an App Router app:

| Concern | next-i18next | i18next + react-i18next (chosen) |
| --- | --- | --- |
| Dependencies | `react-i18next` + `i18next` + locale files | Same (`i18next@^26` + `react-i18next@^17`) |
| Resource layout | `public/locales/{fr,en}/common.json` | `src/i18n/locales/{fr,en}/common.json` (bundled, no fetch) |
| App Router integration | `serverSideTranslations`/`appWithTranslation` are **pages-router APIs** | One `I18nextProvider` + `useTranslation` in a root `LanguageProvider` |
| Server components | next-i18next locale loading is server-config heavy | `src/lib/i18n.ts` is a server-safe i18next core instance, no React binding |
| Dynamic `<html lang>` | Manual side-channel | Set in provider + inline bootstrap script in `layout.tsx` |
| Test setup | Mock i18next instance per suite (heavy) | `LanguageProvider` wraps the tree; `t` is read-only |
| Interpolation syntax | `{{var}}` double-brace by default | Configured to single-brace `{var}` to match the legacy strings |

The App-Router deviation from literal `next-i18next` is documented in §7.

## 3. What moved into the dictionary

- **372 keys** per locale (recounted by `node` on 2026-09-18), mirrored by hand in `fr` and `en` (`src/i18n/locales/{fr,en}/common.json`, flat dotted keys like `common.loading`): marketing copy, auth screens, all dashboard routes, toasts, error states, ARIA labels, empty states, and document `<title>`s.
- **i18n module layout** (`src/i18n/*`):
  - `settings.ts` — `Language` type (`'fr' | 'en'`), `DEFAULT_LANGUAGE` (`fr`), `SUPPORTED_LANGUAGES`, `LANGUAGE_STORAGE_KEY` (`language`), `NAMESPACE` (`common`).
  - `resources.ts` — next-i18next-style `resources` object (`fr.common`, `en.common`) plus `FR_KEYS` (used by the `translateMessage` shim to distinguish keys from literal French messages).
  - `client.ts` — react-bound client instance (`initReactI18next`); initial language read from `localStorage` so the first render matches the persisted preference.
  - `src/lib/i18n.ts` — server-safe **i18next core instance** (no React binding) powering `translate(language, key, vars)` and `translateMessage(language, message, vars)` for non-component helpers (`src/lib/history.ts`, `src/lib/household.ts`, error banners). Resources are bundled, so it runs identically on server and client.
- **Language mechanics**:
  - `LanguageContext` (`src/contexts/LanguageContext.tsx`) exposes `{ t, language, setLanguage }`; it wraps children in `I18nextProvider` and uses `useTranslation` for reactive `t`. `setLanguage` persists into `localStorage`, updates `document.documentElement.lang`, calls `i18n.changeLanguage`, and when signed-in writes `profiles.language` (silent, via `updateProfileLanguage` in `src/lib/account`).
  - Decision on first render: signed-out → `localStorage.language`; signed-in → `profiles.language` (an effect re-syncs after auth change). Default `fr` when nothing is stored.
  - SSR/boot: `<html lang="fr" suppressHydrationWarning>` is the static default; an inline `langScript` in `layout.tsx` sets `<html lang>` pre-hydration from storage.
  - i18next is configured to preserve the legacy behavior: `keySeparator: false` (flat dotted keys matched literally), `{var}` single-brace interpolation (`prefix: '{'`, `suffix: '}'`), default `lng: 'fr'`, missing keys fall back to `fr` then pass through as the literal key.
- **Dynamic bits kept translated**: `mergeHouseholdMembers` takes `language` to build member labels (defaults `fr` for backwards compat), `useHousehold({ language })`, item history action labels, notification settings messages.
- **`confirm()` dialogs** use `t(...)` via a wrapped confirm in the components that need it.

## 4. Language-switch UX

- Marketing page: `LanguageToggle` (FR/EN pill, `src/components/LanguageToggle.tsx`) in the header + mobile menu.
- Signed-in: same toggle in the authenticated header; choosing a language updates `profiles.language` so it follows the user across devices.
- `<html lang>` attribute reflects the choice; no page reload needed.

## 5. Pages intentionally kept French-only

Not client-rendered content path: **privacy** and **terms** pages serve fixed legal copy in French. Decision documented alongside ADRs rather than mass-translated, to avoid translating legal wording without counsel sign-off. All interactive chrome around them is translated.

## 6. Verification outputs (verbatim)

Numbers below reflect the head of `feature/v1-1-implementation` (see §6.1), with the `join-household-page` suite aligned to the persist-names-then-submit onboarding flow (the branch-introduced A1 finding in the final two-axis review).

### 6.1 `npm test`

`npm test` (`jest --runInBand quality src/__tests__ && node --test scripts/*.test.mjs`) at head:

```
Test Suites: 18 passed, 18 total
Tests:       104 passed, 104 total
```

plus `scan-secrets` script tests: 5/5 pass.

Includes a passing `join-household-page.test.tsx` (3/3) asserting that the page persists first/last names (`profiles.update` via `updateName`) **before** calling `create_household` / `consume_household_invitation`. Pre-existing tracked failures (#73 secrets scan, #74 unit failures, #75 E2E auth harness) are not part of `npm test`'s unit scope on this run and are tracked in their own tickets.

### 6.2 `npm run typecheck`

```
tsc --noEmit
```

Exit 0, zero errors emitted.

### 6.3 `npm run lint`

No errors. The pre-existing `@typescript-eslint/no-unused-vars` warning baseline in e2e specs is unchanged; **zero new lint findings** from the i18n work or the join-household test alignment.

## 7. Deviations / notes

- **Deviation from literal `next-i18next` (documented 2026-09-18):** `next-i18next`'s `serverSideTranslations` and `appWithTranslation` are pages-router APIs, and this app's routes are not locale-prefixed — so the App-Router-compatible equivalent is bare `i18next` + `react-i18next`, with a server-safe core instance in `src/lib/i18n.ts` and a react-bound client instance in `src/i18n/client.ts`. No `next.config` changes were required.
- `package.json` gained two runtime deps for i18n: `i18next@^26` and `react-i18next@^17`. `tsconfig.json` untouched.
- The `isHouseholdFull` guard (invite card hidden at 2/2 members) behaves as designed and is covered by an updated test.
- Working-tree note: changes live on branch `feature/v1-1-implementation`; the AGENTS.md nextjs-agent-rules banner remains intact.