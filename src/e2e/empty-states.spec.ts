import { randomUUID } from 'node:crypto';
import { createAccount, createHousehold, expect, signUp, test } from './fixtures';
import {
  e2eEnvironment,
  fixtureRequiredReason,
  writesDisabledReason,
} from './environment';

test.describe('Empty States', () => {
  test.describe('Categories Empty State', () => {
    test('shows empty state with icon and CTA when no categories exist (US 80, 84-85)', async ({ page, account }) => {
      test.skip(!e2eEnvironment.writesAllowed, fixtureRequiredReason);
      await createHousehold(page, account);

      await page.getByTestId('dashboard-card-categories').click();

      const emptyState = page.locator('.empty-state');
      await expect(emptyState).toBeVisible();
      await expect(emptyState).toContainText('Aucune catégorie');
      await expect(emptyState).toContainText('Créez-en une pour commencer');

      const icon = emptyState.locator('.empty-state-icon, .empty-icon, [data-testid="empty-state-icon"]');
      await expect(icon).toBeVisible();

      const ctaButton = page.getByTestId('btn-new-category');
      await expect(ctaButton).toBeVisible();
      await expect(ctaButton).toBeEnabled();
    });

    test('empty state CTA button is functional and creates category', async ({ page, account }) => {
      test.skip(!e2eEnvironment.writesAllowed, writesDisabledReason);
      await createHousehold(page, account);

      await page.getByTestId('dashboard-card-categories').click();

      await expect(page.locator('.empty-state')).toBeVisible();

      const categoryName = `Catégorie depuis CTA ${randomUUID()}`;
      await page.getByTestId('btn-new-category').click();
      await page.getByTestId('input-category-name').fill(categoryName);
      await page.getByTestId('btn-create-category').click();

      await expect(page.getByText(categoryName)).toBeVisible({ timeout: 10000 });
      await expect(page.locator('.empty-state')).not.toBeVisible();

      page.once('dialog', (dialog) => dialog.accept());
      await page.getByRole('button', { name: new RegExp(`Supprimer la catégorie ${categoryName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}`) }).click();
    });

    test('empty state appears after deleting all categories', async ({ page, account }) => {
      test.skip(!e2eEnvironment.writesAllowed, writesDisabledReason);
      await createHousehold(page, account);

      const categoryName = `Catégorie à supprimer ${randomUUID()}`;
      await page.getByTestId('dashboard-card-categories').click();
      await page.getByTestId('btn-new-category').click();
      await page.getByTestId('input-category-name').fill(categoryName);
      await page.getByTestId('btn-create-category').click();
      await expect(page.getByText(categoryName)).toBeVisible({ timeout: 10000 });

      page.once('dialog', (dialog) => dialog.accept());
      await page.getByRole('button', { name: new RegExp(`Supprimer la catégorie ${categoryName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}`) }).click();

      const emptyState = page.locator('.empty-state');
      await expect(emptyState).toBeVisible();
      await expect(emptyState).toContainText('Aucune catégorie');
    });
  });

  test.describe('Items Empty State', () => {
    test('shows empty state with icon and CTA when no items exist (US 81, 84-85)', async ({ page, account }) => {
      test.skip(!e2eEnvironment.writesAllowed, fixtureRequiredReason);
      await createHousehold(page, account);

      await page.getByTestId('dashboard-card-items').click();

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

    test('empty state CTA button is functional and creates item', async ({ page, account }) => {
      test.skip(!e2eEnvironment.writesAllowed, writesDisabledReason);
      await createHousehold(page, account);

      await page.getByTestId('dashboard-card-items').click();

      await expect(page.locator('.empty-state')).toBeVisible();

      const itemName = `Article depuis CTA ${randomUUID()}`;
      await page.getByTestId('btn-new-item').click();
      await page.getByTestId('input-item-name').fill(itemName);
      await page.getByTestId('btn-create-item').click();

      await expect(page.getByText(itemName)).toBeVisible({ timeout: 10000 });
      await expect(page.locator('.empty-state')).not.toBeVisible();

      page.once('dialog', (dialog) => dialog.accept());
      await page.locator('.item-row').filter({ hasText: itemName }).getByTestId(/^btn-delete-item-/).click();
    });

    test('empty state appears after deleting all items', async ({ page, account }) => {
      test.skip(!e2eEnvironment.writesAllowed, writesDisabledReason);
      await createHousehold(page, account);

      const itemName = `Article à supprimer ${randomUUID()}`;
      await page.getByTestId('dashboard-card-items').click();
      await page.getByTestId('btn-new-item').click();
      await page.getByTestId('input-item-name').fill(itemName);
      await page.getByTestId('btn-create-item').click();
      await expect(page.getByText(itemName)).toBeVisible({ timeout: 10000 });

      page.once('dialog', (dialog) => dialog.accept());
      await page.locator('.item-row').filter({ hasText: itemName }).getByTestId(/^btn-delete-item-/).click();

      const emptyState = page.locator('.empty-state');
      await expect(emptyState).toBeVisible();
      await expect(emptyState).toContainText('Aucun article');
    });
  });

  test.describe('To-Buy Success State', () => {
    test('shows success state when all items are stocked (US 82)', async ({ page, account }) => {
      test.skip(!e2eEnvironment.writesAllowed, fixtureRequiredReason);
      await createHousehold(page, account);

      const categoryName = `Catégorie ${randomUUID()}`;
      await page.getByTestId('dashboard-card-categories').click();
      await page.getByTestId('btn-new-category').click();
      await page.getByTestId('input-category-name').fill(categoryName);
      await page.getByTestId('btn-create-category').click();
      await expect(page.getByText(categoryName)).toBeVisible({ timeout: 10000 });

      const itemName = `Article en stock ${randomUUID()}`;
      await page.getByTestId('dashboard-card-items').click();
      await page.getByTestId('btn-new-item').click();
      await page.getByTestId('input-item-name').fill(itemName);
      await page.getByLabel('Quantité').fill('10');
      await page.getByLabel('Seuil stock bas').fill('5');
      await page.getByTestId('btn-create-item').click();
      await expect(page.getByText(itemName)).toBeVisible({ timeout: 10000 });

      await page.getByRole('link', { name: /À acheter/ }).click();

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

      const itemName = `Article faible stock ${randomUUID()}`;
      await page.getByTestId('dashboard-card-items').click();
      await page.getByTestId('btn-new-item').click();
      await page.getByTestId('input-item-name').fill(itemName);
      await page.getByLabel('Quantité').fill('2');
      await page.getByLabel('Seuil stock bas').fill('5');
      await page.getByTestId('btn-create-item').click();
      await expect(page.getByText(itemName)).toBeVisible({ timeout: 10000 });

      await page.getByRole('link', { name: /À acheter/ }).click();

      await expect(page.getByText(itemName)).toBeVisible();
      await expect(page.getByText('À acheter')).toBeVisible();

      page.once('dialog', (dialog) => dialog.accept());
      await page.locator('.item-row').filter({ hasText: itemName }).getByTestId(/^btn-delete-item-/).click();
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
        await page.getByRole('link', { name: /Membres/ }).click();
        await expect(page.getByRole('heading', { name: 'Membres du foyer (2)' })).toBeVisible();

        const memberItems = page.locator('.member-item, .members-list .member');
        await expect(memberItems).toHaveCount(2);
      } finally {
        await memberContext.close();
      }
    });
  });

  test.describe('Empty State Localization', () => {
    test('empty state text is in French and localized', async ({ page, account }) => {
      test.skip(!e2eEnvironment.writesAllowed, fixtureRequiredReason);
      await createHousehold(page, account);

      await page.getByTestId('dashboard-card-categories').click();

      const emptyState = page.locator('.empty-state');
      await expect(emptyState).toContainText('Aucune catégorie');
      await expect(emptyState).toContainText('Créez-en une pour commencer');
    });

    test('items empty state text is in French and localized', async ({ page, account }) => {
      test.skip(!e2eEnvironment.writesAllowed, fixtureRequiredReason);
      await createHousehold(page, account);

      await page.getByTestId('dashboard-card-items').click();

      const emptyState = page.locator('.empty-state');
      await expect(emptyState).toContainText('Aucun article');
      await expect(emptyState).toContainText('Ajoutez votre premier article');
    });
  });

  test.describe('Empty State Transitions', () => {
    test('empty state transitions to populated when adding first item', async ({ page, account }) => {
      test.skip(!e2eEnvironment.writesAllowed, writesDisabledReason);
      await createHousehold(page, account);

      await page.getByTestId('dashboard-card-items').click();

      const emptyState = page.locator('.empty-state');
      await expect(emptyState).toBeVisible();

      const itemName = `Premier article ${randomUUID()}`;
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

      const itemName = `Article à tout supprimer ${randomUUID()}`;
      await page.getByTestId('dashboard-card-items').click();
      await page.getByTestId('btn-new-item').click();
      await page.getByTestId('input-item-name').fill(itemName);
      await page.getByTestId('btn-create-item').click();
      await expect(page.getByText(itemName)).toBeVisible({ timeout: 10000 });

      const itemList = page.locator('.item-row');
      await expect(itemList).toBeVisible();

      page.once('dialog', (dialog) => dialog.accept());
      await page.locator('.item-row').filter({ hasText: itemName }).getByTestId(/^btn-delete-item-/).click();

      const emptyState = page.locator('.empty-state');
      await expect(emptyState).toBeVisible();
      await expect(emptyState).toContainText('Aucun article');
    });
  });
});