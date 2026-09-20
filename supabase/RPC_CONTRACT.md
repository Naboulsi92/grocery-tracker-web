# Database contract

All RPCs require an authenticated Supabase session. Client roles cannot insert into `households`, `household_members`, `profiles`, or `household_invitations` directly.

## RPCs

| Function | Arguments | Return | Authorization and behavior |
|---|---|---|---|
| `create_household` | `p_name text` | `uuid` | Creates the household, the caller's membership (stored `owner` for backwards compat, conferring no privilege — PRD §11 equality: every action is member-gated), ten default categories, and ten forked items (qty 0, threshold=suggested, `template_id` indicative, `already_notified=true`) atomically. Forked rows are per-household copies — renaming `Lait` in foyer A never affects foyer B. Fails if the caller already belongs to a household. |
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

### Fork ITEM_TEMPLATES + seeds + unites + validations (#107 scope A, PRD §4.3/§4.4/§5/§7)

- Seeds durs bilingues FR/EN : 10 `default_categories` (positions 1..10) + 10 `item_templates`
  (Lait/Milk, Pain/Bread, Œufs/Eggs, Tomates/Tomatoes, Pommes/Apples, Poulet/Chicken,
  Pâtes/Pasta, Café/Coffee, Eau/Water, Papier toilette/Toilet paper), vérifiés
  `SELECT count(*) = 10`. Re-jouables (`WHERE NOT EXISTS`) ; voir `supabase/seeds/01_default_catalog.sql`.
- Fork à la création : `create_household` copie les 10 templates vers `items`
  (qté 0, `low_stock_threshold = suggested_threshold`, `unit = template.unit`,
  `template_id` à titre indicatif uniquement, sans effet fonctionnel, `already_notified=true`
  pour ne pas générer de notif de seed). Aucune ligne partagée entre foyers.
- Unités fermées : `CHECK (unit IN ('kg','g','l','ml','unite'))` sur `items` + `item_templates`
  (validation applicative : liste déroulante, hors scope DB ici).
- Unicités insensibles casse : `UNIQUE (household_id, lower(name))` sur `items` (tous)
  + `categories` custom (`WHERE is_default = false`). Doublon `Lait`/`LAIT` → `23505`.
- `ON DELETE RESTRICT` : `items_category_household_fkey` composite
  `(category_id, household_id)`. Supprimer une catégorie non vide échoue (`23001`/`23503`) ;
  l'UI affiche « Déplacez ou supprimez d'abord les N articles » (N compté côté app).
- Seuils : `CHECK (low_stock_threshold > 0)` + entier (`trunc`), idem
  `suggested_threshold > 0` côté templates. Seuil 0/négatif/décimal → `23514`.
- Noms : `CHECK (char_length(btrim(name)) BETWEEN 1 AND 50 AND name ~ '[A-Za-zÀ-ÿŒœ]')`
  sur `items`, `categories`, `item_templates` (fr/en), `default_categories` (fr/en).
  Vide/espaces/sans-lettre/>50 → `23514`. Quantités : `>=0` (existant) + entières (`trunc`).
- Grants : `TO authenticated` seul sur fonctions et tables concernées
  (`items` insert inclut `template_id` ; catalogues en lecture seule).
  Pas d'enum → pas de `notify pgrst` requis pour cette migration.

### History + seuil — rotation 20 et already_notified (#108, PRD §4.6/§4.7/§5)

