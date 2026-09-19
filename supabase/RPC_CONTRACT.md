# Database contract

All RPCs require an authenticated Supabase session. Client roles cannot insert into `households`, `household_members`, `profiles`, or `household_invitations` directly.

## RPCs

| Function | Arguments | Return | Authorization and behavior |
|---|---|---|---|
| `create_household` | `p_name text` | `uuid` | Creates the household, the caller's membership (stored `owner` for backwards compat, conferring no privilege — PRD §11 equality: every action is member-gated), and ten default categories atomically. Fails if the caller already belongs to a household. |
| `create_household_invitation` | `p_household_id uuid`, `p_expires_in interval = '24 hours'` | table `(invitation_id uuid, token text, expires_at timestamptz)` | Any household member. Lifetime must be positive and at most 24 hours, strict (PRD §4.2/§5 — anything above is rejected with `22023`; no 30-day tolerance). Creating a new invitation retires any prior live invitation for the household. The raw URL-safe token is returned once; only its SHA-256 digest is stored. |
| `revoke_household_invitation` | `p_invitation_id uuid` | `boolean` | Any household member. Returns `true` only when an active invitation was revoked. Idempotent retries return `false`. |
| `consume_household_invitation` | `p_token text` | `uuid` | Locks and consumes one valid, unexpired, unrevoked token, creates a `member` membership, and returns the household ID atomically. Fails without consuming the token if the caller already belongs to any household. If the household already has 2 members (PRD §4.2 cap 2, §8 P0-6), every known token fails with `23505 'household is full'` — with priority over `22023` validity errors and the `P0001` lockout — and a still-live invitation is auto-invalidated at once (`consumed`, PRD « automatiquement invalides »), so it stays unusable after a departure without regen. Unknown tokens stay `22023`, lockout stays `P0001` (non-full households only). |
| `get_household_invitation` | `p_household_id uuid` | table `(invitation_id uuid, created_at timestamptz, expires_at timestamptz, revoked_at timestamptz, consumed_at timestamptz)` | Any household member — PRD §11 household equality. Returns the household's latest invitation metadata and never the token. The security contract asserts anon is denied and authenticated is granted EXECUTE. |
| `adjust_item_quantity` | `p_item_id uuid`, `p_delta numeric` | `items` row | Household member only. Applies the delta in one SQL update, clamps at zero, records `auth.uid()`, and returns the authoritative row. Direct client updates of quantity are not granted. |

PostgREST argument names are exact. Supabase JS calls therefore use objects such as `rpc('adjust_item_quantity', { p_item_id, p_delta: 1 })`. PostgreSQL `interval` values are passed as strings, for example `{ p_expires_in: '12 hours', p_household_id }` (24h max, strict).

## Tables and visibility

- `profiles` exposes `id`, optional `first_name`/`last_name`, the legacy optional `display_name`, preferences (language, notification type, reminder), and timestamps. Signup creates a profile but no household.
- Members can read households, memberships, profiles, categories, and items only where they share a household. PRD §11 household equality: any member can rename the household and issue or revoke invitations; default categories stay immutable (PRD §4.3).
- Each user can belong to at most one household. Migration aborts explicitly if historical memberships violate this invariant; it never chooses a household or discards data implicitly.
- An item category must belong to the same household as the item.
- Household equality (PRD §11): any household member can rename the household and issue or revoke invitations.
- `household_invitations` has no direct client grants. Backend code must never expose `token_hash`.
- `push_subscriptions` stores one row per `(user_id, endpoint)`. The endpoint must equal `subscription.endpoint`; deleting one endpoint leaves the user's other devices intact.
- Existing households and memberships are retained when they satisfy the single-household invariant. The earliest member of each existing household is promoted to `owner`; other members become `member`.
- The migration normalizes any legacy negative item quantity to zero before validating the nonnegative constraint.

## Applying and checking

Use `npx supabase db reset` against the local Supabase stack to rebuild from migrations. Then run `psql "$LOCAL_SUPABASE_DB_URL" -v ON_ERROR_STOP=1 -f supabase/tests/database/security_contract.sql`; the test is wrapped in a transaction and rolls back all fixtures.
