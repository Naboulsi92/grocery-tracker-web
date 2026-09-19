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
  page.on('dialog', (dialog) => void dialog.accept());
  while (remaining > 0) {
    await rows.first().getByTestId(/^btn-delete-item-/).click();
    await expect(rows).toHaveCount(remaining - 1);
    remaining -= 1;
  }
}

test.describe('Empty States', () => {
  test.describe('Categories Empty State', () => {
    test('shows the default categories catalog for a new household (US 80, 84-85)', async ({ page, account }) => {
      test.skip(!e2eEnvironment.writesAllowed, fixtureRequiredReason);
      await createHousehold(page, account);

      await page.getByTestId('dashboard-card-categories').click();

      const defaultSection = page.locator('[data-testid="category-section-default"]');
      await expect(defaultSection).toBeVisible();
      await expect(defaultSection.locator('.category-card')).toHaveCount(10);
      await expect(defaultSection.getByText('Fruits')).toBeVisible();
      await expect(defaultSection.getByText('Légumes')).toBeVisible();

      const ctaButton = page.getByTestId('btn-new-category');
      await expect(ctaButton).toBeVisible();
      await expect(ctaButton).toBeEnabled();
    });

    test('add-category button is functional and creates a custom category', async ({ page, account }) => {
      test.skip(!e2eEnvironment.writesAllowed, writesDisabledReason);
      await createHousehold(page, account);

      await page.getByTestId('dashboard-card-categories').click();

      const categoryName = `Catégorie C ${randomUUID()}`;
      await page.getByTestId('btn-new-category').click();
      await page.getByTestId('input-category-name').fill(categoryName);
      await page.getByTestId('btn-create-category').click();

      await expect(page.getByText(categoryName)).toBeVisible({ timeout: 10000 });

      const customSection = page.locator('[data-testid="category-section-custom"]');
      const customCards = customSection.locator('.category-card');
      await expect(customCards).toHaveCount(1);
      await expect(customCards.first()).toContainText(categoryName);

      const deleteCategoryDialog = page.waitForEvent('dialog');
      await page.getByRole('button', { name: new RegExp(`Supprimer la catégorie ${categoryName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}`) }).click();
      await (await deleteCategoryDialog).accept();
    });

    test('default categories cannot be deleted or renamed', async ({ page, account }) => {
      test.skip(!e2eEnvironment.writesAllowed, writesDisabledReason);
      await createHousehold(page, account);

      await page.getByTestId('dashboard-card-categories').click();

      const defaultCards = page.locator('[data-testid="category-section-default"] .category-card');
      await expect(defaultCards).toHaveCount(10);
      await expect(defaultCards.first().getByTestId('category-edit-button')).toHaveCount(0);
      await expect(defaultCards.first().getByTestId('category-delete-button')).toHaveCount(0);
    });
  });

  test.describe('Items Empty State', () => {
    test('shows empty state with icon and CTA when no items exist (US 81, 84-85)', async ({ page, account }) => {
      test.skip(!e2eEnvironment.writesAllowed, fixtureRequiredReason);
      await createHousehold(page, account);

      await page.getByTestId('dashboard-card-items').click();
      await deleteAllItems(page);

      const emptyState = page.locator('.empty-state');
      await expect(emptyState).toBeVisible();
      await expect(emptyState).toContainText('Aucun article');
      await expect(emptyState).toContainText('Ajoutez votre premier article');

      const icon = emptyState.locator('.empty-state-icon, .empty-icon, [data-testid="empty-state-icon"]');
      await expect(icon).toBeVisible();

      const ctaButton = page.getByTestId('btn-new-item');
      await expect(ctaButton).toBeVisible();
      await expect(ctaButton).toBeEnabled();
    });

    test('add-item button is functional and creates an item', async ({ page, account }) => {
      test.skip(!e2eEnvironment.writesAllowed, writesDisabledReason);
      await createHousehold(page, account);

      await page.getByTestId('dashboard-card-items').click();
      await deleteAllItems(page);

      const emptyState = page.locator('.empty-state');
      await expect(emptyState).toBeVisible();

      const itemName = `Article CTA ${randomUUID()}`;
      await page.getByTestId('btn-new-item').click();
      await page.getByTestId('input-item-name').fill(itemName);
      await page.getByTestId('btn-create-item').click();

      await expect(page.getByText(itemName)).toBeVisible({ timeout: 10000 });
      await expect(emptyState).not.toBeVisible();

      const itemList = page.locator('.item-row');
      await expect(itemList).toHaveCount(1);

      page.once('dialog', (dialog) => dialog.accept());
      await itemList.getByTestId(/^btn-delete-item-/).click();
    });

    test('empty state appears after deleting all items', async ({ page, account }) => {
      test.skip(!e2eEnvironment.writesAllowed, writesDisabledReason);
      await createHousehold(page, account);

      const itemName = `Article X ${randomUUID()}`;
      await page.getByTestId('dashboard-card-items').click();
      await page.getByTestId('btn-new-item').click();
      await page.getByTestId('input-item-name').fill(itemName);
      await page.getByTestId('btn-create-item').click();
      await expect(page.getByText(itemName)).toBeVisible({ timeout: 10000 });

      await deleteAllItems(page);

      const emptyState = page.locator('.empty-state');
      await expect(emptyState).toBeVisible();
      await expect(emptyState).toContainText('Aucun article');
    });
  });

  test.describe('To-Buy Success State', () => {
    test('shows success state when all items are stocked (US 82)', async ({ page, account }) => {
      test.skip(!e2eEnvironment.writesAllowed, fixtureRequiredReason);
      await createHousehold(page, account);

      await page.getByTestId('dashboard-card-items').click();
      await deleteAllItems(page);

      const itemName = `Article stk ${randomUUID()}`;
      await page.getByTestId('btn-new-item').click();
      await page.getByTestId('input-item-name').fill(itemName);
      await page.getByLabel('Quantité', { exact: true }).fill('10');
      await page.getByLabel('Seuil stock bas').fill('5');
      await page.getByTestId('btn-create-item').click();
      await expect(page.getByText(itemName)).toBeVisible({ timeout: 10000 });

      await page.goto('/to-buy');

      const successState = page.locator('.empty-state, .success-state, .all-stocked');
      await expect(successState).toBeVisible();
      await expect(page.getByText('Tout est en stock !')).toBeVisible();
      await expect(page.getByText('Rien à acheter pour le moment')).toBeVisible();

      const icon = successState.locator('.empty-state-icon, .success-icon, [data-testid="empty-state-icon"]');
      await expect(icon).toBeVisible();
    });

    test('to-buy shows items when low stock items exist', async ({ page, account }) => {
      test.skip(!e2eEnvironment.writesAllowed, writesDisabledReason);
      await createHousehold(page, account);

      const itemName = `Article fbl ${randomUUID()}`;
      await page.getByTestId('dashboard-card-items').click();
      await page.getByTestId('btn-new-item').click();
      await page.getByTestId('input-item-name').fill(itemName);
      await page.getByLabel('Quantité', { exact: true }).fill('2');
      await page.getByLabel('Seuil stock bas').fill('5');
      await page.getByTestId('btn-create-item').click();
      await expect(page.getByText(itemName)).toBeVisible({ timeout: 10000 });

      await page.goto('/to-buy');

      await expect(page.getByText(itemName)).toBeVisible();
      await expect(page.getByText('À acheter')).toBeVisible();
    });
  });

  test.describe('Members Empty State Edge Case', () => {
    test('shows appropriate state when household has only one member (US 83)', async ({ page, account }) => {
      test.skip(!e2eEnvironment.writesAllowed, fixtureRequiredReason);
      const householdName = await createHousehold(page, account);

      await page.getByRole('link', { name: /Membres/ }).click();
      await expect(page).toHaveURL('/members');

      await expect(page.getByRole('heading', { name: 'Membres du foyer (1)' })).toBeVisible();

      const memberItems = page.locator('.member-item, .members-list .member');
      await expect(memberItems).toHaveCount(1);

      await expect(page.getByText('Propriétaire')).toBeVisible();

      const createInvitationButton = page.getByRole('button', { name: 'Créer une invitation' });
      await expect(createInvitationButton).toBeVisible();
    });

    test('members list updates when new member joins', async ({ page, account, browser }) => {
      test.skip(!e2eEnvironment.writesAllowed, fixtureRequiredReason);
      const householdName = await createHousehold(page, account);

      await page.getByRole('link', { name: /Membres/ }).click();
      await expect(page.getByRole('heading', { name: 'Membres du foyer (1)' })).toBeVisible();

      await page.getByRole('button', { name: 'Créer une invitation' }).click();
      const token = page.locator('.invite-code-text');
      const invitationToken = await token.textContent();

      const memberContext = await browser.newContext();
      const memberPage = await memberContext.newPage();
      const memberAccount = createAccount('e2e-member-empty');
      try {
        await signUp(memberPage, memberAccount);
        await memberPage.getByLabel(/Code d.invitation complet/).fill(invitationToken!);
        await memberPage.getByRole('button', { name: 'Rejoindre le foyer' }).click();
        await memberPage.waitForURL('/home', { timeout: 20000 });

        await page.reload();
        await expect(page.getByRole('heading', { name: 'Membres du foyer (2)' })).toBeVisible();

        const memberItems = page.locator('.member-item, .members-list .member');
        await expect(memberItems).toHaveCount(2);
      } finally {
        await memberContext.close();
      }
    });
  });

  test.describe('Empty State Localization', () => {
    test('categories page shows the localized default catalog', async ({ page, account }) => {
      test.skip(!e2eEnvironment.writesAllowed, fixtureRequiredReason);
      await createHousehold(page, account);

      await page.getByTestId('dashboard-card-categories').click();

      const defaultSection = page.locator('[data-testid="category-section-default"]');
      await expect(defaultSection).toBeVisible();
      await expect(defaultSection.getByText('Catégories par défaut')).toBeVisible();
      await expect(defaultSection.getByText('Fruits')).toBeVisible();
      await expect(defaultSection.getByText('Légumes')).toBeVisible();
    });

    test('items empty state text is in French and localized', async ({ page, account }) => {
      test.skip(!e2eEnvironment.writesAllowed, fixtureRequiredReason);
      await createHousehold(page, account);

      await page.getByTestId('dashboard-card-items').click();
      await deleteAllItems(page);

      const emptyState = page.locator('.empty-state');
      await expect(emptyState).toContainText('Aucun article');
      await expect(emptyState).toContainText('Ajoutez votre premier article');
    });
  });

  test.describe('Empty State Transitions', () => {
    test('empty state transitions to populated when adding the first item', async ({ page, account }) => {
      test.skip(!e2eEnvironment.writesAllowed, writesDisabledReason);
      await createHousehold(page, account);

      await page.getByTestId('dashboard-card-items').click();
      await deleteAllItems(page);

      const emptyState = page.locator('.empty-state');
      await expect(emptyState).toBeVisible();

      const itemName = `Premier art ${randomUUID()}`;
      await page.getByTestId('btn-new-item').click();
      await page.getByTestId('input-item-name').fill(itemName);
      await page.getByTestId('btn-create-item').click();

      await expect(page.getByText(itemName)).toBeVisible({ timeout: 10000 });
      await expect(emptyState).not.toBeVisible();

      const itemList = page.locator('.items-list, .item-row');
      await expect(itemList).toBeVisible();

      page.once('dialog', (dialog) => dialog.accept());
      await page.locator('.item-row').filter({ hasText: itemName }).getByTestId(/^btn-delete-item-/).click();
    });

    test('populated state transitions to empty after deleting all items', async ({ page, account }) => {
      test.skip(!e2eEnvironment.writesAllowed, writesDisabledReason);
      await createHousehold(page, account);

      const itemName = `Article all ${randomUUID()}`;
      await page.getByTestId('dashboard-card-items').click();
      await page.getByTestId('btn-new-item').click();
      await page.getByTestId('input-item-name').fill(itemName);
      await page.getByTestId('btn-create-item').click();
      await expect(page.getByText(itemName)).toBeVisible({ timeout: 10000 });

      const itemList = page.locator('.item-row');
      await expect(itemList).toBeVisible();

      await deleteAllItems(page);

      const emptyState = page.locator('.empty-state');
      await expect(emptyState).toBeVisible();
      await expect(emptyState).toContainText('Aucun article');
    });
  });
});