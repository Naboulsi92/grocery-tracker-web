import { randomUUID } from 'node:crypto';
import { mkdir, readFile, rename, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { createClient } from '@supabase/supabase-js';
import { expect, test as base, type Browser, type Page } from '@playwright/test';
import { e2eEnvironment } from './environment';
import {
  PRD_ACCOUNTS,
  PRD_SEED_STATE_FILENAME,
  PRD_SESSION_DIR,
  foyerNameFor,
  isSessionStampCurrent,
  prdSessionPaths,
  type PrdAccountRole,
  type PrdSessionStamp,
} from '../../quality/prd-accounts';

type Account = {
  email: string;
  password: string;
  firstName: string;
  lastName: string;
};

type LocalFixtures = {
  account: Account;
};

/**
 * Password for the PRD seed accounts: explicit `E2E_PRD_PASSWORD` override
 * first, otherwise the per-run value published by global-setup. Never a
 * repo literal (`scan:secrets`).
 */
export async function readPrdSeedPassword(): Promise<string | null> {
  const override = process.env.E2E_PRD_PASSWORD?.trim();
  if (override) return override;
  try {
    const raw = await readFile(path.join(process.cwd(), PRD_SEED_STATE_FILENAME), 'utf8');
    const password = (JSON.parse(raw) as { password?: unknown }).password;
    return typeof password === 'string' && password.length > 0 ? password : null;
  } catch {
    return null;
  }
}

const createdEmails = new Set<string>();

export function createAccount(prefix = 'e2e'): Account {
  const id = randomUUID();
  return {
    email: `${prefix}-${id}${String.fromCharCode(64)}example.test`,
    password: ['Local', 'e2e', id].join('-'),
    firstName: `Camille-${id.slice(0, 8)}`,
    lastName: 'E2E',
  };
}

/**
 * Fail-fast guard for specs that require the seeded PRD accounts: throws
 * instead of skipping so a missing backend can never masquerade as green.
 * (Pre-existing `test.skip` call sites migrate to this helper in follow-ups;
 * new specs must use it from the start.)
 */
export async function requireSeedPassword(): Promise<string> {
  const password = await readPrdSeedPassword();
  if (!e2eEnvironment.writesAllowed || !password) {
    throw new Error(
      'PRD seed accounts require E2E_ALLOW_WRITES=true with local Supabase (global-setup seeds them).',
    );
  }
  return password;
}

/**
 * Fail-fast guard for specs that need a writable backend but not the seed
 * accounts (e.g. the standalone real-signup journey, the PRD §8 exception):
 * throws instead of skipping so a missing backend can never masquerade as
 * green.
 */
export function requireWrites(): void {
  if (!e2eEnvironment.writesAllowed) {
    throw new Error('This spec requires E2E_ALLOW_WRITES=true with local Supabase.');
  }
}

/** Absolute repo-root path of a session file (single place building it). */
function sessionFile(relative: string): string {
  return path.join(process.cwd(), relative);
}

function expectedStamp(password: string): PrdSessionStamp {
  return { password, backend: process.env.E2E_SUPABASE_URL ?? '' };
}

/**
 * Atomic save (temp file + rename) so a parallel worker never reads a
 * half-written session or stamp left by a concurrent fresh login.
 */
async function saveAtomically(target: string, write: (tmp: string) => Promise<unknown>): Promise<void> {
  const tmp = `${target}.tmp-${randomUUID()}`;
  await write(tmp);
  await rename(tmp, target);
}

async function freshSeedLogin(
  browser: Browser,
  role: PrdAccountRole,
  password: string,
): Promise<Page> {
  const account = PRD_ACCOUNTS.find((candidate) => candidate.role === role);
  if (!account) throw new Error(`Unknown PRD seed role: ${role}.`);
  const { state, stamp } = prdSessionPaths(role);
  const context = await browser.newContext();
  const page = await context.newPage();
  await page.goto('/login');
  await expect(page.getByRole('heading', { name: 'Connexion' })).toBeVisible();
  await page.getByLabel('Email').fill(account.email);
  await page.getByLabel('Mot de passe').fill(password);
  await page.getByRole('button', { name: 'Se connecter' }).click();
  await expect(page).toHaveURL('/home', { timeout: 20000 });
  await mkdir(sessionFile(PRD_SESSION_DIR), { recursive: true });
  await saveAtomically(sessionFile(state), (tmp) => context.storageState({ path: tmp }));
  await saveAtomically(sessionFile(stamp), (tmp) =>
    writeFile(tmp, JSON.stringify(expectedStamp(password)), 'utf8'),
  );
  return page;
}

/**
 * Page already authenticated as the `accountRole` seed account, reusing a
 * saved `storageState` when it is stamped with the current run password.
 * A stale session (e.g. previous run with the same `E2E_PRD_PASSWORD`
 * override but expired tokens) triggers exactly one fresh login, verified
 * by the seeded foyer heading — web-first, no `waitForTimeout`.
 * Parallel workers racing on the same session files are benign: same
 * credentials, last write wins, every saved state is valid.
 */
export async function ensureAuthenticatedPage(
  browser: Browser,
  role: PrdAccountRole,
): Promise<Page> {
  const password = await requireSeedPassword();
  const foyer = foyerNameFor(role);
  const { state, stamp } = prdSessionPaths(role);
  const verifyFoyerLoaded = async (page: Page): Promise<boolean> => {
    await page.goto('/home');
    try {
      await expect(page.getByRole('heading', { level: 1, name: foyer })).toBeVisible({
        timeout: 10000,
      });
      return true;
    } catch {
      return false;
    }
  };

  try {
    const raw = await readFile(sessionFile(stamp), 'utf8');
    if (isSessionStampCurrent(JSON.parse(raw), expectedStamp(password))) {
      const reused = await browser.newContext({ storageState: sessionFile(state) });
      const page = reused.pages()[0] ?? (await reused.newPage());
      if (await verifyFoyerLoaded(page)) return page;
      await reused.close();
    }
  } catch {
    // Missing/corrupt session files: fall through to a fresh login.
  }
  const page = await freshSeedLogin(browser, role, password);
  if (!(await verifyFoyerLoaded(page))) {
    throw new Error(`Authenticated session probe failed for ${role} after a fresh login.`);
  }
  return page;
}

type AuthFixtures = {
  accountRole: PrdAccountRole;
  authenticatedPage: Page;
};

export const test = base.extend<LocalFixtures & AuthFixtures>({
  accountRole: ['household1.userA' as PrdAccountRole, { option: true }],
  authenticatedPage: async ({ browser, accountRole }, provide) => {
    const page = await ensureAuthenticatedPage(browser, accountRole);
    await provide(page);
    await page.context().close();
  },
  account: async ({}, provide, testInfo) => {
    const account = createAccount(`e2e-${testInfo.parallelIndex}-${testInfo.retry}`);
    createdEmails.add(account.email);
    await provide(account);
  },
});

test.afterEach(async () => {
  if (!e2eEnvironment.writesAllowed || createdEmails.size === 0) return;

  const supabaseURL = process.env.E2E_SUPABASE_URL;
  const serviceRoleKey = process.env.E2E_SUPABASE_SERVICE_ROLE_KEY;
  if (!supabaseURL || !serviceRoleKey || !['localhost', '127.0.0.1', '::1'].includes(new URL(supabaseURL).hostname)) {
    throw new Error('Writable E2E cleanup requires local E2E_SUPABASE_URL and E2E_SUPABASE_SERVICE_ROLE_KEY.');
  }

  const admin = createClient(supabaseURL, serviceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
  const { data, error } = await admin.auth.admin.listUsers({ page: 1, perPage: 1000 });
  if (error) throw error;

  const users = data.users.filter((user) => user.email && createdEmails.has(user.email));
  const userIds = users.map((user) => user.id);
  if (userIds.length > 0) {
    const { data: memberships, error: membershipError } = await admin
      .from('household_members')
      .select('household_id')
      .in('user_id', userIds);
    if (membershipError) throw membershipError;

    const householdIds = [...new Set((memberships ?? []).map(({ household_id }) => household_id))];
    if (householdIds.length > 0) {
      const { error: householdError } = await admin.from('households').delete().in('id', householdIds);
      if (householdError) throw householdError;
    }
  }

  for (const user of users) {
    const { error: deleteError } = await admin.auth.admin.deleteUser(user.id);
    if (deleteError) throw deleteError;
    createdEmails.delete(user.email!);
  }
});

export async function signUp(page: Page, account: Account) {
  createdEmails.add(account.email);
  await page.goto('/signup');
  await page.getByLabel('Email').fill(account.email);
  await page.getByLabel('Mot de passe', { exact: true }).fill(account.password);
  await page.getByLabel('Confirmer le mot de passe').fill(account.password);
  await page.getByRole('button', { name: "S'inscrire" }).click();
  await page.waitForURL('/join-household', { timeout: 20000 });
  await page.getByTestId('onboarding-first-name-input').fill(account.firstName);
  await page.getByTestId('onboarding-last-name-input').fill(account.lastName);
}

export async function createHousehold(page: Page, account: Account) {
  await signUp(page, account);
  const householdName = `Foyer e2e ${randomUUID()}`;
  await page.getByLabel('Nom du foyer').fill(householdName);
  await page.getByRole('button', { name: 'Créer mon foyer' }).click();
  await page.waitForURL('/home', { timeout: 20000 });
  await expect(page.getByRole('heading', { level: 1, name: householdName })).toBeVisible();
  return householdName;
}

export { expect };
