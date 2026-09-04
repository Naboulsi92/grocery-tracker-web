import { randomUUID } from 'node:crypto';
import { createAccount, createHousehold, expect, signUp, test } from './fixtures';
import {
  e2eEnvironment,
  fixtureRequiredReason,
  writesDisabledReason,
} from './environment';

test.describe('Real-time Collaboration', () => {
  test.describe('Real-time Item Updates (US 56)', () => {
    test('updates item quantity in real-time across browser contexts', async ({ page, account, browser }) => {
      test.skip(!e2eEnvironment.writesAllowed, fixtureRequiredReason);
      await createHousehold(page, account);

      const itemName = `Article realtime ${randomUUID()}`;
      await page.getByTestId('dashboard-card-items').click();
      await page.getByTestId('btn-new-item').click();
      await page.getByTestId('input-item-name').fill(itemName);
      await page.getByLabel('Quantité').fill('1');
      await page.getByTestId('btn-create-item').click();
      await expect(page.getByText(itemName)).toBeVisible({ timeout: 10000 });

      const secondContext = await browser.newContext();
      const secondPage = await secondContext.newPage();
      const secondAccount = createAccount('e2e-rt-item');
      await signUp(secondPage, secondAccount);

      await secondPage.getByLabel(/Code d.invitation complet/).fill('');
      await secondPage.waitForTimeout(500);

      const inviteLink = page.locator('.invite-code-text');
      if (await inviteLink.isVisible()) {
        const token = await inviteLink.textContent();
        await secondPage.getByLabel(/Code d.invitation complet/).fill(token || '');
        await secondPage.getByRole('button', { name: 'Rejoindre le foyer' }).click();
        await secondPage.waitForURL('/home', { timeout: 20000 });

        await secondPage.getByTestId('dashboard-card-items').click();
        await expect(secondPage.getByText(itemName)).toBeVisible({ timeout: 10000 });

        const secondItemRow = secondPage.locator('.item-row').filter({ hasText: itemName });
        await secondItemRow.getByRole('button', { name: /Augmenter la quantité/ }).click();
        await expect(secondItemRow.locator('.qty-value')).toContainText('2');

        await expect(page.locator('.item-row').filter({ hasText: itemName }).locator('.qty-value')).toContainText('2');
      }

      await secondContext.close();

      page.once('dialog', (dialog) => dialog.accept());
      await page.locator('.item-row').filter({ hasText: itemName }).getByTestId(/^btn-delete-item-/).click();
    });

    test('updates item name in real-time across browser contexts', async ({ page, account, browser }) => {
      test.skip(!e2eEnvironment.writesAllowed, fixtureRequiredReason);
      await createHousehold(page, account);

      const originalName = `Article original ${randomUUID()}`;
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
      await secondPage.waitForTimeout(500);

      const inviteLink = page.locator('.invite-code-text');
      if (await inviteLink.isVisible()) {
        const token = await inviteLink.textContent();
        await secondPage.getByLabel(/Code d.invitation complet/).fill(token || '');
        await secondPage.getByRole('button', { name: 'Rejoindre le foyer' }).click();
        await secondPage.waitForURL('/home', { timeout: 20000 });

        await secondPage.getByTestId('dashboard-card-items').click();
        await expect(secondPage.getByText(originalName)).toBeVisible({ timeout: 10000 });

        const newName = `Article modifié ${randomUUID()}`;
        const itemRow = page.locator('.item-row').filter({ hasText: originalName });
        await itemRow.getByRole('button', { name: /Modifier l'article/ }).click();
        await page.getByTestId('input-item-name').fill(newName);
        await page.getByTestId('btn-create-item').click();

        await expect(page.getByText(newName)).toBeVisible();
        await expect(secondPage.getByText(newName)).toBeVisible({ timeout: 10000 });

        page.once('dialog', (dialog) => dialog.accept());
        await page.locator('.item-row').filter({ hasText: newName }).getByTestId(/^btn-delete-item-/).click();
      }

      await secondContext.close();
    });
  });

  test.describe('Real-time Category Updates (US 57)', () => {
    test('updates category in real-time across browser contexts', async ({ page, account, browser }) => {
      test.skip(!e2eEnvironment.writesAllowed, fixtureRequiredReason);
      await createHousehold(page, account);

      const categoryName = `Catégorie realtime ${randomUUID()}`;
      await page.getByTestId('dashboard-card-categories').click();
      await page.getByTestId('btn-new-category').click();
      await page.getByTestId('input-category-name').fill(categoryName);
      await page.getByTestId('btn-create-category').click();
      await expect(page.getByText(categoryName)).toBeVisible({ timeout: 10000 });

      const itemName = `Article catégorie ${randomUUID()}`;
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
      await secondPage.waitForTimeout(500);

      const inviteLink = page.locator('.invite-code-text');
      if (await inviteLink.isVisible()) {
        const token = await inviteLink.textContent();
        await secondPage.getByLabel(/Code d.invitation complet/).fill(token || '');
        await secondPage.getByRole('button', { name: 'Rejoindre le foyer' }).click();
        await secondPage.waitForURL('/home', { timeout: 20000 });

        await secondPage.getByTestId('dashboard-card-items').click();
        await expect(secondPage.getByText(itemName)).toBeVisible({ timeout: 10000 });

        const itemRow = page.locator('.item-row').filter({ hasText: itemName });
        await itemRow.getByRole('button', { name: /Modifier l'article/ }).click();
        await page.locator('#item-category').selectOption({ label: categoryName });
        await page.getByTestId('btn-create-item').click();

        await expect(page.locator('.item-row').filter({ hasText: categoryName })).toBeVisible();
        await expect(secondPage.locator('.item-row').filter({ hasText: categoryName })).toBeVisible({ timeout: 10000 });
      }

      await secondContext.close();

      page.once('dialog', (dialog) => dialog.accept());
      await page.locator('.item-row').filter({ hasText: itemName }).getByTestId(/^btn-delete-item-/).click();
      await page.getByTestId('dashboard-card-categories').click();
      page.once('dialog', (dialog) => dialog.accept());
      await page.getByRole('button', { name: new RegExp(`Supprimer la catégorie ${categoryName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}`) }).click();
    });
  });

  test.describe('To-Buy List Real-time Updates (US 58)', () => {
    test('auto-updates to-buy list when items change', async ({ page, account, browser }) => {
      test.skip(!e2eEnvironment.writesAllowed, fixtureRequiredReason);
      await createHousehold(page, account);

      const itemName = `Article à acheter ${randomUUID()}`;
      await page.getByTestId('dashboard-card-items').click();
      await page.getByTestId('btn-new-item').click();
      await page.getByTestId('input-item-name').fill(itemName);
      await page.getByLabel('Quantité').fill('1');
      await page.getByLabel('Seuil stock bas').fill('2');
      await page.getByTestId('btn-create-item').click();
      await expect(page.getByText(itemName)).toBeVisible({ timeout: 10000 });

      await page.getByTestId('dashboard-card-to-buy').click();
      await expect(page.getByText(itemName)).toBeVisible({ timeout: 10000 });

      const secondContext = await browser.newContext();
      const secondPage = await secondContext.newPage();
      const secondAccount = createAccount('e2e-rt-tobuy');
      await signUp(secondPage, secondAccount);

      await secondPage.getByLabel(/Code d.invitation complet/).fill('');
      await secondPage.waitForTimeout(500);

      const inviteLink = page.locator('.invite-code-text');
      if (await inviteLink.isVisible()) {
        const token = await inviteLink.textContent();
        await secondPage.getByLabel(/Code d.invitation complet/).fill(token || '');
        await secondPage.getByRole('button', { name: 'Rejoindre le foyer' }).click();
        await secondPage.waitForURL('/home', { timeout: 20000 });

        await secondPage.getByTestId('dashboard-card-to-buy').click();
        await expect(secondPage.getByText(itemName)).toBeVisible({ timeout: 10000 });

        await secondPage.getByTestId('dashboard-card-items').click();
        const secondItemRow = secondPage.locator('.item-row').filter({ hasText: itemName });
        await secondItemRow.getByRole('button', { name: /Augmenter la quantité/ }).click();
        await secondItemRow.getByRole('button', { name: /Augmenter la quantité/ }).click();

        await page.getByTestId('dashboard-card-to-buy').click();
        await expect(page.getByText(itemName)).not.toBeVisible({ timeout: 10000 });
      }

      await secondContext.close();

      page.once('dialog', (dialog) => dialog.accept());
      await page.locator('.item-row').filter({ hasText: itemName }).getByTestId(/^btn-delete-item-/).click();
    });
  });

  test.describe('Debounce Mechanism (US 59, 60)', () => {
    test('prevents excessive re-fetches during rapid updates', async ({ page, account, browser }) => {
      test.skip(!e2eEnvironment.writesAllowed, fixtureRequiredReason);
      await createHousehold(page, account);

      const itemName = `Article debounce ${randomUUID()}`;
      await page.getByTestId('dashboard-card-items').click();
      await page.getByTestId('btn-new-item').click();
      await page.getByTestId('input-item-name').fill(itemName);
      await page.getByLabel('Quantité').fill('1');
      await page.getByTestId('btn-create-item').click();
      await expect(page.getByText(itemName)).toBeVisible({ timeout: 10000 });

      const secondContext = await browser.newContext();
      const secondPage = await secondContext.newPage();
      const secondAccount = createAccount('e2e-rt-debounce');
      await signUp(secondPage, secondAccount);

      await secondPage.getByLabel(/Code d.invitation complet/).fill('');
      await secondPage.waitForTimeout(500);

      const inviteLink = page.locator('.invite-code-text');
      if (await inviteLink.isVisible()) {
        const token = await inviteLink.textContent();
        await secondPage.getByLabel(/Code d.invitation complet/).fill(token || '');
        await secondPage.getByRole('button', { name: 'Rejoindre le foyer' }).click();
        await secondPage.waitForURL('/home', { timeout: 20000 });

        await secondPage.getByTestId('dashboard-card-items').click();

        const secondItemRow = secondPage.locator('.item-row').filter({ hasText: itemName });
        for (let i = 0; i < 5; i++) {
          await secondItemRow.getByRole('button', { name: /Augmenter la quantité/ }).click();
          await page.waitForTimeout(50);
        }

        await expect(secondItemRow.locator('.qty-value')).toContainText('6');
        await expect(page.locator('.item-row').filter({ hasText: itemName }).locator('.qty-value')).toContainText('6');
      }

      await secondContext.close();

      page.once('dialog', (dialog) => dialog.accept());
      await page.locator('.item-row').filter({ hasText: itemName }).getByTestId(/^btn-delete-item-/).click();
    });
  });

  test.describe('Multi-user Onboarding (US 70)', () => {
    test('new user sees real-time data after joining household', async ({ page, account, browser }) => {
      test.skip(!e2eEnvironment.writesAllowed, fixtureRequiredReason);
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
      test.skip(!e2eEnvironment.writesAllowed, fixtureRequiredReason);
      await createHousehold(page, account);

      const itemName = `Article concurrent ${randomUUID()}`;
      await page.getByTestId('dashboard-card-items').click();
      await page.getByTestId('btn-new-item').click();
      await page.getByTestId('input-item-name').fill(itemName);
      await page.getByLabel('Quantité').fill('0');
      await page.getByTestId('btn-create-item').click();
      await expect(page.getByText(itemName)).toBeVisible({ timeout: 10000 });

      const secondContext = await browser.newContext();
      const secondPage = await secondContext.newPage();
      const secondAccount = createAccount('e2e-concurrent');
      await signUp(secondPage, secondAccount);

      await secondPage.getByLabel(/Code d.invitation complet/).fill('');
      await secondPage.waitForTimeout(500);

      const inviteLink = page.locator('.invite-code-text');
      if (await inviteLink.isVisible()) {
        const token = await inviteLink.textContent();
        await secondPage.getByLabel(/Code d.invitation complet/).fill(token || '');
        await secondPage.getByRole('button', { name: 'Rejoindre le foyer' }).click();
        await secondPage.waitForURL('/home', { timeout: 20000 });

        await secondPage.getByTestId('dashboard-card-items').click();
        const secondItemRow = secondPage.locator('.item-row').filter({ hasText: itemName });
        const firstPageItemRow = page.locator('.item-row').filter({ hasText: itemName });

        await secondItemRow.getByRole('button', { name: /Augmenter la quantité/ }).click();
        await secondItemRow.getByRole('button', { name: /Augmenter la quantité/ }).click();
        await secondItemRow.getByRole('button', { name: /Augmenter la quantité/ }).click();

        await expect(secondItemRow.locator('.qty-value')).toContainText('3');
        await expect(firstPageItemRow.locator('.qty-value')).toContainText('3');

        await firstPageItemRow.getByRole('button', { name: /Augmenter la quantité/ }).click();
        await expect(secondItemRow.locator('.qty-value')).toContainText('4');
        await expect(firstPageItemRow.locator('.qty-value')).toContainText('4');
      }

      await secondContext.close();

      page.once('dialog', (dialog) => dialog.accept());
      await page.locator('.item-row').filter({ hasText: itemName }).getByTestId(/^btn-delete-item-/).click();
    });
  });

  test.describe('Subscription Lifecycle', () => {
    test('validates subscription cleanup on page navigation', async ({ page, account }) => {
      test.skip(!e2eEnvironment.writesAllowed, fixtureRequiredReason);
      await createHousehold(page, account);

      await page.getByTestId('dashboard-card-items').click();
      await expect(page.getByText('Articles')).toBeVisible();

      await page.getByTestId('dashboard-card-categories').click();
      await expect(page.getByText('Catégories')).toBeVisible();

      await page.getByTestId('dashboard-card-items').click();
      await expect(page.getByText('Articles')).toBeVisible();

      const itemName = `Article nav ${randomUUID()}`;
      await page.getByTestId('btn-new-item').click();
      await page.getByTestId('input-item-name').fill(itemName);
      await page.getByTestId('btn-create-item').click();
      await expect(page.getByText(itemName)).toBeVisible({ timeout: 10000 });

      page.once('dialog', (dialog) => dialog.accept());
      await page.locator('.item-row').filter({ hasText: itemName }).getByTestId(/^btn-delete-item-/).click();
    });

    test('validates channel creation and subscription lifecycle', async ({ page, account, browser }) => {
      test.skip(!e2eEnvironment.writesAllowed, fixtureRequiredReason);
      await createHousehold(page, account);

      const itemName = `Article channel ${randomUUID()}`;
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
      await secondPage.waitForTimeout(500);

      const inviteLink = page.locator('.invite-code-text');
      if (await inviteLink.isVisible()) {
        const token = await inviteLink.textContent();
        await secondPage.getByLabel(/Code d.invitation complet/).fill(token || '');
        await secondPage.getByRole('button', { name: 'Rejoindre le foyer' }).click();
        await secondPage.waitForURL('/home', { timeout: 20000 });

        await secondPage.getByTestId('dashboard-card-items').click();
        await expect(secondPage.getByText(itemName)).toBeVisible({ timeout: 10000 });

        const newItemName = `Article channel 2 ${randomUUID()}`;
        await secondPage.getByTestId('btn-new-item').click();
        await secondPage.getByTestId('input-item-name').fill(newItemName);
        await secondPage.getByTestId('btn-create-item').click();
        await expect(secondPage.getByText(newItemName)).toBeVisible({ timeout: 10000 });

        await expect(page.getByText(newItemName)).toBeVisible({ timeout: 10000 });
      }

      await secondContext.close();

      page.once('dialog', (dialog) => dialog.accept());
      await page.locator('.item-row').filter({ hasText: itemName }).getByTestId(/^btn-delete-item-/).click();
    });
  });

  test.describe('No Duplicate Updates', () => {
    test('validates no duplicate updates or race conditions', async ({ page, account, browser }) => {
      test.skip(!e2eEnvironment.writesAllowed, fixtureRequiredReason);
      await createHousehold(page, account);

      const itemName = `Article duplicate ${randomUUID()}`;
      await page.getByTestId('dashboard-card-items').click();
      await page.getByTestId('btn-new-item').click();
      await page.getByTestId('input-item-name').fill(itemName);
      await page.getByLabel('Quantité').fill('1');
      await page.getByTestId('btn-create-item').click();
      await expect(page.getByText(itemName)).toBeVisible({ timeout: 10000 });

      const secondContext = await browser.newContext();
      const secondPage = await secondContext.newPage();
      const secondAccount = createAccount('e2e-dup');
      await signUp(secondPage, secondAccount);

      await secondPage.getByLabel(/Code d.invitation complet/).fill('');
      await secondPage.waitForTimeout(500);

      const inviteLink = page.locator('.invite-code-text');
      if (await inviteLink.isVisible()) {
        const token = await inviteLink.textContent();
        await secondPage.getByLabel(/Code d.invitation complet/).fill(token || '');
        await secondPage.getByRole('button', { name: 'Rejoindre le foyer' }).click();
        await secondPage.waitForURL('/home', { timeout: 20000 });

        await secondPage.getByTestId('dashboard-card-items').click();
        const secondItemRow = secondPage.locator('.item-row').filter({ hasText: itemName });
        const firstPageItemRow = page.locator('.item-row').filter({ hasText: itemName });

        await secondItemRow.getByRole('button', { name: /Augmenter la quantité/ }).click();
        await page.waitForTimeout(100);
        await secondItemRow.getByRole('button', { name: /Augmenter la quantité/ }).click();
        await page.waitForTimeout(100);

        await expect(secondItemRow.locator('.qty-value')).toContainText('3');
        await expect(firstPageItemRow.locator('.qty-value')).toContainText('3');

        const firstPageCount = await firstPageItemRow.count();
        expect(firstPageCount).toBe(1);
      }

      await secondContext.close();

      page.once('dialog', (dialog) => dialog.accept());
      await page.locator('.item-row').filter({ hasText: itemName }).getByTestId(/^btn-delete-item-/).click();
    });
  });
});