import { randomUUID } from 'node:crypto';
import type { Locator, Page } from '@playwright/test';
import { createAccount, createHousehold, expect, signUp, test } from './fixtures';
import {
  e2eEnvironment,
  fixtureRequiredReason,
  writesDisabledReason,
} from './environment';

// Pointer drag one card down: the pointer position drives collision
// directly, so ending over the next card's center lands the drop there
// deterministically. Gated on the active card's displacement so the drop
// never fires before the drag is armed (distance-5 activation).
async function pointerDragDownOne(page: Page, cards: Locator, index: number): Promise<void> {
  const handle = cards.nth(index).getByTestId('category-drag-handle');
  const card = cards.nth(index);
  const from = await handle.boundingBox();
  const target = await cards.nth(index + 1).boundingBox();
  expect(from).not.toBeNull();
  expect(target).not.toBeNull();
  if (!from || !target) throw new Error('drag boxes not measurable');
  const restTransform = await card.evaluate((el) => (el as HTMLElement).style.transform || '');
  await page.mouse.move(from.x + from.width / 2, from.y + from.height / 2);
  await page.mouse.down();
  await page.mouse.move(target.x + target.width / 2, target.y + target.height / 2, { steps: 15 });
  await expect
    .poll(async () => card.evaluate((el) => (el as HTMLElement).style.transform || ''), {
      timeout: 10000,
    })
    .not.toBe(restTransform);
  await page.mouse.up();
}

