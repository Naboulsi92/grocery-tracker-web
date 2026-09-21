// Member GDPR sweep edge function.
//
// Triggered by an external cron (GitHub Actions, see
// .github/workflows/gdpr-automation.yml) every day. It completes the deferred
// account-deletion flow (PRD §4.9):
//
// A user who deletes their account only sets profiles.deleted_at = now(). A
// sign-in within 7 days clears deleted_at (cancellation). After 7 days this
// function permanently deletes the user, which cascades every dependent row
// (profiles, memberships, push subscriptions, invitations) and nulls audit
// references (history actors, pending notification targets, item
// last-modified authors). A 0-member household is purged by the
// cleanup_empty_household trigger (PRD §5).
//
// It calls the RPC sweep_fully_deleted_members() (SECURITY DEFINER, service
// role only) — see supabase/migrations/20260922000000_compte_foyer_lifecycle.sql.
//
// Auth (fail-closed, audit H5): CRON_SECRET is MANDATORY. Requests without a
// matching x-cron-secret header are rejected with 401, and the function
// refuses to run when the secret is not configured server-side. Error details
// are logged server-side only — callers get a generic message, never
// error.message.

import { serve } from "https://deno.land/std@0.177.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

function getEnv(name: string): string {
  const value = Deno.env.get(name);
  if (!value) throw new Error(`Missing env var: ${name}`);
  return value;
}

function unauthorized(): Response {
  return new Response(
    JSON.stringify({ error: "Unauthorized" }),
    { status: 401, headers: { "Content-Type": "application/json" } },
  );
}

serve(async (req) => {
  if (req.method !== "POST") {
    return new Response(
      JSON.stringify({ error: "Method not allowed" }),
      { status: 405, headers: { "Content-Type": "application/json" } },
    );
  }

  // Mandatory shared cron secret so stray callers can't purge accounts.
  // Fail closed: no configured secret (or a mismatch) => 401, no sweep.
  const expected = Deno.env.get("CRON_SECRET");
  const provided = req.headers.get("x-cron-secret");
  if (!expected || provided !== expected) {
    console.warn("member-gdpr-sweep rejected: missing or invalid cron secret");
    return unauthorized();
  }

  const supabase = createClient(
    getEnv("SUPABASE_URL"),
    getEnv("SUPABASE_SERVICE_ROLE_KEY"),
  );

  const { data, error } = await supabase.rpc("sweep_fully_deleted_members");

  if (error) {
    // Server-side log only: never leak error.message to the HTTP caller.
    console.error("GDPR sweep failed:", error);
    return new Response(
      JSON.stringify({ error: "GDPR sweep failed" }),
      { status: 500, headers: { "Content-Type": "application/json" } },
    );
  }

  return new Response(
    JSON.stringify({ ok: true, purged: data ?? 0 }),
    { status: 200, headers: { "Content-Type": "application/json" } },
  );
});
