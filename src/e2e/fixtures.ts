import { randomUUID } from 'node:crypto';
import { createClient } from '@supabase/supabase-js';
import { expect, test as base, type Page } from '@playwright/test';
import { e2eEnvironment } from './environment';

type Account = {
  email: string;
  password: string;
};

type LocalFixtures = {
  account: Account;
};

const createdEmails = new Set<string>();

export function createAccount(prefix = 'e2e'): Account {
  const id = randomUUID();
  return {
    email: `${prefix}-${id}${String.fromCharCode(64)}example.test`,
    password: ['Local', 'e2e', id].join('-'),
  };
}

export const test = base.extend<LocalFixtures>({
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
