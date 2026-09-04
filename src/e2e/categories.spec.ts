import { randomUUID } from 'node:crypto';
import { createAccount, createHousehold, expect, signUp, test } from './fixtures';
import {
  e2eEnvironment,
  fixtureRequiredReason,
  writesDisabledReason,
} from './environment';

const ICONS = ['📦', '🥦', '🥛', '🥖', '🍖', '🥫', '🧼', '🧊', '🍪', '🥩', '🐟', '🧀', '🍎', '🍌', '🥕', '🌽'];

test.describe('Categories CRUD', () => {
  test.describe('Create Category', () => {
    test('shows error message on create failure', async ({ page, account }) => {
      test.skip(!e2eEnvironment.writesAllowed, writesDisabledReason);
      await createHousehold(page, account);

      await page.getByTestId('dashboard-card-categories').click();
      await page.getByTestId('btn-new-category').click();
      await page.getByTestId('input-category-name').fill('');
      await page.getByTestId('btn-create-category').click();

      await expect(page.getByRole('alert')).toBeVisible();
    });

    test('validates empty name submission', async ({ page, account }) => {
      test.skip(!e2eEnvironment.writesAllowed, writesDisabledReason);
      await createHousehold(page, account);

      await page.getByTestId('dashboard-card-categories').click();
      await page.getByTestId('btn-new-category').click();
      await page.getByTestId('input-category-name').fill('');
      await page.getByTestId('btn-create-category').click();

      await expect(page.getByRole('alert')).toBeVisible();
    });

    test('validates whitespace-only name handling', async ({ page, account }) => {
      test.skip(!e2eEnvironment.writesAllowed, writesDisabledReason);
      await createHousehold(page, account);

      await page.getByTestId('dashboard-card-categories').click();
      await page.getByTestId('btn-new-category').click();
      await page.getByTestId('input-category-name').fill('   ');
      await page.getByTestId('btn-create-category').click();

      await expect(page.getByRole('alert')).toBeVisible();
    });

    test('validates icon selection and display', async ({ page, account }) => {
      test.skip(!e2eEnvironment.writesAllowed, writesDisabledReason);
      await createHousehold(page, account);

      const categoryName = `Catégorie icône ${randomUUID()}`;
      await page.getByTestId('dashboard-card-categories').click();
      await page.getByTestId('btn-new-category').click();
      await page.getByTestId('input-category-name').fill(categoryName);

      const iconToSelect = '🥦';
      await page.getByRole('button', { name: `Choisir l'icône ${iconToSelect}` }).click();
      await page.getByTestId('btn-create-category').click();

      await expect(page.getByText(categoryName)).toBeVisible({ timeout: 10000 });
      const categoryCard = page.locator('.category-card').filter({ hasText: categoryName });
      await expect(categoryCard.locator('.category-icon')).toContainText(iconToSelect);

      page.once('dialog', (dialog) => dialog.accept());
      await page.getByRole('button', { name: new RegExp(`Supprimer la catégorie ${categoryName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}`) }).click();
    });
  });

  test.describe('Edit Category', () => {
    test('can edit category name (US 34)', async ({ page, account }) => {
      test.skip(!e2eEnvironment.writesAllowed, writesDisabledReason);
      await createHousehold(page, account);

      const originalName = `Catégorie ${randomUUID()}`;
      const newName = `Catégorie modifiée ${randomUUID()}`;

      await page.getByTestId('dashboard-card-categories').click();
      await page.getByTestId('btn-new-category').click();
      await page.getByTestId('input-category-name').fill(originalName);
      await page.getByTestId('btn-create-category').click();
      await expect(page.getByText(originalName)).toBeVisible({ timeout: 10000 });

      const categoryCard = page.locator('.category-card').filter({ hasText: originalName });
      await categoryCard.getByRole('button', { name: /Modifier la catégorie/ }).click();

      await expect(page.getByTestId('input-category-name')).toHaveValue(originalName);
      await page.getByTestId('input-category-name').fill(newName);
      await page.getByTestId('btn-create-category').click();

      await expect(page.getByText(newName)).toBeVisible();
      await expect(page.getByText(originalName)).toHaveCount(0);

      page.once('dialog', (dialog) => dialog.accept());
      await page.getByRole('button', { name: new RegExp(`Supprimer la catégorie ${newName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}`) }).click();
    });

    test('can edit category icon (US 34)', async ({ page, account }) => {
      test.skip(!e2eEnvironment.writesAllowed, writesDisabledReason);
      await createHousehold(page, account);

      const categoryName = `Catégorie ${randomUUID()}`;
      await page.getByTestId('dashboard-card-categories').click();
      await page.getByTestId('btn-new-category').click();
      await page.getByTestId('input-category-name').fill(categoryName);
      await page.getByTestId('btn-create-category').click();
      await expect(page.getByText(categoryName)).toBeVisible({ timeout: 10000 });

      const categoryCard = page.locator('.category-card').filter({ hasText: categoryName });
      const originalIcon = await categoryCard.locator('.category-icon').textContent();
      await categoryCard.getByRole('button', { name: /Modifier la catégorie/ }).click();

      const newIcon = '🥦';
      await page.getByRole('button', { name: `Choisir l'icône ${newIcon}` }).click();
      await page.getByTestId('btn-create-category').click();

      await expect(categoryCard.locator('.category-icon')).toContainText(newIcon);
      expect(originalIcon).not.toBe(newIcon);

      page.once('dialog', (dialog) => dialog.accept());
      await page.getByRole('button', { name: new RegExp(`Supprimer la catégorie ${categoryName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}`) }).click();
    });

    test('preserves category order after edit', async ({ page, account }) => {
      test.skip(!e2eEnvironment.writesAllowed, writesDisabledReason);
      await createHousehold(page, account);

      const cat1 = `Catégorie A ${randomUUID()}`;
      const cat2 = `Catégorie B ${randomUUID()}`;
      const cat3 = `Catégorie C ${randomUUID()}`;

      await page.getByTestId('dashboard-card-categories').click();

      await page.getByTestId('btn-new-category').click();
      await page.getByTestId('input-category-name').fill(cat1);
      await page.getByTestId('btn-create-category').click();
      await expect(page.getByText(cat1)).toBeVisible({ timeout: 10000 });

      await page.getByTestId('btn-new-category').click();
      await page.getByTestId('input-category-name').fill(cat2);
      await page.getByTestId('btn-create-category').click();
      await expect(page.getByText(cat2)).toBeVisible({ timeout: 10000 });

      await page.getByTestId('btn-new-category').click();
      await page.getByTestId('input-category-name').fill(cat3);
      await page.getByTestId('btn-create-category').click();
      await expect(page.getByText(cat3)).toBeVisible({ timeout: 10000 });

      const cards = page.locator('.category-card');
      await expect(cards).toHaveCount(3);
      const firstCard = cards.nth(0);
      await expect(firstCard).toContainText(cat1);

      const cat2Card = cards.filter({ hasText: cat2 });
      await cat2Card.getByRole('button', { name: /Modifier la catégorie/ }).click();
      await page.getByTestId('input-category-name').fill(`${cat2} modifié`);
      await page.getByTestId('btn-create-category').click();

      const cardsAfter = page.locator('.category-card');
      await expect(cardsAfter).toHaveCount(3);
      await expect(cardsAfter.nth(0)).toContainText(cat1);
      await expect(cardsAfter.nth(1)).toContainText(`${cat2} modifié`);
      await expect(cardsAfter.nth(2)).toContainText(cat3);

      page.once('dialog', (dialog) => dialog.accept());
      await page.getByRole('button', { name: new RegExp(`Supprimer la catégorie ${cat1}`) }).click();
      page.once('dialog', (dialog) => dialog.accept());
      await page.getByRole('button', { name: new RegExp(`Supprimer la catégorie ${cat2} modifié`) }).click();
      page.once('dialog', (dialog) => dialog.accept());
      await page.getByRole('button', { name: new RegExp(`Supprimer la catégorie ${cat3}`) }).click();
    });
  });

  test.describe('Delete Category', () => {
    test('shows confirmation dialog before deleting (US 35)', async ({ page, account }) => {
      test.skip(!e2eEnvironment.writesAllowed, writesDisabledReason);
      await createHousehold(page, account);

      const categoryName = `Catégorie ${randomUUID()}`;
      await page.getByTestId('dashboard-card-categories').click();
      await page.getByTestId('btn-new-category').click();
      await page.getByTestId('input-category-name').fill(categoryName);
      await page.getByTestId('btn-create-category').click();
      await expect(page.getByText(categoryName)).toBeVisible({ timeout: 10000 });

      let dialogShown = false;
      page.on('dialog', async (dialog) => {
        dialogShown = true;
        expect(dialog.message()).toContain('Supprimer');
        await dialog.accept();
      });

      await page.getByRole('button', { name: new RegExp(`Supprimer la catégorie ${categoryName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}`) }).click();
      expect(dialogShown).toBe(true);
      await expect(page.getByText(categoryName)).toHaveCount(0);
    });

    test('shows error message on delete failure (US 37)', async ({ page, account }) => {
      test.skip(!e2eEnvironment.writesAllowed, writesDisabledReason);
      await createHousehold(page, account);

      const categoryName = `Catégorie erreur ${randomUUID()}`;
      await page.getByTestId('dashboard-card-categories').click();
      await page.getByTestId('btn-new-category').click();
      await page.getByTestId('input-category-name').fill(categoryName);
      await page.getByTestId('btn-create-category').click();
      await expect(page.getByText(categoryName)).toBeVisible({ timeout: 10000 });

      page.on('dialog', async (dialog) => {
        await dialog.accept();
      });

      await page.getByRole('button', { name: new RegExp(`Supprimer la catégorie ${categoryName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}`) }).click();

      await expect(page.getByRole('alert')).toBeVisible();
    });

    test('preserves category order after delete', async ({ page, account }) => {
      test.skip(!e2eEnvironment.writesAllowed, writesDisabledReason);
      await createHousehold(page, account);

      const cat1 = `Catégorie A ${randomUUID()}`;
      const cat2 = `Catégorie B ${randomUUID()}`;
      const cat3 = `Catégorie C ${randomUUID()}`;

      await page.getByTestId('dashboard-card-categories').click();

      await page.getByTestId('btn-new-category').click();
      await page.getByTestId('input-category-name').fill(cat1);
      await page.getByTestId('btn-create-category').click();
      await expect(page.getByText(cat1)).toBeVisible({ timeout: 10000 });

      await page.getByTestId('btn-new-category').click();
      await page.getByTestId('input-category-name').fill(cat2);
      await page.getByTestId('btn-create-category').click();
      await expect(page.getByText(cat2)).toBeVisible({ timeout: 10000 });

      await page.getByTestId('btn-new-category').click();
      await page.getByTestId('input-category-name').fill(cat3);
      await page.getByTestId('btn-create-category').click();
      await expect(page.getByText(cat3)).toBeVisible({ timeout: 10000 });

      page.once('dialog', (dialog) => dialog.accept());
      await page.getByRole('button', { name: new RegExp(`Supprimer la catégorie ${cat2.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}`) }).click();

      const cardsAfter = page.locator('.category-card');
      await expect(cardsAfter).toHaveCount(2);
      await expect(cardsAfter.nth(0)).toContainText(cat1);
      await expect(cardsAfter.nth(1)).toContainText(cat3);

      page.once('dialog', (dialog) => dialog.accept());
      await page.getByRole('button', { name: new RegExp(`Supprimer la catégorie ${cat1}`) }).click();
      page.once('dialog', (dialog) => dialog.accept());
      await page.getByRole('button', { name: new RegExp(`Supprimer la catégorie ${cat3}`) }).click();
    });
  });

  test.describe('Empty State', () => {
    test('shows empty state with call-to-action when no categories exist (US 33, 80)', async ({ page, account }) => {
      test.skip(!e2eEnvironment.writesAllowed, fixtureRequiredReason);
      await createHousehold(page, account);

      await page.getByTestId('dashboard-card-categories').click();

      await expect(page.locator('.empty-state')).toBeVisible();
      await expect(page.locator('.empty-state')).toContainText('Aucune catégorie');
      await expect(page.locator('.empty-state')).toContainText('Créez-en une pour commencer');
      await expect(page.getByTestId('btn-new-category')).toBeVisible();
    });
  });

  test.describe('Real-time Updates', () => {
    test('updates in real-time when categories change', async ({ page, account, browser }) => {
      test.skip(!e2eEnvironment.writesAllowed, fixtureRequiredReason);
      await createHousehold(page, account);

      const categoryName = `Catégorie realtime ${randomUUID()}`;
      await page.getByTestId('dashboard-card-categories').click();
      await page.getByTestId('btn-new-category').click();
      await page.getByTestId('input-category-name').fill(categoryName);
      await page.getByTestId('btn-create-category').click();
      await expect(page.getByText(categoryName)).toBeVisible({ timeout: 10000 });

      const secondContext = await browser.newContext();
      const secondPage = await secondContext.newPage();
      const secondAccount = createAccount('e2e-realtime-cat');
      await signUp(secondPage, secondAccount);

      await secondPage.getByLabel(/Code d.invitation complet/).fill('');
      await secondPage.waitForTimeout(500);

      const inviteLink = page.locator('.invite-code-text');
      if (await inviteLink.isVisible()) {
        const token = await inviteLink.textContent();
        await secondPage.getByLabel(/Code d.invitation complet/).fill(token || '');
        await secondPage.getByRole('button', { name: 'Rejoindre le foyer' }).click();
        await secondPage.waitForURL('/home', { timeout: 20000 });

        await secondPage.getByTestId('dashboard-card-categories').click();
        await expect(secondPage.getByText(categoryName)).toBeVisible({ timeout: 10000 });

        const newCategoryName = `Catégorie realtime 2 ${randomUUID()}`;
        await secondPage.getByTestId('btn-new-category').click();
        await secondPage.getByTestId('input-category-name').fill(newCategoryName);
        await secondPage.getByTestId('btn-create-category').click();
        await expect(secondPage.getByText(newCategoryName)).toBeVisible({ timeout: 10000 });

        await expect(page.getByText(newCategoryName)).toBeVisible({ timeout: 10000 });
      }

      await secondContext.close();

      page.once('dialog', (dialog) => dialog.accept());
      await page.getByRole('button', { name: new RegExp(`Supprimer la catégorie ${categoryName}`) }).click();
    });
  });

  test.describe('Category Order', () => {
    test('preserves order after creating multiple categories', async ({ page, account }) => {
      test.skip(!e2eEnvironment.writesAllowed, writesDisabledReason);
      await createHousehold(page, account);

      const cat1 = `Catégorie Z ${randomUUID()}`;
      const cat2 = `Catégorie A ${randomUUID()}`;
      const cat3 = `Catégorie M ${randomUUID()}`;

      await page.getByTestId('dashboard-card-categories').click();

      await page.getByTestId('btn-new-category').click();
      await page.getByTestId('input-category-name').fill(cat1);
      await page.getByTestId('btn-create-category').click();
      await expect(page.getByText(cat1)).toBeVisible({ timeout: 10000 });

      await page.getByTestId('btn-new-category').click();
      await page.getByTestId('input-category-name').fill(cat2);
      await page.getByTestId('btn-create-category').click();
      await expect(page.getByText(cat2)).toBeVisible({ timeout: 10000 });

      await page.getByTestId('btn-new-category').click();
      await page.getByTestId('input-category-name').fill(cat3);
      await page.getByTestId('btn-create-category').click();
      await expect(page.getByText(cat3)).toBeVisible({ timeout: 10000 });

      const cards = page.locator('.category-card');
      await expect(cards).toHaveCount(3);
      await expect(cards.nth(0)).toContainText(cat1);
      await expect(cards.nth(1)).toContainText(cat2);
      await expect(cards.nth(2)).toContainText(cat3);

      page.once('dialog', (dialog) => dialog.accept());
      await page.getByRole('button', { name: new RegExp(`Supprimer la catégorie ${cat1}`) }).click();
      page.once('dialog', (dialog) => dialog.accept());
      await page.getByRole('button', { name: new RegExp(`Supprimer la catégorie ${cat2}`) }).click();
      page.once('dialog', (dialog) => dialog.accept());
      await page.getByRole('button', { name: new RegExp(`Supprimer la catégorie ${cat3}`) }).click();
    });
  });
});