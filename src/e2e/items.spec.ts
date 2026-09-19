import { randomUUID } from 'node:crypto';
import type { Page } from '@playwright/test';
import { createAccount, createHousehold, expect, signUp, test } from './fixtures';
import {
  e2eEnvironment,
  fixtureRequiredReason,
  writesDisabledReason,
} from './environment';

async function deleteAllItems(page: Page) {
  const rows = page.locator('.item-row');
  let remaining = await rows.count();
  while (remaining > 0) {
    const dialogPromise = page.waitForEvent('dialog');
    await rows.first().getByTestId(/^btn-delete-item-/).click();
    await (await dialogPromise).accept();
    await expect(rows).toHaveCount(remaining - 1);
    remaining -= 1;
  }
}

test.describe('Items CRUD', () => {
  test.describe('Create Item', () => {
    test('shows error message on create failure', async ({ page, account }) => {
      test.skip(!e2eEnvironment.writesAllowed, writesDisabledReason);
      await createHousehold(page, account);

      const itemName = `Article E ${randomUUID()}`;
      await page.getByTestId('dashboard-card-items').click();
      await page.getByTestId('btn-new-item').click();
      await page.getByTestId('input-item-name').fill(itemName);

      await page.route('**/rest/v1/items**', async (route) => {
        if (route.request().method() === 'POST') {
          await route.fulfill({
            status: 403,
            contentType: 'application/json',
            body: JSON.stringify({
              code: '42501',
              message: 'new row violates row-level security policy',
              details: '',
              hint: '',
            }),
          });
        } else {
          await route.continue();
        }
      });
      await page.getByTestId('btn-create-item').click();

      await expect(page.getByRole('alert')).toBeVisible();
    });

    test('validates unit selection and display', async ({ page, account }) => {
      test.skip(!e2eEnvironment.writesAllowed, writesDisabledReason);
      await createHousehold(page, account);

      const itemName = `Article unité ${randomUUID()}`;
      await page.getByTestId('dashboard-card-items').click();
      await page.getByTestId('btn-new-item').click();
      await page.getByTestId('input-item-name').fill(itemName);
      
      const unitSelect = page.locator('#item-unit');
      await expect(unitSelect).toBeVisible();
      const options = await unitSelect.locator('option').count();
      expect(options).toBeGreaterThan(1);
      
      await page.getByTestId('btn-create-item').click();
      await expect(page.getByText(itemName)).toBeVisible({ timeout: 10000 });
      
      const itemRow = page.locator('.item-row').filter({ hasText: itemName });
      await expect(itemRow.locator('.qty-value')).toContainText(/^.+$/);
      
      page.once('dialog', (dialog) => dialog.accept());
      await itemRow.getByTestId(/^btn-delete-item-/).click();
    });
  });

  test.describe('Edit Item', () => {
    test('can edit item name (US 45)', async ({ page, account }) => {
      test.skip(!e2eEnvironment.writesAllowed, writesDisabledReason);
      await createHousehold(page, account);

      const originalName = `Article ${randomUUID()}`;
      const newName = `Renommé ${randomUUID()}`;
      
      await page.getByTestId('dashboard-card-items').click();
      await page.getByTestId('btn-new-item').click();
      await page.getByTestId('input-item-name').fill(originalName);
      await page.getByTestId('btn-create-item').click();
      await expect(page.getByText(originalName)).toBeVisible({ timeout: 10000 });

      const itemRow = page.locator('.item-row').filter({ hasText: originalName });
      await itemRow.getByRole('button', { name: /Modifier l'article/ }).click();
      
      await expect(page.getByTestId('input-item-name')).toHaveValue(originalName);
      await page.getByTestId('input-item-name').fill(newName);
      await page.getByTestId('btn-create-item').click();
      
      await expect(page.getByText(newName)).toBeVisible();
      await expect(page.getByText(originalName)).toHaveCount(0);
      
      page.once('dialog', (dialog) => dialog.accept());
      await page.locator('.item-row').filter({ hasText: newName }).getByTestId(/^btn-delete-item-/).click();
    });

    test('can adjust item quantity via atomic buttons (US 46)', async ({ page, account }) => {
      test.skip(!e2eEnvironment.writesAllowed, writesDisabledReason);
      await createHousehold(page, account);

      const itemName = `Article qty ${randomUUID()}`;
      await page.getByTestId('dashboard-card-items').click();
      await page.getByTestId('btn-new-item').click();
      await page.getByTestId('input-item-name').fill(itemName);
      await page.getByLabel('Quantité', { exact: true }).fill('5');
      await page.getByTestId('btn-create-item').click();

      const itemRow = page.locator('.item-row').filter({ hasText: itemName });
      await expect(itemRow.locator('.qty-value')).toContainText('5');

      await itemRow.getByRole('button', { name: /Réduire la quantité/ }).click();
      await expect(itemRow.locator('.qty-value')).toContainText('4');

      await itemRow.getByRole('button', { name: /Augmenter la quantité/ }).click();
      await expect(itemRow.locator('.qty-value')).toContainText('5');

      page.once('dialog', (dialog) => dialog.accept());
      await itemRow.getByTestId(/^btn-delete-item-/).click();
    });

    test('can edit item category assignment (US 47)', async ({ page, account }) => {
      test.skip(!e2eEnvironment.writesAllowed, writesDisabledReason);
      await createHousehold(page, account);

      const categoryName = `Catégorie ${randomUUID()}`;
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

      const itemRow = page.locator('.item-row').filter({ hasText: itemName });
      await itemRow.getByRole('button', { name: /Modifier l'article/ }).click();
      await page.locator('#item-category').selectOption({ label: categoryName });
      await page.getByTestId('btn-create-item').click();
      
      const itemGroupHeader = page.locator('h3').filter({ hasText: categoryName });
      await expect(itemGroupHeader).toBeVisible();
      
      const deleteItemDialog = page.waitForEvent('dialog');
      await page.locator('.item-row').filter({ hasText: itemName }).getByTestId(/^btn-delete-item-/).click();
      await (await deleteItemDialog).accept();
      await page.goto('/home');
      await page.getByTestId('dashboard-card-categories').click();
      const deleteCategoryDialog = page.waitForEvent('dialog');
      await page.getByRole('button', { name: new RegExp(`Supprimer la catégorie ${categoryName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}`) }).click();
      await (await deleteCategoryDialog).accept();
    });

    test('can edit low stock threshold (US 48)', async ({ page, account }) => {
      test.skip(!e2eEnvironment.writesAllowed, writesDisabledReason);
      await createHousehold(page, account);

      const itemName = `Article seuil ${randomUUID()}`;
      await page.getByTestId('dashboard-card-items').click();
      await page.getByTestId('btn-new-item').click();
      await page.getByTestId('input-item-name').fill(itemName);
      await page.getByLabel('Quantité', { exact: true }).fill('3');
      await page.getByLabel('Seuil stock bas').fill('5');
      await page.getByTestId('btn-create-item').click();
      
      const itemRow = page.locator('.item-row').filter({ hasText: itemName });
      await expect(itemRow).toHaveClass(/low-stock/);
      await expect(itemRow.locator('.badge')).toContainText('À acheter');
      
      await itemRow.getByRole('button', { name: /Modifier l'article/ }).click();
      await page.getByLabel('Seuil stock bas').fill('1');
      await page.getByTestId('btn-create-item').click();
      
      await expect(itemRow).not.toHaveClass(/low-stock/);
      await expect(itemRow.locator('.badge')).toHaveCount(0);
      
      page.once('dialog', (dialog) => dialog.accept());
      await itemRow.getByTestId(/^btn-delete-item-/).click();
    });
  });

  test.describe('Atomic Operations', () => {
    test('can increment quantity atomically (US 49)', async ({ page, account }) => {
      test.skip(!e2eEnvironment.writesAllowed, writesDisabledReason);
      await createHousehold(page, account);

      const itemName = `Article inc ${randomUUID()}`;
      await page.getByTestId('dashboard-card-items').click();
      await page.getByTestId('btn-new-item').click();
      await page.getByTestId('input-item-name').fill(itemName);
      await page.getByLabel('Quantité', { exact: true }).fill('2');
      await page.getByTestId('btn-create-item').click();
      
      const itemRow = page.locator('.item-row').filter({ hasText: itemName });
      await expect(itemRow.locator('.qty-value')).toContainText('2');
      
      await itemRow.getByRole('button', { name: /Augmenter la quantité/ }).click();
      await expect(itemRow.locator('.qty-value')).toContainText('3');
      
      await itemRow.getByRole('button', { name: /Augmenter la quantité/ }).click();
      await expect(itemRow.locator('.qty-value')).toContainText('4');
      
      page.once('dialog', (dialog) => dialog.accept());
      await itemRow.getByTestId(/^btn-delete-item-/).click();
    });

    test('can decrement quantity atomically (US 50)', async ({ page, account }) => {
      test.skip(!e2eEnvironment.writesAllowed, writesDisabledReason);
      await createHousehold(page, account);

      const itemName = `Article dec ${randomUUID()}`;
      await page.getByTestId('dashboard-card-items').click();
      await page.getByTestId('btn-new-item').click();
      await page.getByTestId('input-item-name').fill(itemName);
      await page.getByLabel('Quantité', { exact: true }).fill('5');
      await page.getByTestId('btn-create-item').click();
      
      const itemRow = page.locator('.item-row').filter({ hasText: itemName });
      await expect(itemRow.locator('.qty-value')).toContainText('5');
      
      await itemRow.getByRole('button', { name: /Réduire la quantité/ }).click();
      await expect(itemRow.locator('.qty-value')).toContainText('4');
      
      await itemRow.getByRole('button', { name: /Réduire la quantité/ }).click();
      await expect(itemRow.locator('.qty-value')).toContainText('3');
      
      page.once('dialog', (dialog) => dialog.accept());
      await itemRow.getByTestId(/^btn-delete-item-/).click();
    });

    test('cannot decrement below zero', async ({ page, account }) => {
      test.skip(!e2eEnvironment.writesAllowed, writesDisabledReason);
      await createHousehold(page, account);

      const itemName = `Article zero ${randomUUID()}`;
      await page.getByTestId('dashboard-card-items').click();
      await page.getByTestId('btn-new-item').click();
      await page.getByTestId('input-item-name').fill(itemName);
      await page.getByLabel('Quantité', { exact: true }).fill('1');
      await page.getByTestId('btn-create-item').click();
      
      const itemRow = page.locator('.item-row').filter({ hasText: itemName });
      await expect(itemRow.locator('.qty-value')).toContainText('1');
      
      const decrementBtn = itemRow.getByRole('button', { name: /Réduire la quantité/ });
      await expect(decrementBtn).toBeEnabled();
      await decrementBtn.click();
      await expect(itemRow.locator('.qty-value')).toContainText('0');
      
      const decrementBtnAfter = itemRow.getByRole('button', { name: /Réduire la quantité/ });
      await expect(decrementBtnAfter).toBeDisabled();
      
      page.once('dialog', (dialog) => dialog.accept());
      await itemRow.getByTestId(/^btn-delete-item-/).click();
    });
  });

  test.describe('Empty State', () => {
    test('shows empty state with call-to-action when no items exist (US 51, 81)', async ({ page, account }) => {
      test.skip(!e2eEnvironment.writesAllowed, fixtureRequiredReason);
      await createHousehold(page, account);

      await page.getByTestId('dashboard-card-items').click();
      await expect(page.getByTestId('btn-new-item')).toBeVisible({ timeout: 10000 });
      await deleteAllItems(page);

      const emptyState = page.locator('.empty-state');
      await expect(emptyState).toBeVisible();
      await expect(emptyState).toContainText('Aucun article');
      await expect(emptyState).toContainText('Ajoutez votre premier article');
      const ctaButton = page.getByTestId('btn-new-item');
      await expect(ctaButton).toBeVisible();
      await expect(ctaButton).toBeEnabled();
    });
  });

  test.describe('Error Handling', () => {
    test('shows error message on delete failure (US 53)', async ({ page, account }) => {
      test.skip(!e2eEnvironment.writesAllowed, writesDisabledReason);
      await createHousehold(page, account);

      const itemName = `Article E ${randomUUID()}`;
      await page.getByTestId('dashboard-card-items').click();
      await page.getByTestId('btn-new-item').click();
      await page.getByTestId('input-item-name').fill(itemName);
      await page.getByTestId('btn-create-item').click();
      await expect(page.getByText(itemName)).toBeVisible({ timeout: 10000 });

      await page.route('**/rest/v1/items**', async (route) => {
        if (route.request().method() === 'DELETE') {
          await route.fulfill({
            status: 403,
            contentType: 'application/json',
            body: JSON.stringify({
              code: '42501',
              message: 'new row violates row-level security policy',
              details: '',
              hint: '',
            }),
          });
        } else {
          await route.continue();
        }
      });

      page.once('dialog', (dialog) => dialog.accept());
      const itemRow = page.locator('.item-row').filter({ hasText: itemName });
      await itemRow.getByTestId(/^btn-delete-item-/).click();

      await expect(page.getByRole('alert')).toBeVisible();
    });
  });

  test.describe('Real-time Updates', () => {
    test('updates in real-time when items change', async ({ page, account, browser }) => {
      test.skip(!e2eEnvironment.writesAllowed, fixtureRequiredReason);
      const householdName = await createHousehold(page, account);

      const itemName = `Article rt ${randomUUID()}`;
      await page.getByTestId('dashboard-card-items').click();
      await page.getByTestId('btn-new-item').click();
      await page.getByTestId('input-item-name').fill(itemName);
      await page.getByTestId('btn-create-item').click();
      await expect(page.getByText(itemName)).toBeVisible({ timeout: 10000 });

      const secondContext = await browser.newContext();
      const secondPage = await secondContext.newPage();
      const secondAccount = createAccount('e2e-realtime');
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
  });

  test.describe('Low Stock Badge', () => {
    test('displays low-stock badge correctly', async ({ page, account }) => {
      test.skip(!e2eEnvironment.writesAllowed, writesDisabledReason);
      await createHousehold(page, account);

      const itemName = `Article badge ${randomUUID()}`;
      await page.getByTestId('dashboard-card-items').click();
      await page.getByTestId('btn-new-item').click();
      await page.getByTestId('input-item-name').fill(itemName);
      await page.getByLabel('Quantité', { exact: true }).fill('2');
      await page.getByLabel('Seuil stock bas').fill('2');
      await page.getByTestId('btn-create-item').click();
      
      const itemRow = page.locator('.item-row').filter({ hasText: itemName });
      await expect(itemRow.locator('.badge')).toContainText('À acheter');
      await expect(itemRow).toHaveClass(/low-stock/);
      
      await itemRow.getByRole('button', { name: /Augmenter la quantité/ }).click();
      await itemRow.getByRole('button', { name: /Augmenter la quantité/ }).click();
      await itemRow.getByRole('button', { name: /Augmenter la quantité/ }).click();
      
      await expect(itemRow.locator('.badge')).toHaveCount(0);
      await expect(itemRow).not.toHaveClass(/low-stock/);
      
      page.once('dialog', (dialog) => dialog.accept());
      await itemRow.getByTestId(/^btn-delete-item-/).click();
    });
  });
});