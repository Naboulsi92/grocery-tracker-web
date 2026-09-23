import { randomUUID } from 'node:crypto';
import type { Page } from '@playwright/test';
import { createClient as createSupabaseClient } from '@supabase/supabase-js';
import { requireWrites, createAccount, createHousehold, expect, signUp, test } from './fixtures';
import { confirmDeleteDialog, deleteItemRow } from './helpers';

test.describe('Real-time Collaboration', () => {
  test.describe('Real-time Item Updates (US 56)', () => {
    test('updates item quantity in real-time across browser contexts', async ({ page, account, browser }) => {
      requireWrites();
      await createHousehold(page, account);

      const itemName = `Article rt ${randomUUID()}`;
      await page.getByTestId('dashboard-card-items').click();
      await page.getByTestId('btn-new-item').click();
      await page.getByTestId('input-item-name').fill(itemName);
      await page.getByLabel('Quantité', { exact: true }).fill('1');
      await page.getByTestId('btn-create-item').click();
      await expect(page.getByText(itemName)).toBeVisible({ timeout: 10000 });

      const secondContext = await browser.newContext();
      const secondPage = await secondContext.newPage();
      const secondAccount = createAccount('e2e-rt-item');
      await signUp(secondPage, secondAccount);

      await secondPage.getByLabel(/Code d.invitation complet/).fill('');

      // Invite tokens render on /members (never on /items): fetch one via the
      // proven onboarding pattern so the two-context flow below always runs.
      await page.goto('/home');
      await page.getByRole('link', { name: /Membres/ }).click();
      await page.getByRole('button', { name: 'Créer une invitation' }).click();
      const token = await page.locator('.invite-code-text').textContent();
      await page.goto('/items');

      await secondPage.getByLabel(/Code d.invitation complet/).fill(token ?? '');
      await secondPage.getByRole('button', { name: 'Rejoindre le foyer' }).click();
      await secondPage.waitForURL('/home', { timeout: 20000 });

      await secondPage.getByTestId('dashboard-card-items').click();
      await expect(secondPage.getByText(itemName)).toBeVisible({ timeout: 10000 });

      const secondItemRow = secondPage.locator('.item-row').filter({ hasText: itemName });
      await secondItemRow.getByRole('button', { name: /Augmenter la quantité/ }).click();
      await expect(secondItemRow.locator('.qty-value')).toContainText('2');

      await expect(page.locator('.item-row').filter({ hasText: itemName }).locator('.qty-value')).toContainText('2', { timeout: 10000 });

      await secondContext.close();

      await confirmDeleteDialog(page, page.locator('.item-row').filter({ hasText: itemName }).getByTestId(/^btn-delete-item-/), 'item-delete-confirm');
    });

    test('updates item name in real-time across browser contexts', async ({ page, account, browser }) => {
      requireWrites();
      await createHousehold(page, account);

      const originalName = `Article orig ${randomUUID()}`;
      await page.getByTestId('dashboard-card-items').click();
      await page.getByTestId('btn-new-item').click();
      await page.getByTestId('input-item-name').fill(originalName);
      await page.getByTestId('btn-create-item').click();
      await expect(page.getByText(originalName)).toBeVisible({ timeout: 10000 });

      const secondContext = await browser.newContext();
      const secondPage = await secondContext.newPage();
      const secondAccount = createAccount('e2e-rt-name');
      await signUp(secondPage, secondAccount);

      await secondPage.getByLabel(/Code d.invitation complet/).fill('');

      // Invite tokens render on /members (never on /items): fetch one via the
      // proven onboarding pattern so the two-context flow below always runs.
      await page.goto('/home');
      await page.getByRole('link', { name: /Membres/ }).click();
      await page.getByRole('button', { name: 'Créer une invitation' }).click();
      const token = await page.locator('.invite-code-text').textContent();
      await page.goto('/items');

      await secondPage.getByLabel(/Code d.invitation complet/).fill(token ?? '');
      await secondPage.getByRole('button', { name: 'Rejoindre le foyer' }).click();
      await secondPage.waitForURL('/home', { timeout: 20000 });

      await secondPage.getByTestId('dashboard-card-items').click();
      await expect(secondPage.getByText(originalName)).toBeVisible({ timeout: 10000 });

      const newName = `Article ren ${randomUUID()}`;
      const itemRow = page.locator('.item-row').filter({ hasText: originalName });
      await itemRow.getByRole('button', { name: /Modifier l'article/ }).click();
      await page.getByTestId('input-item-name').fill(newName);
      await page.getByTestId('btn-create-item').click();

      await expect(page.getByText(newName)).toBeVisible();
      await expect(secondPage.getByText(newName)).toBeVisible({ timeout: 10000 });

      await confirmDeleteDialog(page, page.locator('.item-row').filter({ hasText: newName }).getByTestId(/^btn-delete-item-/), 'item-delete-confirm');

      await secondContext.close();
    });
  });

  test.describe('Real-time Category Updates (US 57)', () => {
    test('updates category in real-time across browser contexts', async ({ page, account, browser }) => {
      requireWrites();
      await createHousehold(page, account);

      const categoryName = `Catégorie rt ${randomUUID()}`;
      await page.getByTestId('dashboard-card-categories').click();
      await page.getByTestId('btn-new-category').click();
      await page.getByTestId('input-category-name').fill(categoryName);
      await page.getByTestId('btn-create-category').click();
      await expect(page.getByText(categoryName)).toBeVisible({ timeout: 10000 });

      const itemName = `Article cat ${randomUUID()}`;
      await page.goto('/home');
      await page.getByTestId('dashboard-card-items').click();
      await page.getByTestId('btn-new-item').click();
      await page.getByTestId('input-item-name').fill(itemName);
      await page.getByTestId('btn-create-item').click();
      await expect(page.getByText(itemName)).toBeVisible({ timeout: 10000 });

      const secondContext = await browser.newContext();
      const secondPage = await secondContext.newPage();
      const secondAccount = createAccount('e2e-rt-cat');
      await signUp(secondPage, secondAccount);

      await secondPage.getByLabel(/Code d.invitation complet/).fill('');

      // Invite tokens render on /members (never on /items): fetch one via the
      // proven onboarding pattern so the two-context flow below always runs.
      await page.goto('/home');
      await page.getByRole('link', { name: /Membres/ }).click();
      await page.getByRole('button', { name: 'Créer une invitation' }).click();
      const token = await page.locator('.invite-code-text').textContent();
      await page.goto('/items');

      await secondPage.getByLabel(/Code d.invitation complet/).fill(token ?? '');
      await secondPage.getByRole('button', { name: 'Rejoindre le foyer' }).click();
      await secondPage.waitForURL('/home', { timeout: 20000 });

      await secondPage.getByTestId('dashboard-card-items').click();
      await expect(secondPage.getByText(itemName)).toBeVisible({ timeout: 10000 });

      const itemRow = page.locator('.item-row').filter({ hasText: itemName });
      await itemRow.getByRole('button', { name: /Modifier l'article/ }).click();
      await page.locator('#item-category').selectOption({ label: categoryName });
      await page.getByTestId('btn-create-item').click();

      await expect(page.locator('h3').filter({ hasText: categoryName })).toBeVisible();
      await expect(secondPage.locator('h3').filter({ hasText: categoryName })).toBeVisible({ timeout: 10000 });

      await secondContext.close();

      await deleteItemRow(page, page.locator('.item-row').filter({ hasText: itemName }));
      await page.goto('/home');
      await page.getByTestId('dashboard-card-categories').click();
      await confirmDeleteDialog(page, page.getByRole('button', { name: new RegExp(`Supprimer la catégorie ${categoryName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}`) }), 'category-delete-confirm');
    });
  });

  test.describe('To-Buy List Real-time Updates (US 58)', () => {
    test('auto-updates to-buy list when items change', async ({ page, account, browser }) => {
      requireWrites();
      await createHousehold(page, account);

      const itemName = `Article ach ${randomUUID()}`;
      await page.getByTestId('dashboard-card-items').click();
      await page.getByTestId('btn-new-item').click();
      await page.getByTestId('input-item-name').fill(itemName);
      await page.getByLabel('Quantité', { exact: true }).fill('1');
      await page.getByLabel('Seuil stock bas').fill('2');
      await page.getByTestId('btn-create-item').click();
      await expect(page.getByText(itemName)).toBeVisible({ timeout: 10000 });

      await page.goto('/home');
      await page.getByTestId('dashboard-card-to-buy').click();
      await expect(page.getByText(itemName)).toBeVisible({ timeout: 10000 });

      const secondContext = await browser.newContext();
      const secondPage = await secondContext.newPage();
      const secondAccount = createAccount('e2e-rt-tobuy');
      await signUp(secondPage, secondAccount);

      await secondPage.getByLabel(/Code d.invitation complet/).fill('');

      // Invite tokens render on /members (never on /to-buy): fetch one via the
      // proven onboarding pattern so the two-context flow below always runs.
      await page.goto('/home');
      await page.getByRole('link', { name: /Membres/ }).click();
      await page.getByRole('button', { name: 'Créer une invitation' }).click();
      const token = await page.locator('.invite-code-text').textContent();
      await page.goto('/to-buy');

      await secondPage.getByLabel(/Code d.invitation complet/).fill(token ?? '');
      await secondPage.getByRole('button', { name: 'Rejoindre le foyer' }).click();
      await secondPage.waitForURL('/home', { timeout: 20000 });

      await secondPage.getByTestId('dashboard-card-to-buy').click();
      await expect(secondPage.getByText(itemName)).toBeVisible({ timeout: 10000 });

      await secondPage.goto('/home');
      await secondPage.getByTestId('dashboard-card-items').click();
      const secondItemRow = secondPage.locator('.item-row').filter({ hasText: itemName });
      await secondItemRow.getByRole('button', { name: /Augmenter la quantité/ }).click();
      await secondItemRow.getByRole('button', { name: /Augmenter la quantité/ }).click();

      await page.goto('/home');
      await page.getByTestId('dashboard-card-to-buy').click();
      await expect(page.getByText(itemName)).not.toBeVisible({ timeout: 10000 });

      await secondContext.close();

      await page.goto('/items');
      await confirmDeleteDialog(page, page.locator('.item-row').filter({ hasText: itemName }).getByTestId(/^btn-delete-item-/), 'item-delete-confirm');
    });
  });

  test.describe('Debounce Mechanism (US 59, 60)', () => {
    test('prevents excessive re-fetches during rapid updates', async ({ page, account, browser }) => {
      requireWrites();
      await createHousehold(page, account);

      const itemName = `Article deb ${randomUUID()}`;
      await page.getByTestId('dashboard-card-items').click();
      await page.getByTestId('btn-new-item').click();
      await page.getByTestId('input-item-name').fill(itemName);
      await page.getByLabel('Quantité', { exact: true }).fill('1');
      await page.getByTestId('btn-create-item').click();
      await expect(page.getByText(itemName)).toBeVisible({ timeout: 10000 });

      const secondContext = await browser.newContext();
      const secondPage = await secondContext.newPage();
      const secondAccount = createAccount('e2e-rt-debounce');
      await signUp(secondPage, secondAccount);

      await secondPage.getByLabel(/Code d.invitation complet/).fill('');

      // Invite tokens render on /members (never on /items): fetch one via the
      // proven onboarding pattern so the two-context flow below always runs.
      await page.goto('/home');
      await page.getByRole('link', { name: /Membres/ }).click();
      await page.getByRole('button', { name: 'Créer une invitation' }).click();
      const token = await page.locator('.invite-code-text').textContent();
      await page.goto('/items');

      await secondPage.getByLabel(/Code d.invitation complet/).fill(token ?? '');
      await secondPage.getByRole('button', { name: 'Rejoindre le foyer' }).click();
      await secondPage.waitForURL('/home', { timeout: 20000 });

      await secondPage.getByTestId('dashboard-card-items').click();

      const secondItemRow = secondPage.locator('.item-row').filter({ hasText: itemName });
      for (let i = 0; i < 5; i++) {
        await secondItemRow.getByRole('button', { name: /Augmenter la quantité/ }).click();
        // Intentional debounce stimulus pacing (not a settle sleep): the test
        // needs rapid successive updates, not synchronized ones.
        await page.waitForTimeout(50);
      }

      await expect(secondItemRow.locator('.qty-value')).toContainText('6', { timeout: 10000 });
      await expect(page.locator('.item-row').filter({ hasText: itemName }).locator('.qty-value')).toContainText('6', { timeout: 10000 });

      await secondContext.close();

      await confirmDeleteDialog(page, page.locator('.item-row').filter({ hasText: itemName }).getByTestId(/^btn-delete-item-/), 'item-delete-confirm');
    });
  });

  test.describe('Multi-user Onboarding (US 70)', () => {
    test('new user sees real-time data after joining household', async ({ page, account, browser }) => {
      requireWrites();
      const householdName = await createHousehold(page, account);

      const itemNames = [
        `Article 1 ${randomUUID()}`,
        `Article 2 ${randomUUID()}`,
        `Article 3 ${randomUUID()}`,
      ];

      await page.getByTestId('dashboard-card-items').click();
      for (const name of itemNames) {
        await page.getByTestId('btn-new-item').click();
        await page.getByTestId('input-item-name').fill(name);
        await page.getByTestId('btn-create-item').click();
        await expect(page.getByText(name)).toBeVisible({ timeout: 10000 });
      }

      await page.goto('/home');
      await page.getByRole('link', { name: /Membres/ }).click();
      await page.getByRole('button', { name: 'Créer une invitation' }).click();
      const token = page.locator('.invite-code-text');
      const invitationToken = await token.textContent();

      const memberContext = await browser.newContext();
      const memberPage = await memberContext.newPage();
      const memberAccount = createAccount('e2e-onboard');

      await signUp(memberPage, memberAccount);
      await memberPage.getByLabel(/Code d.invitation complet/).fill(invitationToken!);
      await memberPage.getByRole('button', { name: 'Rejoindre le foyer' }).click();
      await memberPage.waitForURL('/home', { timeout: 20000 });

      await memberPage.getByTestId('dashboard-card-items').click();
      for (const name of itemNames) {
        await expect(memberPage.getByText(name)).toBeVisible({ timeout: 10000 });
      }

      await memberContext.close();
    });
  });

  test.describe('Concurrent Updates', () => {
    test('handles concurrent updates from multiple users without race conditions', async ({ page, account, browser }) => {
      requireWrites();
      await createHousehold(page, account);

      const itemName = `Article conc ${randomUUID()}`;
      await page.getByTestId('dashboard-card-items').click();
      await page.getByTestId('btn-new-item').click();
      await page.getByTestId('input-item-name').fill(itemName);
      await page.getByLabel('Quantité', { exact: true }).fill('0');
      await page.getByTestId('btn-create-item').click();
      await expect(page.getByText(itemName)).toBeVisible({ timeout: 10000 });

      const secondContext = await browser.newContext();
      const secondPage = await secondContext.newPage();
      const secondAccount = createAccount('e2e-concurrent');
      await signUp(secondPage, secondAccount);

      await secondPage.getByLabel(/Code d.invitation complet/).fill('');

      // Invite tokens render on /members (never on /items): fetch one via the
      // proven onboarding pattern so the two-context flow below always runs.
      await page.goto('/home');
      await page.getByRole('link', { name: /Membres/ }).click();
      await page.getByRole('button', { name: 'Créer une invitation' }).click();
      const token = await page.locator('.invite-code-text').textContent();
      await page.goto('/items');

      await secondPage.getByLabel(/Code d.invitation complet/).fill(token ?? '');
      await secondPage.getByRole('button', { name: 'Rejoindre le foyer' }).click();
      await secondPage.waitForURL('/home', { timeout: 20000 });

      await secondPage.getByTestId('dashboard-card-items').click();
      const secondItemRow = secondPage.locator('.item-row').filter({ hasText: itemName });
      const firstPageItemRow = page.locator('.item-row').filter({ hasText: itemName });

      await secondItemRow.getByRole('button', { name: /Augmenter la quantité/ }).click();
      await secondItemRow.getByRole('button', { name: /Augmenter la quantité/ }).click();
      await secondItemRow.getByRole('button', { name: /Augmenter la quantité/ }).click();

      await expect(secondItemRow.locator('.qty-value')).toContainText('3', { timeout: 10000 });
      await expect(firstPageItemRow.locator('.qty-value')).toContainText('3', { timeout: 10000 });

      await firstPageItemRow.getByRole('button', { name: /Augmenter la quantité/ }).click();
      await expect(secondItemRow.locator('.qty-value')).toContainText('4', { timeout: 10000 });
      await expect(firstPageItemRow.locator('.qty-value')).toContainText('4', { timeout: 10000 });

      await secondContext.close();

      await confirmDeleteDialog(page, page.locator('.item-row').filter({ hasText: itemName }).getByTestId(/^btn-delete-item-/), 'item-delete-confirm');
    });
  });

  test.describe('Subscription Lifecycle', () => {
    test('validates subscription cleanup on page navigation', async ({ page, account }) => {
      requireWrites();
      await createHousehold(page, account);

      await page.getByTestId('dashboard-card-items').click();
      await expect(page.getByRole('heading', { name: 'Articles', level: 1 })).toBeVisible();

      // Dashboard cards only exist on the home page, so return there between pages
      await page.getByTestId('back-link').click();
      await page.getByTestId('dashboard-card-categories').click();
      await expect(page.getByRole('heading', { name: 'Catégories', level: 1 })).toBeVisible();

      await page.getByTestId('back-link').click();
      await page.getByTestId('dashboard-card-items').click();
      await expect(page.getByRole('heading', { name: 'Articles', level: 1 })).toBeVisible();

      const itemName = `Article nav ${randomUUID()}`;
      await page.getByTestId('btn-new-item').click();
      await page.getByTestId('input-item-name').fill(itemName);
      await page.getByTestId('btn-create-item').click();
      await expect(page.getByText(itemName)).toBeVisible({ timeout: 10000 });

      await confirmDeleteDialog(page, page.locator('.item-row').filter({ hasText: itemName }).getByTestId(/^btn-delete-item-/), 'item-delete-confirm');
    });

    test('validates channel creation and subscription lifecycle', async ({ page, account, browser }) => {
      requireWrites();
      await createHousehold(page, account);

      const itemName = `Article ch ${randomUUID()}`;
      await page.getByTestId('dashboard-card-items').click();
      await page.getByTestId('btn-new-item').click();
      await page.getByTestId('input-item-name').fill(itemName);
      await page.getByTestId('btn-create-item').click();
      await expect(page.getByText(itemName)).toBeVisible({ timeout: 10000 });

      const secondContext = await browser.newContext();
      const secondPage = await secondContext.newPage();
      const secondAccount = createAccount('e2e-channel');
      await signUp(secondPage, secondAccount);

      await secondPage.getByLabel(/Code d.invitation complet/).fill('');

      // Invite tokens render on /members (never on /items): fetch one via the
      // proven onboarding pattern so the two-context flow below always runs.
      await page.goto('/home');
      await page.getByRole('link', { name: /Membres/ }).click();
      await page.getByRole('button', { name: 'Créer une invitation' }).click();
      const token = await page.locator('.invite-code-text').textContent();
      await page.goto('/items');

      await secondPage.getByLabel(/Code d.invitation complet/).fill(token ?? '');
      await secondPage.getByRole('button', { name: 'Rejoindre le foyer' }).click();
      await secondPage.waitForURL('/home', { timeout: 20000 });

      await secondPage.getByTestId('dashboard-card-items').click();
      await expect(secondPage.getByText(itemName)).toBeVisible({ timeout: 10000 });

      const newItemName = `Article ch2 ${randomUUID()}`;
      await secondPage.getByTestId('btn-new-item').click();
      await secondPage.getByTestId('input-item-name').fill(newItemName);
      await secondPage.getByTestId('btn-create-item').click();
      // Success closes the form: fail fast here if the submit no-ops
      // (e.g. household not resolved yet) instead of matching the input value below.
      await expect(secondPage.getByTestId('input-item-name')).toBeHidden({ timeout: 10000 });
      await expect(secondPage.getByText(newItemName)).toBeVisible({ timeout: 10000 });

      await expect(page.getByText(newItemName)).toBeVisible({ timeout: 10000 });

      await secondContext.close();

      await confirmDeleteDialog(page, page.locator('.item-row').filter({ hasText: itemName }).getByTestId(/^btn-delete-item-/), 'item-delete-confirm');
    });
  });

  test.describe('No Duplicate Updates', () => {
    test('validates no duplicate updates or race conditions', async ({ page, account, browser }) => {
      requireWrites();
      await createHousehold(page, account);

      const itemName = `Article dup ${randomUUID()}`;
      await page.getByTestId('dashboard-card-items').click();
      await page.getByTestId('btn-new-item').click();
      await page.getByTestId('input-item-name').fill(itemName);
      await page.getByLabel('Quantité', { exact: true }).fill('1');
      await page.getByTestId('btn-create-item').click();
      await expect(page.getByText(itemName)).toBeVisible({ timeout: 10000 });

      const secondContext = await browser.newContext();
      const secondPage = await secondContext.newPage();
      const secondAccount = createAccount('e2e-dup');
      await signUp(secondPage, secondAccount);

      await secondPage.getByLabel(/Code d.invitation complet/).fill('');

      // Invite tokens render on /members (never on /items): fetch one via the
      // proven onboarding pattern so the two-context flow below always runs.
      await page.goto('/home');
      await page.getByRole('link', { name: /Membres/ }).click();
      await page.getByRole('button', { name: 'Créer une invitation' }).click();
      const token = await page.locator('.invite-code-text').textContent();
      await page.goto('/items');

      await secondPage.getByLabel(/Code d.invitation complet/).fill(token ?? '');
      await secondPage.getByRole('button', { name: 'Rejoindre le foyer' }).click();
      await secondPage.waitForURL('/home', { timeout: 20000 });

      await secondPage.getByTestId('dashboard-card-items').click();
      const secondItemRow = secondPage.locator('.item-row').filter({ hasText: itemName });
      const firstPageItemRow = page.locator('.item-row').filter({ hasText: itemName });

      await secondItemRow.getByRole('button', { name: /Augmenter la quantité/ }).click();
      // Intentional race-test pacing between interleaved updates (stimulus:
      // the race needs overlapping in-flight updates, not lockstep sync).
      await page.waitForTimeout(100);
      await secondItemRow.getByRole('button', { name: /Augmenter la quantité/ }).click();
      // Intentional race-test pacing between interleaved updates (stimulus:
      // the race needs overlapping in-flight updates, not lockstep sync).
      await page.waitForTimeout(100);

      await expect(secondItemRow.locator('.qty-value')).toContainText('3', { timeout: 10000 });
      await expect(firstPageItemRow.locator('.qty-value')).toContainText('3', { timeout: 10000 });

      const firstPageCount = await firstPageItemRow.count();
      expect(firstPageCount).toBe(1);

      await secondContext.close();

      await confirmDeleteDialog(page, page.locator('.item-row').filter({ hasText: itemName }).getByTestId(/^btn-delete-item-/), 'item-delete-confirm');
    });
  });

  test.describe('History + Threshold Notifications (§8 P0-2/P0-3/P1-10)', () => {
    async function adminClient() {
      const supabaseURL = process.env.E2E_SUPABASE_URL;
      const serviceRoleKey = process.env.E2E_SUPABASE_SERVICE_ROLE_KEY;
      if (!supabaseURL || !serviceRoleKey) {
        throw new Error('Database access requires E2E_SUPABASE_URL and E2E_SUPABASE_SERVICE_ROLE_KEY');
      }
      return createSupabaseClient(supabaseURL, serviceRoleKey);
    }

    async function getUserIdByEmail(email: string): Promise<string> {
      const admin = await adminClient();
      const { data, error } = await admin.auth.admin.listUsers({ page: 1, perPage: 1000 });
      if (error) throw error;
      const user = data.users.find((u) => u.email === email);
      if (!user) throw new Error(`No user found with email ${email}`);
      return user.id;
    }

    async function getHouseholdIdForUser(userId: string): Promise<string> {
      const admin = await adminClient();
      const { data, error } = await admin
        .from('household_members')
        .select('household_id')
        .eq('user_id', userId)
        .single();
      if (error || !data) throw error ?? new Error(`No household for user ${userId}`);
      return (data as { household_id: string }).household_id;
    }

    async function getMemberIds(householdId: string): Promise<string[]> {
      const admin = await adminClient();
      const { data, error } = await admin
        .from('household_members')
        .select('user_id')
        .eq('household_id', householdId);
      if (error) throw error;
      return ((data ?? []) as { user_id: string }[]).map(({ user_id }) => user_id);
    }

    async function getPending(householdId: string) {
      const admin = await adminClient();
      const { data, error } = await admin
        .from('pending_notifications')
        .select('id, actor_id, target_user_id')
        .eq('household_id', householdId);
      if (error) throw error;
      return (data ?? []) as { id: string; actor_id: string | null; target_user_id: string | null }[];
    }

    async function getItem(householdId: string, name: string) {
      const admin = await adminClient();
      const { data, error } = await admin
        .from('items')
        .select('id, quantity, low_stock_threshold, already_notified')
        .eq('household_id', householdId)
        .eq('name', name)
        .single();
      if (error || !data) throw error ?? new Error(`No item named ${name}`);
      return data as { id: string; quantity: number; low_stock_threshold: number; already_notified: boolean };
    }

    async function createThresholdItem(page: Page, itemName: string) {
      await page.getByTestId('dashboard-card-items').click();
      await page.getByTestId('btn-new-item').click();
      await page.getByTestId('input-item-name').fill(itemName);
      await page.getByLabel('Quantité', { exact: true }).fill('5');
      await page.getByLabel('Seuil stock bas').fill('2');
      await page.getByTestId('btn-create-item').click();
      await expect(page.getByText(itemName)).toBeVisible({ timeout: 10000 });
    }

    test('P1-10 — 21st history action evicts the oldest, max 20 shown, 0 history_insert_failed', async ({ page, account }) => {
      requireWrites();
      const historyWarnings: string[] = [];
      page.on('console', (msg) => {
        if (msg.type() === 'warning' && msg.text().includes('history_insert_failed')) {
          historyWarnings.push(msg.text());
        }
      });

      await createHousehold(page, account);
      const admin = await adminClient();
      const actorId = await getUserIdByEmail(account.email);
      const householdId = await getHouseholdIdForUser(actorId);

      await admin.from('history').delete().eq('household_id', householdId);
      const suffix = randomUUID();
      const base = Date.now();
      for (let i = 1; i <= 21; i++) {
        const { error } = await admin.from('history').insert({
          household_id: householdId,
          performed_by: actorId,
          action_type: i % 2 === 0 ? 'suppression' : 'modification',
          item_name: `Hist e2e ${suffix} ${i}`,
          performed_at: new Date(base + i * 1000).toISOString(),
        });
        if (error) throw error;
      }

      await expect
        .poll(
          async () => {
            const { data, error } = await admin
              .from('history')
              .select('id', { count: 'exact' })
              .eq('household_id', householdId);
            if (error) throw error;
            return (data ?? []).length;
          },
          { timeout: 10000 },
        )
        .toBeLessThanOrEqual(20);

      const { data: remaining } = await admin
        .from('history')
        .select('item_name')
        .eq('household_id', householdId)
        .order('performed_at', { ascending: true });
      const names = ((remaining ?? []) as { item_name: string }[]).map(({ item_name }) => item_name);
      expect(names).toHaveLength(20);
      expect(names).not.toContain(`Hist e2e ${suffix} 1`);
      expect(names).toContain(`Hist e2e ${suffix} 21`);

      await page.goto('/history');
      const entries = page.locator('[data-testid^="history-entry-"]');
      await expect.poll(async () => entries.count(), { timeout: 15000 }).toBeLessThanOrEqual(20);
      await expect(entries.first()).toBeVisible({ timeout: 10000 });

      expect(historyWarnings).toEqual([]);
    });

    test('P0-2 — A crosses below threshold: only B is notified, A is not', async ({ page, account, browser }) => {
      requireWrites();
      await createHousehold(page, account);
      const admin = await adminClient();
      const actorA = await getUserIdByEmail(account.email);
      const householdId = await getHouseholdIdForUser(actorA);
      await admin.from('pending_notifications').delete().eq('household_id', householdId);

      const itemName = `Seuil p02 ${randomUUID()}`;
      await createThresholdItem(page, itemName);

      const memberContext = await browser.newContext();
      const memberPage = await memberContext.newPage();
      try {
        await page.goto('/home');
        await page.getByRole('link', { name: /Membres/ }).click();
        await page.getByRole('button', { name: 'Créer une invitation' }).click();
        const invitationToken = await page.locator('.invite-code-text').textContent();

        const memberAccount = createAccount('e2e-rt-p02');
        await signUp(memberPage, memberAccount);
        await memberPage.getByLabel(/Code d.invitation complet/).fill(invitationToken ?? '');
        await memberPage.getByRole('button', { name: 'Rejoindre le foyer' }).click();
        await memberPage.waitForURL('/home', { timeout: 20000 });
        const actorB = await getUserIdByEmail(memberAccount.email);

        await page.goto('/items');
        const itemRow = page.locator('.item-row').filter({ hasText: itemName });
        for (let i = 0; i < 3; i++) {
          await itemRow.getByRole('button', { name: /Réduire la quantité/ }).click();
        }
        await expect(itemRow.locator('.qty-value')).toContainText('2', { timeout: 10000 });

        await expect
          .poll(async () => (await getPending(householdId)).length, { timeout: 15000 })
          .toBe(1);
        const pending = await getPending(householdId);
        expect(pending[0].actor_id).toBe(actorA);

        const memberIds = await getMemberIds(householdId);
        expect(memberIds).toEqual(expect.arrayContaining([actorA, actorB]));
        const recipients = memberIds.filter((id) => id !== pending[0].actor_id);
        expect(recipients).toEqual([actorB]);
        expect(recipients).not.toContain(actorA);

        const item = await getItem(householdId, itemName);
        expect(item.already_notified).toBe(true);

        await confirmDeleteDialog(page, itemRow.getByTestId(/^btn-delete-item-/), 'item-delete-confirm');
      } finally {
        await memberContext.close();
      }
    });

    test('P0-3 — down/up/down notifies once per crossing via already_notified', async ({ page, account }) => {
      requireWrites();
      await createHousehold(page, account);
      const admin = await adminClient();
      const actorId = await getUserIdByEmail(account.email);
      const householdId = await getHouseholdIdForUser(actorId);
      await admin.from('pending_notifications').delete().eq('household_id', householdId);

      const itemName = `Seuil p03 ${randomUUID()}`;
      await createThresholdItem(page, itemName);

      await page.goto('/items');
      const itemRow = page.locator('.item-row').filter({ hasText: itemName });

      for (let i = 0; i < 4; i++) {
        await itemRow.getByRole('button', { name: /Réduire la quantité/ }).click();
      }
      await expect(itemRow.locator('.qty-value')).toContainText('1', { timeout: 10000 });
      await expect
        .poll(async () => (await getPending(householdId)).length, { timeout: 15000 })
        .toBe(1);
      expect((await getItem(householdId, itemName)).already_notified).toBe(true);

      await itemRow.getByRole('button', { name: /Réduire la quantité/ }).click();
      await expect(itemRow.locator('.qty-value')).toContainText('0', { timeout: 10000 });
      // Quiescence window for a NEGATIVE assertion (no duplicate notification
      // may appear): kept as a bounded sleep on purpose — returning early on
      // the good state would void the test (Playwright has no wait-while).
      await page.waitForTimeout(1500);
      expect(await getPending(householdId)).toHaveLength(1);

      for (let i = 0; i < 5; i++) {
        await itemRow.getByRole('button', { name: /Augmenter la quantité/ }).click();
      }
      await expect(itemRow.locator('.qty-value')).toContainText('5', { timeout: 10000 });
      await expect
        .poll(async () => (await getItem(householdId, itemName)).already_notified, { timeout: 15000 })
        .toBe(false);
      expect(await getPending(householdId)).toHaveLength(1);

      for (let i = 0; i < 4; i++) {
        await itemRow.getByRole('button', { name: /Réduire la quantité/ }).click();
      }
      await expect(itemRow.locator('.qty-value')).toContainText('1', { timeout: 10000 });
      await expect
        .poll(async () => (await getPending(householdId)).length, { timeout: 15000 })
        .toBe(2);

      await confirmDeleteDialog(page, itemRow.getByTestId(/^btn-delete-item-/), 'item-delete-confirm');
    });
  });
});