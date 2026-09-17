# Supabase Edge Functions

## `notify-thresholds`

Server-side notification delivery for the grocery list app. Processes pending notifications from the `pending_notifications` table and sends Web Push notifications to household members.

### Endpoints

| Method | Path | Description |
|--------|------|-------------|
| POST | `/` | Process all unprocessed pending notifications (threshold crossings + daily reminders) |
| POST | `/daily-reminders` | Enqueue daily reminders for members whose `reminder_time` matches the current UTC time |

### Environment Variables

| Variable | Required | Description |
|----------|----------|-------------|
| `SUPABASE_URL` | Auto-injected | Supabase project URL |
| `SUPABASE_SERVICE_ROLE_KEY` | Auto-injected | Service role key (bypasses RLS) |
| `VAPID_PUBLIC_KEY` | Yes (project secret) | VAPID public key for Web Push |
| `VAPID_PRIVATE_KEY` | Yes (project secret) | VAPID private key for Web Push |
| `VAPID_SUBJECT` | Yes (project secret) | VAPID subject (mailto: URL or origin) |

### How It Works

1. **Threshold crossings** (database triggers on `items`):
   - BEFORE UPDATE OF quantity calls `notify_threshold_crossing()` (fires inside the security-definer RPC `adjust_item_quantity`).
   - BEFORE INSERT calls `notify_threshold_crossing_on_insert()` (SECURITY DEFINER, since item creation is a direct table insert). Newly created items at or below their threshold enqueue a notification; seed inserts made while the household has a single member are skipped.
   - Both insert a `pending_notifications` row with `actor_id` set to the acting user; deliveries go to the NON-acting member(s).

2. **Processing** (`POST /`): The edge function selects all rows where `processed_at IS NULL`, sends Web Push notifications to the non-acting household member(s), then marks rows as processed.

3. **Daily reminders** (`POST /daily-reminders`): Computes the current **UTC** wall-clock time (`HH:MM`, from `toISOString()`) and calls `enqueue_daily_reminders(p_at_time)`. That RPC enqueues one row **per user** whose `profiles.reminder_time` equals the argument, sets `target_user_id` (so only that member is notified), and de-duplicates within 24h per (household, user). `reminder_time` is a plain `time` with **no per-user timezone — the stored value is interpreted as UTC**; adjust cron/schedule times accordingly.

4. **Subscription cleanup**: If a push subscription returns 404/410 (expired/unsubscribed), the subscription row is deleted from `push_subscriptions`.

### Deployment

```bash
# Deploy the function
supabase functions deploy notify-thresholds

# Set VAPID secrets (replace with your actual keys)
supabase secrets set VAPID_PUBLIC_KEY=your_public_key VAPID_PRIVATE_KEY=your_private_key VAPID_SUBJECT=mailto:you@example.com
```

## `member-gdpr-sweep`

Completes the deferred account-deletion flow: any profile with `deleted_at` older than 7 days is permanently deleted (the `POST /` RPC `sweep_fully_deleted_members`). Deleting the `auth.users` row cascades profiles/memberships/push subscriptions/invitations and nulls audit references (`history.performed_by`, `pending_notifications` actors, `items.last_modified_by`).

### Endpoint

| Method | Path | Description |
|--------|------|-------------|
| POST | `/` | Purge accounts deleted more than 7 days ago |

### Security

- The RPC is `SECURITY DEFINER`, revoked from `public`/`anon`/`authenticated`, and granted **only to `service_role`**.
- The function is deployed with JWT verification **disabled**; access is gated solely by the cron-secret check: if the `CRON_SECRET` env var is set, requests must include `x-cron-secret: <CRON_SECRET>` (rejected with 401 otherwise) so a stray caller cannot purge accounts. No Supabase service-role key is stored as a GitHub Actions secret.

### Deployment prerequisite (required for the scheduler to work)

The function MUST be deployed without JWT verification and with `CRON_SECRET` set, otherwise
the scheduled call fails with 401/403:

```bash
supabase functions deploy member-gdpr-sweep --no-verify-jwt --project-ref <project-ref>
supabase secrets set CRON_SECRET=<your-secret> --project-ref <project-ref>
```

- `--no-verify-jwt`: without it the platform rejects requests lacking a valid `Authorization:
  Bearer <supabase-jwt>` (403) before the function's own `x-cron-secret` check ever runs.
- `CRON_SECRET`: without it `Deno.env.get("CRON_SECRET")` is empty, every caller is allowed, and
  the scheduled call's secret is ignored — the purge endpoint is effectively wide open.

**Fallback (not the default)**: the team may instead keep JWT verification enabled and pass the
service-role key as `Authorization: Bearer <SUPABASE_SERVICE_ROLE_KEY>`. That alternative **adds
exfiltration risk**: a leaked service-role key bypasses RLS across the whole project. We
deliberately choose the no-service-role-key path by default.

### Scheduling (recommended: daily)

```
POST https://<project-ref>.supabase.co/functions/v1/member-gdpr-sweep
x-cron-secret: <CRON_SECRET>
```

**GitHub Actions scheduler**: `.github/workflows/gdpr-automation.yml` invokes this function
daily at 03:00 UTC (plus `workflow_dispatch` for manual runs). It needs the single repo secret
`SUPABASE_CRON_SECRET` (same value as the function's `CRON_SECRET` env var). No service-role key
is stored as a GitHub Actions secret.

**CRON_SECRET setup**: set it once on the edge function (see deployment prerequisite above), then
it MUST also exist as the GitHub repo secret `SUPABASE_CRON_SECRET` or the scheduled call is
rejected:
```bash
supabase secrets set CRON_SECRET=<your-secret> --project-ref <project-ref>
# GitHub -> Settings -> Secrets and variables -> Actions -> New repository secret: SUPABASE_CRON_SECRET
```

### Scheduling Daily Reminders

Daily reminders can be triggered in two ways:

**Option A: pg_cron (if available) — call the RPC directly**
```sql
SELECT cron.schedule(
  'daily-grocery-reminder',
  '0 8 * * *',   -- 08:00 UTC
  $$ SELECT public.enqueue_daily_reminders(); $$
);
```

**Option B: External cron service**
Send a POST request to:
```
https://<project-ref>.supabase.co/functions/v1/notify-thresholds/daily-reminders
```
with header `Authorization: Bearer <SUPABASE_SERVICE_ROLE_KEY>`. The function computes the current UTC time itself.

> Because `reminder_time` is interpreted as UTC, an 08:00 reminder is sent at 08:00 UTC regardless of where the user is located.

### Notification Payload

The Web Push payload sent to the service worker (`public/sw.js`):
```json
{
  "title": "Household Name",
  "body": "Milk à acheter (0/1)",
  "url": "/to-buy",
  "badge": 3
}
```

- `title`: Household name
- `body`: Item name + quantity/threshold for threshold crossings; count of to-buy items for daily reminders
- `url`: Path to open on notification click (to-buy list)
- `badge`: Count of items at or below threshold (used for OS badge count)