test.describe('Categories CRUD', () => {
  test.describe('Create Category', () => {
    test('shows error message on create failure', async ({ page, account }) => {
      test.skip(!e2eEnvironment.writesAllowed, writesDisabledReason);
      await createHousehold(page, account);

      const categoryName = `Catégorie E ${randomUUID()}`;
      await page.getByTestId('dashboard-card-categories').click();
      await page.getByTestId('btn-new-category').click();
      await page.getByTestId('input-category-name').fill(categoryName);

      await page.route('**/rest/v1/categories**', async (route) => {
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
      await page.getByTestId('btn-create-category').click();

      await expect(page.locator('.auth-error')).toBeVisible();
    });

    test('validates duplicate category name', async ({ page, account }) => {
      test.skip(!e2eEnvironment.writesAllowed, writesDisabledReason);
      await createHousehold(page, account);

      const categoryName = `Catégorie D ${randomUUID()}`;
      await page.getByTestId('dashboard-card-categories').click();
      await page.getByTestId('btn-new-category').click();
      await page.getByTestId('input-category-name').fill(categoryName);
      await page.getByTestId('btn-create-category').click();
      await expect(page.getByText(categoryName)).toBeVisible({ timeout: 10000 });

      await page.getByTestId('btn-new-category').click();
      await page.getByTestId('input-category-name').fill(categoryName);
      await page.getByTestId('btn-create-category').click();

      await expect(page.getByTestId('error-name-duplicate')).toBeVisible();

      page.once('dialog', (dialog) => dialog.accept());
      await page.getByRole('button', { name: new RegExp(`Supprimer la catégorie ${categoryName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}`) }).click();
    });

    test('validates maximum name length', async ({ page, account }) => {
      test.skip(!e2eEnvironment.writesAllowed, writesDisabledReason);
      await createHousehold(page, account);

      const tooLongName = 'Catégorie avec un nom vraiment beaucoup trop long pour dépasser la limite de cinquante caractères';
      await page.getByTestId('dashboard-card-categories').click();
      await page.getByTestId('btn-new-category').click();
      await page.getByTestId('input-category-name').fill(tooLongName);
      await page.getByTestId('btn-create-category').click();

      await expect(page.getByTestId('error-name-too-long')).toBeVisible();
    });

    test('displays default and custom category icons', async ({ page, account }) => {
      test.skip(!e2eEnvironment.writesAllowed, writesDisabledReason);
      await createHousehold(page, account);

      await page.getByTestId('dashboard-card-categories').click();

      const defaultSection = page.locator('[data-testid="category-section-default"]');
      await expect(defaultSection).toBeVisible();
      await expect(defaultSection.locator('.category-card').filter({ hasText: 'Légumes' }).locator('.category-icon')).toContainText('🥬');
      await expect(defaultSection.locator('.category-card').filter({ hasText: 'Fruits' }).locator('.category-icon')).toContainText('🍎');

      const categoryName = `Ma catégorie ${randomUUID()}`;
      await page.getByTestId('btn-new-category').click();
      await page.getByTestId('input-category-name').fill(categoryName);
      await page.getByTestId('btn-create-category').click();
      await expect(page.getByText(categoryName)).toBeVisible({ timeout: 10000 });

      // The custom section only renders once at least one custom category
      // exists, so it can only be asserted after creating one.
      const customSection = page.locator('[data-testid="category-section-custom"]');
      await expect(customSection).toBeVisible();

      const categoryCard = customSection.locator('.category-card').filter({ hasText: categoryName });
      await expect(categoryCard.locator('.category-icon')).toContainText('📦');

      page.once('dialog', (dialog) => dialog.accept());
      await page.getByRole('button', { name: new RegExp(`Supprimer la catégorie ${categoryName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}`) }).click();
    });
  });

  test.describe('Edit Category', () => {
    test('can edit category name (US 34)', async ({ page, account }) => {
      test.skip(!e2eEnvironment.writesAllowed, writesDisabledReason);
      await createHousehold(page, account);

      const originalName = `Catégorie ${randomUUID()}`;
      const newName = `Catégorie v2 ${randomUUID()}`;

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

    test('default categories cannot be edited or deleted', async ({ page, account }) => {
      test.skip(!e2eEnvironment.writesAllowed, writesDisabledReason);
      await createHousehold(page, account);

      await page.getByTestId('dashboard-card-categories').click();

      const defaultCards = page.locator('[data-testid="category-section-default"] .category-card');
      await expect(defaultCards).toHaveCount(10);
      await expect(defaultCards.first().getByTestId('category-edit-button')).toHaveCount(0);
      await expect(defaultCards.first().getByTestId('category-delete-button')).toHaveCount(0);
    });

    test('preserves category order after edit', async ({ page, account }) => {
      test.skip(!e2eEnvironment.writesAllowed, writesDisabledReason);
      await createHousehold(page, account);

      const cat1 = `Catégorie A ${randomUUID()}`;
      const cat2 = `Catégorie B ${randomUUID()}`;
      const cat3 = `Catégorie C ${randomUUID()}`;
      const cat2Edited = `Catégorie Q ${randomUUID()}`;

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

      const customSection = page.locator('[data-testid="category-section-custom"]');
      const cards = customSection.locator('.category-card');
      await expect(cards).toHaveCount(3);
      await expect(cards.nth(0)).toContainText(cat1);

      const cat2Card = cards.filter({ hasText: cat2 });
      await cat2Card.getByRole('button', { name: /Modifier la catégorie/ }).click();
      await page.getByTestId('input-category-name').fill(cat2Edited);
      await page.getByTestId('btn-create-category').click();

      const cardsAfter = customSection.locator('.category-card');
      await expect(cardsAfter).toHaveCount(3);
      await expect(cardsAfter.nth(0)).toContainText(cat1);
      await expect(cardsAfter.nth(1)).toContainText(cat2Edited);
      await expect(cardsAfter.nth(2)).toContainText(cat3);

      page.on('dialog', (dialog) => void dialog.accept());
      await page.getByRole('button', { name: new RegExp(`Supprimer la catégorie ${cat1.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}`) }).click();
      await page.getByRole('button', { name: new RegExp(`Supprimer la catégorie ${cat2Edited.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}`) }).click();
      await page.getByRole('button', { name: new RegExp(`Supprimer la catégorie ${cat3.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}`) }).click();
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

      const dialogPromise = page.waitForEvent('dialog');
      await page.getByRole('button', { name: new RegExp(`Supprimer la catégorie ${categoryName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}`) }).click();
      const dialog = await dialogPromise;
      expect(dialog.message()).toContain('Supprimer');
      await dialog.accept();
      await expect(page.getByText(categoryName)).toHaveCount(0);
    });

    test('shows error message on delete failure (US 37)', async ({ page, account }) => {
      test.skip(!e2eEnvironment.writesAllowed, writesDisabledReason);
      await createHousehold(page, account);

      const categoryName = `Catégorie E ${randomUUID()}`;
      await page.getByTestId('dashboard-card-categories').click();
      await page.getByTestId('btn-new-category').click();
      await page.getByTestId('input-category-name').fill(categoryName);
      await page.getByTestId('btn-create-category').click();
      await expect(page.getByText(categoryName)).toBeVisible({ timeout: 10000 });

      await page.route('**/rest/v1/categories**', async (route) => {
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
      await page.getByRole('button', { name: new RegExp(`Supprimer la catégorie ${categoryName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}`) }).click();

      await expect(page.locator('.auth-error')).toBeVisible();
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

      page.on('dialog', (dialog) => void dialog.accept());
      await page.getByRole('button', { name: new RegExp(`Supprimer la catégorie ${cat2.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}`) }).click();

      const customSection = page.locator('[data-testid="category-section-custom"]');
      const cardsAfter = customSection.locator('.category-card');
      await expect(cardsAfter).toHaveCount(2);
      await expect(cardsAfter.nth(0)).toContainText(cat1);
      await expect(cardsAfter.nth(1)).toContainText(cat3);

      await page.getByRole('button', { name: new RegExp(`Supprimer la catégorie ${cat1}`) }).click();
      await page.getByRole('button', { name: new RegExp(`Supprimer la catégorie ${cat3}`) }).click();
    });
  });

  test.describe('Empty State', () => {
    test('shows the default catalog for a new household (US 33, 80)', async ({ page, account }) => {
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
  });

  test.describe('Real-time Updates', () => {
    test('updates in real-time when categories change', async ({ page, account, browser }) => {
      test.skip(!e2eEnvironment.writesAllowed, fixtureRequiredReason);
      await createHousehold(page, account);

      const categoryName = `Catégorie rt ${randomUUID()}`;
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

        const newCategoryName = `Catégorie rt2 ${randomUUID()}`;
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

      const customSection = page.locator('[data-testid="category-section-custom"]');
      const cards = customSection.locator('.category-card');
      await expect(cards).toHaveCount(3);
      await expect(cards.nth(0)).toContainText(cat1);
      await expect(cards.nth(1)).toContainText(cat2);
      await expect(cards.nth(2)).toContainText(cat3);

      page.on('dialog', (dialog) => void dialog.accept());
      await page.getByRole('button', { name: new RegExp(`Supprimer la catégorie ${cat1}`) }).click();
      await page.getByRole('button', { name: new RegExp(`Supprimer la catégorie ${cat2}`) }).click();
      await page.getByRole('button', { name: new RegExp(`Supprimer la catégorie ${cat3}`) }).click();
    });
  });

  test.describe('Seed Categories Bilingual (P1-13, #107)', () => {
    test('new household lists the 10 default seed categories with French names', async ({
      page,
      account,
    }) => {
      test.skip(!e2eEnvironment.writesAllowed, writesDisabledReason);
      await createHousehold(page, account);

      await page.getByTestId('dashboard-card-categories').click();

      const defaultSection = page.locator('[data-testid="category-section-default"]');
      await expect(defaultSection).toBeVisible();
      await expect(defaultSection.locator('.category-card')).toHaveCount(10);

      // Default rows snapshot the French seed names (EN names live in the
      // default_categories.name_en seed column, verified at DB level — Scope A).
      for (const name of [
        'Fruits',
        'Légumes',
        'Produits laitiers',
        'Viandes et poissons',
        'Féculents',
        'Épicerie',
        'Boissons',
        'Surgelés',
        'Hygiène',
        'Entretien',
      ]) {
        await expect(defaultSection.getByText(name, { exact: true })).toBeVisible();
      }
    });
  });

  test.describe('Category Field Validation (P1-7, #107)', () => {
    test('rejects a category name without any letter', async ({ page, account }) => {
      test.skip(!e2eEnvironment.writesAllowed, writesDisabledReason);
      await createHousehold(page, account);

      await page.getByTestId('dashboard-card-categories').click();
      await page.getByTestId('btn-new-category').click();
      await page.getByTestId('input-category-name').fill('12345');
      await page.getByTestId('btn-create-category').click();

      await expect(page.getByTestId('error-name-required-letter')).toBeVisible();
    });

    test('rejects a case-insensitive duplicate category name', async ({ page, account }) => {
      test.skip(!e2eEnvironment.writesAllowed, writesDisabledReason);
      await createHousehold(page, account);

      const baseName = `Catdup ${randomUUID().slice(0, 8)}`;
      await page.getByTestId('dashboard-card-categories').click();
      await page.getByTestId('btn-new-category').click();
      await page.getByTestId('input-category-name').fill(baseName);
      await page.getByTestId('btn-create-category').click();
      await expect(page.getByText(baseName)).toBeVisible({ timeout: 10000 });

      await page.getByTestId('btn-new-category').click();
      await page.getByTestId('input-category-name').fill(baseName.toLowerCase());
      await page.getByTestId('btn-create-category').click();

      await expect(page.getByTestId('error-name-duplicate')).toBeVisible();

      page.once('dialog', (dialog) => dialog.accept());
      await page
        .getByRole('button', { name: new RegExp(`Supprimer la catégorie ${baseName}`) })
        .click();
    });
  });

  test.describe('Delete Blocked When Not Empty (#107)', () => {
    test('shows the move-or-delete message instead of deleting', async ({ page, account }) => {
      test.skip(!e2eEnvironment.writesAllowed, writesDisabledReason);
      await createHousehold(page, account);

      const categoryName = `Catégorie pleine ${randomUUID().slice(0, 8)}`;
      await page.getByTestId('dashboard-card-categories').click();
      await page.getByTestId('btn-new-category').click();
      await page.getByTestId('input-category-name').fill(categoryName);
      await page.getByTestId('btn-create-category').click();
      await expect(page.getByText(categoryName)).toBeVisible({ timeout: 10000 });

      const itemName = `Article range ${randomUUID().slice(0, 8)}`;
      await page.goto('/home');
      await page.getByTestId('dashboard-card-items').click();
      await page.getByTestId('btn-new-item').click();
      await page.getByTestId('input-item-name').fill(itemName);
      await page.locator('#item-category').selectOption({ label: categoryName });
      await page.getByTestId('btn-create-item').click();
      await expect(page.getByText(itemName)).toBeVisible({ timeout: 10000 });

      await page.goto('/home');
      await page.getByTestId('dashboard-card-categories').click();
      await page
        .getByRole('button', { name: new RegExp(`Supprimer la catégorie ${categoryName}`) })
        .click();

      await expect(page.getByTestId('category-delete-blocked-message')).toBeVisible();
      await expect(page.getByTestId('error-category-not-empty')).toContainText(
        'Déplacez ou supprimez',
      );
      await expect(page.getByText(categoryName)).toBeVisible();

      await page.goto('/home');
      await page.getByTestId('dashboard-card-items').click();
      const itemRow = page.locator('.item-row').filter({ hasText: itemName });
      page.once('dialog', (dialog) => dialog.accept());
      await itemRow.getByTestId(/^btn-delete-item-/).click();

      await page.goto('/home');
      await page.getByTestId('dashboard-card-categories').click();
      page.once('dialog', (dialog) => dialog.accept());
      await page
        .getByRole('button', { name: new RegExp(`Supprimer la catégorie ${categoryName}`) })
        .click();
      await expect(page.getByText(categoryName)).toHaveCount(0);
    });
  });

  test.describe('Custom Order via Drag and Drop (#113)', () => {
    test('keyboard lifts and cancels a drag without changing order', async ({ page, account }) => {
      test.skip(!e2eEnvironment.writesAllowed, writesDisabledReason);
      await createHousehold(page, account);

      await page.getByTestId('dashboard-card-categories').click();
      const cards = page.locator('[data-testid="category-section-default"] .category-card');
      await expect(cards).toHaveCount(10);
      const names = (locator: Locator): Promise<string[]> =>
        locator.locator('.category-name').allInnerTexts();
      const before = await names(cards);

      // Keyboard operability (dnd-kit): the handle is Tab-reachable, Space
      // lifts (aria-pressed + screen-reader announcement wired), Escape
      // cancels with the order untouched. Pointer drag below covers moving.
      const handle = cards.nth(0).getByTestId('category-drag-handle');
      await handle.focus();
      await expect(handle).toBeFocused();
      await page.keyboard.press('Space');
      await expect(handle).toHaveAttribute('aria-pressed', 'true', { timeout: 10000 });
      await expect
        .poll(
          async () =>
            page.evaluate(() =>
              [...document.querySelectorAll('[aria-live]')]
                .map((region) => region.textContent ?? '')
                .join(' '),
            ),
          { timeout: 10000 },
        )
        .not.toBe('');
      await page.keyboard.press('Escape');
      await expect(handle).not.toHaveAttribute('aria-pressed', 'true');
      await expect.poll(() => names(cards), { timeout: 10000 }).toEqual(before);
    });

    test('pointer drag reorders categories and persists after reload', async ({ page, account }) => {
      test.skip(!e2eEnvironment.writesAllowed, writesDisabledReason);
      await createHousehold(page, account);

      await page.getByTestId('dashboard-card-categories').click();
      const cards = page.locator('[data-testid="category-section-default"] .category-card');
      await expect(cards).toHaveCount(10);
      const names = (locator: Locator): Promise<string[]> =>
        locator.locator('.category-name').allInnerTexts();

      const before = await names(cards);
      await pointerDragDownOne(page, cards, 0);
      const after = await names(cards);
      expect(after[0]).toBe(before[1]);
      expect(after[1]).toBe(before[0]);

      // Same persistence path for custom categories (position per household).
      const customA = `Catordre A ${randomUUID().slice(0, 8)}`;
      const customB = `Catordre B ${randomUUID().slice(0, 8)}`;
      for (const name of [customA, customB]) {
        await page.getByTestId('btn-new-category').click();
        await page.getByTestId('input-category-name').fill(name);
        await page.getByTestId('btn-create-category').click();
        await expect(page.getByText(name)).toBeVisible({ timeout: 10000 });
      }
      const customCards = page.locator('[data-testid="category-section-custom"] .category-card');
      await expect(customCards).toHaveCount(2);
      await pointerDragDownOne(page, customCards, 0);
      const customAfter = await names(customCards);
      expect(customAfter[0]).toBe(customB);
      expect(customAfter[1]).toBe(customA);

      // The new order survives a reload: positions persisted per household.
      await page.reload();
      await expect.poll(() => names(cards), { timeout: 10000 }).toEqual(after);
      await expect.poll(() => names(customCards), { timeout: 10000 }).toEqual(customAfter);

      page.once('dialog', (dialog) => dialog.accept());
      await page.getByRole('button', { name: new RegExp(`Supprimer la catégorie ${customA}`) }).click();
      page.once('dialog', (dialog) => dialog.accept());
      await page.getByRole('button', { name: new RegExp(`Supprimer la catégorie ${customB}`) }).click();
    });
  });
});