- `history` : `id`, `household_id`, `performed_by`, `action_type`
  (`modification`/`suppression` uniquement — jamais d'achat), `item_name`,
  `performed_at`. Aucune colonne avant/après : chaque entrée expose
  auteur+action+article+horodatage (relatif côté app).
- Rotation : trigger `history_cap_trigger` (`AFTER INSERT`, fonction
  `public.cap_history()`, non exécutable par les clients) — la 21e action du
  foyer supprime la plus ancienne, 20 lignes gardées par foyer.
- Accès membres du foyer uniquement : 3 policies `TO authenticated`
  (`history_select/insert/delete_member` via `private.is_household_member`) ;
  pas de policy ni de grant `UPDATE` (log immuable en append-only).
  Grants `TO authenticated` seul : `SELECT` + `DELETE` + `INSERT
  (household_id, performed_by, action_type, item_name)` — `id`/`performed_at`
  générés serveur. Zéro grant `anon`/`PUBLIC`. Corrige #105 (`history_insert_failed 42501` :
  les policies existaient mais aucun grant n'était posé).
- `items.already_notified` : `NOT NULL DEFAULT false`, server-controlled
  (absent des grants `INSERT`/`UPDATE` clients). Franchissement sous le seuil →
  `true` + 1 ligne `pending_notifications` (acteur enregistré : l'edge notifie
  l'autre membre, jamais l'acteur — §8 P0-2) ; remontée au-dessus du seuil →
  `false` (le re-passage re-notifie — §8 P0-3). Création sous le seuil notifiée
  seulement s'il existe un autre membre (garde seed : le fork `create_household`
  pose `already_notified=true`). Triggers `notify_threshold_crossing`
  (`BEFORE UPDATE OF quantity`) + `notify_threshold_crossing_on_insert`, non
  exécutables par les clients.
- `history` exclu de `supabase_realtime` (publication exactement `{categories, items}`).

### Offline resync — LWW silencieux sur `items.updated_at` (#109, PRD §4.12/§5)

- `items.updated_at` : `NOT NULL DEFAULT now()`, server-controlled (absent des
  grants `INSERT`/`UPDATE` clients, comme `already_notified` et
  `last_modified_*`). Arbitre last-write-wins : la valeur la plus récente fait
  foi, sans verrouillage optimiste en V1.
- Touch trigger `trigger_update_last_modified` (`BEFORE INSERT OR UPDATE` via
  `public.update_last_modified()`, non exécutable par les clients) : chaque
  écriture — `UPDATE` direct comme `UPDATE` interne de `adjust_item_quantity` —
  pose `last_modified_at`/`last_modified_by` + `updated_at = now()`.
- Index `items_household_updated_idx` sur `(household_id, updated_at DESC)` :
  sert le reload intégral de l'inventaire à la reconnexion (PRD §5 — recharger
  tout l'état, pas seulement rattraper le flux) et la resync silencieuse
  background (§4.12).
- RLS inchangée : les 4 policies membres `items_*` restent l'unique gate ;
  grants `TO authenticated` seul, zéro grant `anon`/`PUBLIC`.
- Conflit simultané : 2 writers du même foyer rejouent sans erreur, le dernier
  écrase silencieusement (l'écrasé n'est pas informé — §4.12). Voir
  `supabase/migrations/20260921000000_offline_lww.sql` ; asserts contrat LWW
  dans `supabase/tests/database/security_contract.sql` (§ Ticket #109).

### Household equality — `owner` derogation (accepted, #106 C3)

- Proof: `grep` over the convergence migration and the live catalog shows zero
  `owner` gates — no policy references `owner`, and `private.is_household_owner`
  is absent outside its `DROP FUNCTION` (all policies/RPCs gate on
  `private.is_household_member`, i.e. pure equality, PRD §11).
- Accepted derogation: the creator membership keeps the stored value `owner`
  (backwards compat) and UI labels (`members.role_owner` / `members.role_member`)
  remain, but confer no privilege — every action (rename, invite, revoke,
  consume) is member-gated.
- Follow-up (explicitly out of scope here): semantic purge of the `owner`
  value/labels (e.g. normalize creators to `member`). No value migration is
  attempted in this iteration — rewriting existing membership rows is deemed
  too risky and will be tracked separately.
- `push_subscriptions` stores one row per `(user_id, endpoint)`. The endpoint must equal `subscription.endpoint`; deleting one endpoint leaves the user's other devices intact.
- Existing households and memberships are retained when they satisfy the single-household invariant. The earliest member of each existing household is promoted to `owner`; other members become `member`.
- The migration normalizes any legacy negative item quantity to zero before validating the nonnegative constraint.

## Applying and checking

Use `npx supabase db reset` against the local Supabase stack to rebuild from migrations. Then run `psql "$LOCAL_SUPABASE_DB_URL" -v ON_ERROR_STOP=1 -f supabase/tests/database/security_contract.sql`; the test is wrapped in a transaction and rolls back all fixtures.
