import { serve } from "https://deno.land/std@0.177.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import webpush from "web-push";

// ─── Types (inline — Deno functions cannot import from src/types/) ───

interface PendingNotification {
  id: string;
  household_id: string;
  item_id: string | null;
  item_name: string;
  quantity: number | null;
  threshold: number | null;
  actor_id: string | null;
  target_user_id: string | null;
  created_at: string;
}

interface HouseholdMember {
  user_id: string;
}

interface PushSubscriptionRow {
  endpoint: string;
  subscription: Record<string, unknown>;
}

interface Household {
  name: string;
}

// ─── Helpers ───

function getEnv(name: string, fallback?: string): string {
  const value = Deno.env.get(name) ?? fallback;
  if (!value) throw new Error(`Missing env var: ${name}`);
  return value;
}

function createServiceClient() {
  return createClient(
    getEnv("SUPABASE_URL"),
    getEnv("SUPABASE_SERVICE_ROLE_KEY", Deno.env.get("SUPABASE_SERVICE_KEY")),
  );
}

// ─── Main handler ───

serve(async (req) => {
  const url = new URL(req.url);

  if (req.method !== "POST") {
    return new Response(
      JSON.stringify({ error: "Method not allowed" }),
      { status: 405, headers: { "Content-Type": "application/json" } },
    );
  }

  // Optionally require a shared cron secret so random callers can't trigger
  // sends or reminders. Mirrors member-gdpr-sweep: if CRON_SECRET is set,
  // require a matching x-cron-secret header; otherwise requests are gated only
  // by the deployment-time verify_jwt setting (documented in README.md).
  const expected = Deno.env.get("CRON_SECRET");
  if (expected) {
    const provided = req.headers.get("x-cron-secret");
    if (provided !== expected) {
      return new Response(
        JSON.stringify({ error: "Unauthorized" }),
        { status: 401, headers: { "Content-Type": "application/json" } },
      );
    }
  }

  // POST /daily-reminders — enqueue daily reminder notifications
  if (url.pathname.endsWith("/daily-reminders")) {
    return handleDailyReminders();
  }

  // POST (default) — process pending threshold notifications
  return handleProcessNotifications();
});

// ─── Process pending notifications ───

async function handleProcessNotifications(): Promise<Response> {
  const supabase = createServiceClient();

  // Configure VAPID from env (do NOT hardcode)
  webpush.setVapidDetails(
    getEnv("VAPID_SUBJECT"),
    getEnv("VAPID_PUBLIC_KEY"),
    getEnv("VAPID_PRIVATE_KEY"),
  );

  // Fetch all unprocessed notifications
  const { data: notifications, error: fetchError } = await supabase
    .from("pending_notifications")
    .select("*")
    .is("processed_at", null)
    .order("created_at", { ascending: true });

  if (fetchError) {
    return new Response(
      JSON.stringify({ error: "Failed to fetch notifications", details: fetchError.message }),
      { status: 500, headers: { "Content-Type": "application/json" } },
    );
  }

  if (!notifications || notifications.length === 0) {
    return new Response(
      JSON.stringify({ message: "No pending notifications", sent: 0, failed: 0 }),
      { status: 200, headers: { "Content-Type": "application/json" } },
    );
  }

  let totalSent = 0;
  let totalFailed = 0;

  for (const notification of notifications as PendingNotification[]) {
    const result = await processNotification(supabase, notification);
    totalSent += result.sent;
    totalFailed += result.failed;

    // Mark as processed
    await supabase
      .from("pending_notifications")
      .update({ processed_at: new Date().toISOString() })
      .eq("id", notification.id);
  }

  return new Response(
    JSON.stringify({ sent: totalSent, failed: totalFailed, processed: notifications.length }),
    { status: 200, headers: { "Content-Type": "application/json" } },
  );
}

