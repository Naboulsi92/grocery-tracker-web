# Grocery Tracker Domain Model

## Core Concepts

### Household
A shared space where multiple users collaborate on grocery management. Each user belongs to exactly one household at a time. All data (items, categories, units, invitations) is scoped to a household.

### Inventory Item
A product tracked in the household's inventory. Items have:
- Name
- Quantity (current stock level)
- Unit of measurement
- Category
- Low-stock threshold

### Category
A grouping for inventory items. Categories help organize items and are ordered for display. Each household has its own set of categories.

### Unit
A measurement unit (e.g., "pieces", "kg", "liters") used to quantify items. Units are shared across all items in a household.

### To-Buy List
Items that have fallen below their low-stock threshold. The system automatically identifies these items based on current inventory levels.

### Invitation
A mechanism for adding new members to a household. Invitations have:
- Token (unique identifier)
- Expiration time
- Status (pending, accepted, revoked, expired)

- A household has AT MOST ONE live invitation. Creating a new invitation RETIRES the previous live one (sets `revoked_at`).
- `revoke_household_invitation(id)` returns `true` ONLY when it revoked a live invitation (1 row updated); returns `false` for any no-op (already revoked, already consumed, or caller is not the owner). Tests assert `false` for no-op revokes.
- `consume_household_invitation(token)` raises `23505` (unique_violation) if the caller is already a household member, and `22023` for retired / revoked / expired / unknown tokens.
- Tokens are stored as `sha256(token_hash)`; the raw token is returned once at creation.
- Token-invalid probes must run as a NON-member user — as a member, the `23505` membership guard fires before token validation, making `22023` handlers unreachable.

### Member
A user who belongs to a household. Members can:
- View and edit inventory
- Manage categories and units
- Send invitations (if they have permission)
- Receive push notifications

## Realtime Updates

The system uses Supabase Realtime to keep data synchronized across clients. When data changes in the database (INSERT, UPDATE, DELETE), all connected clients automatically receive updates and refresh their views.

### Debounce Pattern
To prevent excessive reloads during rapid database changes, Realtime events are debounced (300ms default). Multiple changes within the debounce window trigger a single reload.

### Race Condition Prevention
Each data load is assigned a unique request ID. Only responses matching the current request ID are processed, preventing stale data from overwriting newer data.

## Push Notifications

Users can opt-in to receive push notifications for inventory changes. Notifications are delivered when:
- An item's quantity changes
- An item falls below its low-stock threshold
- A new item is added to the to-buy list

## Security Contract Test

`supabase/tests/database/security_contract.sql` is the RLS/function contract test, run by the CI database job (`psql -v ON_ERROR_STOP=1`). It cannot be run locally (no Supabase CLI/Docker).

- psql `\gset` + `set_config`/`current_setting` GUC pattern, transaction-local (`true` arg); the whole file runs inside BEGIN...ROLLBACK.
- Role switching via `set_config('request.jwt.claim.sub', ...)` + `set local role authenticated`: owner (...0001), member (...0002), non-member (...0004).
- Covers: household creation, invitation lifecycle (create/retire/revoke/consume), membership enforcement, RLS isolation, cross-household leaks.
