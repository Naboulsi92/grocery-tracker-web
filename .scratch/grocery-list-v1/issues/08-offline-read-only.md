# T1D: Offline read-only mode

**What to build:** When the device is offline, the inventory and to-buy list remain readable from cache. All write actions are disabled. Auth/join screens show a blocking message with retry.

**Blocked by:** T0 (schema migration)

**Status:** ready-for-agent

- [ ] Service worker caches last-known inventory state (items, categories) using Cache API or IndexedDB
- [ ] On load, serve cached data when offline
- [ ] Show subtle "Hors connexion — lecture seule" / "Offline — read-only" banner on `/home`, `/items`, `/to-buy` when offline
- [ ] All write actions (±quantity, add/edit/delete items, category CRUD) disabled when offline (buttons grayed out or hidden)
- [ ] Auth screens (`/login`, `/signup`, `/join-household`) show blocking "Pas de connexion" screen with "Réessayer" / "Retry" button
- [ ] `data-testid` attributes: `offline-banner`, `offline-blocked-screen`, `offline-retry-button`
- [ ] Online/offline detection via `navigator.onLine` + `online`/`offline` events
