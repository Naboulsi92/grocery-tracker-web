import { randomUUID } from 'node:crypto';
import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { createClient } from '@supabase/supabase-js';
import { e2eEnvironment } from './environment';
import {
  PRD_ACCOUNTS,
  PRD_FOYER_1_NAME,
  PRD_FOYER_2_NAME,
  PRD_SEED_STATE_FILENAME,
  assertFoyerTopology,
  resolvePrdSeedPassword,
  type PrdAccountRole,
} from '../../quality/prd-accounts';

const LOOPBACK_HOSTNAMES = new Set(['localhost', '127.0.0.1', '::1']);

/**
 * Playwright globalSetup (wired in `playwright.config.ts`).
 *
 * Reseeds the three PRD §comptes-de-test addresses deterministically:
 * any leftover PRD users (and their households) are deleted first, then
 * fresh confirmed users are created via the admin API — no email is sent —
 * and their foyers are built through the production `create_household` RPC
 * (userA owns foyer 1 with seeded categories/items, userB joins it, user2A
 * owns isolated foyer 2). Topology is asserted before the suite runs.
 * The run password is published to `test-results/prd-seed.json` so worker
 * processes (which cannot inherit memory) can log in as these accounts.
 *
 * Skipped unless writable E2E is enabled (local Supabase stack): read-only
 * lanes keep running the rest of the suite, and PRD-account specs skip.
 */
async function globalSetup() {
  if (!e2eEnvironment.writesAllowed) {
    console.log('PRD seed skipped: E2E_ALLOW_WRITES is not enabled.');
    return;
  }

  const supabaseURL = process.env.E2E_SUPABASE_URL;
  const serviceRoleKey = process.env.E2E_SUPABASE_SERVICE_ROLE_KEY;
  if (!supabaseURL || !serviceRoleKey || !LOOPBACK_HOSTNAMES.has(new URL(supabaseURL).hostname)) {
    throw new Error('PRD seeding requires local E2E_SUPABASE_URL and E2E_SUPABASE_SERVICE_ROLE_KEY.');
  }

  const admin = createClient(supabaseURL, serviceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  const wantedEmails = new Set(PRD_ACCOUNTS.map((account) => account.email));
  const { data, error } = await admin.auth.admin.listUsers({ page: 1, perPage: 1000 });
  if (error) throw error;
  const staleUsers = data.users.filter((user) => user.email && wantedEmails.has(user.email));

  if (staleUsers.length > 0) {
    const staleIds = staleUsers.map((user) => user.id);
    const { data: memberships, error: membershipError } = await admin
      .from('household_members')
      .select('household_id')
      .in('user_id', staleIds);
    if (membershipError) throw membershipError;
    const householdIds = [...new Set((memberships ?? []).map(({ household_id }) => household_id))];
    if (householdIds.length > 0) {
      const { error: householdError } = await admin.from('households').delete().in('id', householdIds);
      if (householdError) throw householdError;
    }
    for (const user of staleUsers) {
      const { error: deleteError } = await admin.auth.admin.deleteUser(user.id);
      if (deleteError) throw deleteError;
    }
  }

  const password = resolvePrdSeedPassword(process.env, randomUUID);
  for (const account of PRD_ACCOUNTS) {
    const { data: created, error: createError } = await admin.auth.admin.createUser({
      email: account.email,
      password,
      email_confirm: true,
      user_metadata: { first_name: account.firstName, last_name: account.lastName },
    });
    if (createError) throw createError;
    if (!created.user) {
      throw new Error(`PRD seed creation returned no user for ${account.email}.`);
    }
  }

  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!anonKey) throw new Error('PRD seeding requires NEXT_PUBLIC_SUPABASE_ANON_KEY.');

  // Ids come from a sign-in round-trip per account (authoritative, same
  // data the specs will use) instead of a second admin user listing, which
  // proved unreliable in CI (created accounts missing from the re-list).
  const signIn = async (email: string) => {
    const client = createClient(supabaseURL, anonKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    });
    const { data, error: signInError } = await client.auth.signInWithPassword({
      email,
      password,
    });
    if (signInError) throw signInError;
    if (!data.user) throw new Error(`PRD seed sign-in returned no user for ${email}.`);
    return { client, userId: data.user.id };
  };
  type PrdSession = Awaited<ReturnType<typeof signIn>>;
  const sessions = Object.fromEntries(
    await Promise.all(
      PRD_ACCOUNTS.map(async (account) => [account.role, await signIn(account.email)]),
    ),
  ) as Record<PrdAccountRole, PrdSession>;
  const userIds = Object.fromEntries(
    PRD_ACCOUNTS.map((account) => [account.role, sessions[account.role].userId]),
  ) as Record<PrdAccountRole, string>;

  // Foyers go through the production RPC (create_household) so seeds carry
  // the real default categories/items fork; userB joins foyer 1 by direct
  // membership insert (the invitation join flow stays covered by
  // join-household.spec.ts).
  const createFoyer = async (
    client: PrdSession['client'],
    name: string,
  ): Promise<string> => {
    const { data, error: rpcError } = await client.rpc('create_household', { p_name: name });
    if (rpcError) throw rpcError;
    if (typeof data !== 'string' || data.length === 0) {
      throw new Error(`create_household RPC returned an unexpected household id for ${name}.`);
    }
    return data;
  };

  const foyer1 = await createFoyer(sessions['household1.userA'].client, PRD_FOYER_1_NAME);
  await createFoyer(sessions['household2.userA'].client, PRD_FOYER_2_NAME);
  const { error: joinError } = await admin
    .from('household_members')
    .insert({ household_id: foyer1, user_id: userIds['household1.userB'], role: 'member' });
  if (joinError) throw joinError;

  const { data: memberships, error: membershipsError } = await admin
    .from('household_members')
    .select('household_id,user_id,role')
    .in('user_id', Object.values(userIds));
  if (membershipsError) throw membershipsError;
  const topology = assertFoyerTopology(memberships ?? [], userIds);
  if (topology.foyer1 !== foyer1) throw new Error('PRD seed topology mismatch on foyer 1.');

  const statePath = path.join(process.cwd(), PRD_SEED_STATE_FILENAME);
  await mkdir(path.dirname(statePath), { recursive: true });
  await writeFile(statePath, JSON.stringify({ password }), 'utf8');
  console.log(`PRD seed ready: ${PRD_ACCOUNTS.length} accounts reseeded (${PRD_FOYER_1_NAME}, ${PRD_FOYER_2_NAME}).`);
}

export default globalSetup;