async function processNotification(
  supabase: ReturnType<typeof createServiceClient>,
  notification: PendingNotification,
): Promise<{ sent: number; failed: number }> {
  let sent = 0;
  let failed = 0;

  // Fetch household name for the notification title
  const { data: household } = await supabase
    .from("households")
    .select("name")
    .eq("id", notification.household_id)
    .single<Household>();

  const householdName = household?.name ?? "Liste de courses";

  // Determine which users to notify
  let targetUserIds: string[];

  if (notification.target_user_id) {
    // Daily reminder or targeted notification: notify only the specified user
    targetUserIds = [notification.target_user_id];
  } else if (notification.actor_id) {
    // Threshold crossing: notify the NON-acting household member(s)
    const { data: members } = await supabase
      .from("household_members")
      .select("user_id")
      .eq("household_id", notification.household_id)
      .neq("user_id", notification.actor_id);

    targetUserIds = (members as HouseholdMember[] | null)?.map((m) => m.user_id) ?? [];
  } else {
    // Actor null (daily reminder without target_user_id): notify ALL household members
    const { data: members } = await supabase
      .from("household_members")
      .select("user_id")
      .eq("household_id", notification.household_id);

    targetUserIds = (members as HouseholdMember[] | null)?.map((m) => m.user_id) ?? [];
  }

  // Count items at or below threshold for this household (OS badge count)
  const { count } = await supabase
    .from("items")
    .select("*", { count: "exact", head: true })
    .eq("household_id", notification.household_id)
    .filter("quantity", "lte", "low_stock_threshold");

  const badge = count ?? 0;

  // Build notification body
  const bodyParts: string[] = [];
  if (notification.item_name === "Rappel") {
    bodyParts.push(`${badge} article(s) à acheter`);
  } else {
    const qtyStr = notification.quantity != null ? `${notification.quantity}` : "?";
    const thrStr = notification.threshold != null ? `${notification.threshold}` : "?";
    bodyParts.push(`${notification.item_name} à acheter (${qtyStr}/${thrStr})`);
  }

  const pushPayload = JSON.stringify({
    title: householdName,
    body: bodyParts.join(" — "),
    url: "/to-buy",
    badge,
  });

  // Send to each target user's push subscriptions
  for (const userId of targetUserIds) {
    const { data: subscriptions } = await supabase
      .from("push_subscriptions")
      .select("endpoint, subscription")
      .eq("user_id", userId);

    if (!subscriptions) continue;

    for (const sub of subscriptions as PushSubscriptionRow[]) {
      try {
        await webpush.sendNotification(
          sub.subscription as webpush.PushSubscription,
          pushPayload,
        );
        sent++;
      } catch (err: unknown) {
        const statusCode = (err as { statusCode?: number }).statusCode;
        if (statusCode === 404 || statusCode === 410) {
          // Subscription expired or unsubscribed: remove it
          await supabase
            .from("push_subscriptions")
            .delete()
            .eq("endpoint", sub.endpoint);
        } else {
          console.error(`Push send error for ${sub.endpoint}:`, err);
        }
        failed++;
      }
    }
  }

  return { sent, failed };
}

// ─── Daily reminders handler ───
// Called by an external cron service or pg_cron HTTP helper.
// Delegates to enqueue_daily_reminders(p_at_time), which enqueues one
// pending_notifications row PER USER whose profiles.reminder_time matches the
// provided time (target_user_id set → only that member is notified).
//
// reminder_time is stored as a plain time with no per-user timezone, so the
// current time is computed in UTC (documented in functions/README.md).

async function handleDailyReminders(): Promise<Response> {
  const supabase = createServiceClient();

  // Current time in UTC (HH:MM) — reminder_time applies to UTC wall-clock
  const utcNow = new Date().toISOString().slice(11, 16);

  const { error } = await supabase.rpc("enqueue_daily_reminders", {
    p_at_time: utcNow,
  });

  if (error) {
    return new Response(
      JSON.stringify({ error: "Failed to enqueue reminders", details: error.message }),
      { status: 500, headers: { "Content-Type": "application/json" } },
    );
  }

  return new Response(
    JSON.stringify({ enqueued_at: utcNow }),
    { status: 200, headers: { "Content-Type": "application/json" } },
  );
}
