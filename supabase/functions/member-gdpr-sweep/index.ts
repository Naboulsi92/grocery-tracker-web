// Member GDPR sweep edge function.
//
// Triggered by an external cron (e.g. cron-job.org, GitHub Actions) every day.
// It completes the deferred account-deletion flow:

// A user who deletes their account (src/lib/account.ts) only sets
// profiles.deleted_at = now(). After 7 days this function permanently deletes
// the user, which cascades every dependent row (profiles, memberships, push
// subscriptions, invitations) and nulls audit references (history actors,
// pending notification targets, item last-modified authors).
//
// It calls the RPC sweep_fully_deleted_members() (SECURITY DEFINER, service
// role only) — see supabase/migrations/20260916020000_server_notifications.sql.

import { serve } from "https://deno.land/std@0.177.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

function getEnv(name: string): string {
  const value = Deno.env.get(name);
  if (!value) throw new Error(`Missing env var: ${name}`);
  return value;
}

serve(async (req) => {
  if (req.method !== "POST") {
    return new Response(
      JSON.stringify({ error: "Method not allowed" }),
      { status: 405, headers: { "Content-Type": "application/json" } },
    );
  }

  // Optionally require a shared cron secret so random callers can't purge accounts
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

  const supabase = createClient(
    getEnv("SUPABASE_URL"),
    getEnv("SUPABASE_SERVICE_ROLE_KEY"),
  );

  const { error } = await supabase.rpc("sweep_fully_deleted_members");

  if (error) {
    console.error("GDPR sweep failed:", error);
    return new Response(
      JSON.stringify({ error: "GDPR sweep failed", details: error.message }),
      { status: 500, headers: { "Content-Type": "application/json" } },
    );
  }

  return new Response(
    JSON.stringify({ ok: true }),
    { status: 200, headers: { "Content-Type": "application/json" } },
  );
});