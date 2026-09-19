# Grocery List V1 — Build Spec

Source: `grocery-list-prd.md` (v1.1) + grill-with-docs session
Status: Ready for `/to-tickets`

---

## 1. Scope Summary

A PWA for couples (strictly 2 members per household) to manage shared grocery inventory with real-time sync, offline read-only mode, and push notifications. PRD v1.1 is the single source of truth; this spec resolves ambiguities identified during grilling.

---

## 2. Resolved Design Decisions

| Area | Decision | Rationale |
|------|----------|-----------|
| Default categories | 10 seeded (Fruits, Légumes, Produits laitiers, Viandes et poissons, Féculents, Épicerie, Boissons, Surgelés, Hygiène, Entretien) | Bilingual SQL seed, immutable name/existence, reorderable |
| Default items | 10 seeded (Lait, Pain, Œufs, Tomates, Pommes, Poulet, Pâtes, Café, Eau, Papier toilette) | Pre-assigned to matching default categories; template_id is indicative only, no functional effect |
| Fork scope | None (fork-on-modify removed) | Default categories are fully immutable (ADR-0004); items seed once at household creation and never "forks" (C9) |
| Invite code | Random 8-char alphanumeric, SHA-256 hash in DB, 24h expiry, 5-attempt lockout | Token shown once, regeneration requires confirmation (ADR-0002) |
| History | Actor + action type + item name + relative timestamp. 20-entry cap via DB trigger (ADR-0005) | No before/after values. No purchase logging |
| Concurrent edits | Silent last-write-wins (ADR-0006) | No conflict UI in V1 |
| Offline queue | IndexedDB persistence, exponential backoff retry (1s→30s), "Syncing..." indicator (ADR-0007) | Survives page refresh. Micro-coupures handled by queue |
| Offline reconnection | Silent background fetch replaces cached state | Full reload from DB, not relying on Realtime stream to catch up |
| Notifications | Push (Web Push API) + OS badge count. No email | One notification per threshold crossing, only to the non-acting member |
| Household name | Auto-generated server-side: "Foyer {creator_last_name}" | Editable at any time |
| Account deletion | Soft-delete + 7-day cron for permanent removal | User can cancel by logging in within 7 days |
| Category management | Separate `/categories` screen with drag-and-drop reorder | Custom categories: create, edit, delete (blocked if non-empty) |
| Password policy | 8+ characters, no complexity rules | Simple, user-friendly |
| Dark mode | Follow OS `prefers-color-scheme`, user can override | |
| PWA install | Custom banner on 2nd visit, reappears after 2 dismissed visits | Dismissable, non-intrusive |
| i18n | Full coverage: UI, errors, validation, seed names in fr/en | next-i18next |
| Data retention | Indefinite — household persists with 1 member | Cascade-delete only when 0 members remain |

---

## 3. Database Schema (unchanged from PRD §5)

Tables: `HOUSEHOLDS`, `USERS`, `CATEGORIES`, `ITEMS`, `HISTORY`, `CATEGORY_POSITIONS`

Key constraints:
- `ITEMS.household_id + name`: unique, case-insensitive
- `CATEGORIES.household_id + name`: unique, case-insensitive (custom only)
- `ON DELETE RESTRICT` on category deletion when items exist
- `ON DELETE CASCADE` when household becomes orphaned (0 members)

Seed data (SQL migration):
- 10 default categories with bilingual names (fr/en)
- 10 default items pre-assigned to categories with bilingual names

---

## 4. Screens (from PRD §6, clarified)

| Screen | Access | Key behaviors |
|--------|--------|---------------|
| Marketing home | `/` | Public, PWA install banner (2nd visit) |
| Sign in / Sign up | `/auth` | Email+password, Google, Apple. Password: 8+ chars |
| Onboarding | `/onboarding` | First/last name → create household (auto-named) or join via code/QR |
| Inventory (home) | `/home` | Articles by category, ±/manual quantity, links to to-buy/history/settings |
| To-buy list | `/to-buy` | Items ≤ threshold. Check off only when qty > threshold. Persists until screen exit |
| Add item | `/items/new` | Name, category (with inline create), unit, qty, threshold |
| Edit item | `/items/[id]` | Rename, change category/unit/threshold, delete with confirmation |
| History | `/history` | Last 20 actions (modifications + deletions only) |
| Categories | `/categories` | Drag-and-drop reorder, create/edit/delete custom categories |
| Invite / share | `/household/invite` | Show QR + code (once), regenerate with confirmation. "Foyer complet" when 2/2 |
| Household settings | `/household` | Household name, members list, invite code, leave household |
| Account settings | `/account` | Name, password (email accounts), language, dark mode, logout, delete account |
| Notifications settings | `/settings/notifications` | Push toggle, badge toggle, daily reminder time |
| Guide & FAQ | `/guide` | 4-step walkthrough, FAQ accordion |

---

## 5. Validation Rules (transverse)

- All name fields: ≥1 letter, ≤50 chars
- Item name: unique within household (case-insensitive), seeded defaults included
- Custom category name: unique within household (case-insensitive)
- Quantity/threshold: non-negative integers, no decimals
- Threshold: mandatory, strictly > 0
- Unit change: clears quantity and threshold
- All deletions: explicit confirmation dialog
- Invite code: 5-attempt lockout, 24h expiry

---

## 6. Testing Strategy (from PRD §8)

- **Framework**: Playwright (multi-context for real-time sync tests)
- **Convention**: `data-testid` attributes in `zone-element-action` kebab-case
- **Test accounts**: 3 seeded via Supabase admin API (`email_confirm: true`)
  - `e2e.household1.userA@e2e.grocerylist.test`
  - `e2e.household1.userB@e2e.grocerylist.test`
  - `e2e.household2.userA@e2e.grocerylist.test`
- **P0 scenarios**: Real-time sync, one-way notification, unique notification per crossing, equal rights, fork isolation, full household rejection
- **P1 scenarios**: Validation, unit change, household lifecycle, history rotation, offline read-only, invite lockout

---

## 7. Out of Scope (V1)

- Search in inventory
- Offline write mode
- Email notification summaries
- Photos/icons on items
- >2 members per household
- Optimistic locking / conflict merging
- Native Android app (post-validation)

---

## 8. Next Step

This spec is ready for `/to-tickets` — breaking into tracer-bullet tickets with blocking edges for implementation.
