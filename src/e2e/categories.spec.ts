import { randomUUID } from 'node:crypto';
import type { Locator, Page } from '@playwright/test';
import { requireWrites, createAccount, createHousehold, expect, signUp, test } from './fixtures';
import { confirmDeleteDialog } from './helpers';

// Pointer drag straight down: .categories-grid is multi-column and the
// DnD context restricts movement to the vertical axis, so only a vertical
// drag can land the dragged card over another row. closestCenter follows
// the (axis-clamped) dragged rect, not the pointer — a horizontal move
// displaces nothing and the drop silently no-ops. Lift, displacement AND
// the neighbor shift are gated: the drop must wait for the over-target
// commit, otherwise it lands on the stale target.
async function pointerDragDownOneRow(page: Page, cards: Locator, index: number): Promise<void> {
  const transformOf = (locator: Locator): Promise<string> =>
    locator.evaluate((el) => (el as HTMLElement).style.transform || '');
  const handle = cards.nth(index).getByTestId('category-drag-handle');
  const card = cards.nth(index);
  const neighbor = cards.nth(index + 1);
  const from = await handle.boundingBox();
  const box = await card.boundingBox();
  expect(from).not.toBeNull();
  expect(box).not.toBeNull();
  if (!from || !box) throw new Error('drag boxes not measurable');
  const restTransform = await transformOf(card);
  const restNeighborTransform = await transformOf(neighbor);
  const x = from.x + from.width / 2;
  await page.mouse.move(x, from.y + from.height / 2);
  await page.mouse.down();
  await page.mouse.move(x, box.y + box.height * 1.6, { steps: 15 });
  await expect.poll(() => transformOf(card), { timeout: 10000 }).not.toBe(restTransform);
  await expect.poll(() => transformOf(neighbor), { timeout: 10000 }).not.toBe(restNeighborTransform);
  await page.mouse.up();
}

test.describe('Categories CRUD', () => {
  test.describe('Create Category', () => {
    test('shows error message on create failure', async ({ page, account }) => {
      requireWrites();
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
      requireWrites();
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

      await confirmDeleteDialog(page, page.getByRole('button', { name: new RegExp(`Supprimer la catégorie ${categoryName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}`) }), 'category-delete-confirm');
    });

    test('validates maximum name length', async ({ page, account }) => {
      requireWrites();
      await createHousehold(page, account);

      const tooLongName = 'Catégorie avec un nom vraiment beaucoup trop long pour dépasser la limite de cinquante caractères';
      await page.getByTestId('dashboard-card-categories').click();
      await page.getByTestId('btn-new-category').click();
      await page.getByTestId('input-category-name').fill(tooLongName);
      await page.getByTestId('btn-create-category').click();

      await expect(page.getByTestId('error-name-too-long')).toBeVisible();
    });

    test('displays default and custom category icons', async ({ page, account }) => {
      requireWrites();
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

      await confirmDeleteDialog(page, page.getByRole('button', { name: new RegExp(`Supprimer la catégorie ${categoryName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}`) }), 'category-delete-confirm');
    });
  });

  test.describe('Edit Category', () => {
    test('can edit category name (US 34)', async ({ page, account }) => {
      requireWrites();
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

      await confirmDeleteDialog(page, page.getByRole('button', { name: new RegExp(`Supprimer la catégorie ${newName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}`) }), 'category-delete-confirm');
    });

    test('default categories cannot be edited or deleted', async ({ page, account }) => {
      requireWrites();
      await createHousehold(page, account);

      await page.getByTestId('dashboard-card-categories').click();

      const defaultCards = page.locator('[data-testid="category-section-default"] .category-card');
      await expect(defaultCards).toHaveCount(10);
      await expect(defaultCards.first().getByTestId('category-edit-button')).toHaveCount(0);
      await expect(defaultCards.first().getByTestId('category-delete-button')).toHaveCount(0);
    });

    test('preserves category order after edit', async ({ page, account }) => {
      requireWrites();
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

      await confirmDeleteDialog(page, page.getByRole('button', { name: new RegExp(`Supprimer la catégorie ${cat1.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}`) }), 'category-delete-confirm');
      await confirmDeleteDialog(page, page.getByRole('button', { name: new RegExp(`Supprimer la catégorie ${cat2Edited.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}`) }), 'category-delete-confirm');
      await confirmDeleteDialog(page, page.getByRole('button', { name: new RegExp(`Supprimer la catégorie ${cat3.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}`) }), 'category-delete-confirm');
    });
  });

  test.describe('Delete Category', () => {
    test('shows confirmation dialog before deleting (US 35)', async ({ page, account }) => {
      requireWrites();
      await createHousehold(page, account);

      const categoryName = `Catégorie ${randomUUID()}`;
      await page.getByTestId('dashboard-card-categories').click();
      await page.getByTestId('btn-new-category').click();
      await page.getByTestId('input-category-name').fill(categoryName);
      await page.getByTestId('btn-create-category').click();
      await expect(page.getByText(categoryName)).toBeVisible({ timeout: 10000 });

      const deleteButton = page.getByRole('button', { name: new RegExp(`Supprimer la catégorie ${categoryName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}`) });
      await deleteButton.click();
      const dialog = page.getByTestId('category-delete-dialog');
      await expect(dialog).toBeVisible({ timeout: 10000 });
      await expect(dialog.getByText(categoryName)).toBeVisible();
      // Cancel keeps the category.
      await page.getByTestId('category-delete-cancel').click();
      await expect(dialog).toBeHidden();
      await expect(page.getByText(categoryName)).toBeVisible();
      // Confirm deletes it.
      await confirmDeleteDialog(page, deleteButton, 'category-delete-confirm');
      await expect(page.getByText(categoryName)).toHaveCount(0);
    });

    test('shows error message on delete failure (US 37)', async ({ page, account }) => {
      requireWrites();
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

      await confirmDeleteDialog(page, page.getByRole('button', { name: new RegExp(`Supprimer la catégorie ${categoryName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}`) }), 'category-delete-confirm');

      await expect(page.locator('.auth-error')).toBeVisible();
    });

    test('preserves category order after delete', async ({ page, account }) => {
      requireWrites();
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

      await confirmDeleteDialog(page, page.getByRole('button', { name: new RegExp(`Supprimer la catégorie ${cat2.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}`) }), 'category-delete-confirm');

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
      requireWrites();
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
      requireWrites();
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

      // Invite tokens render on /members (never on /categories): fetch one in
      // a scratch tab via the proven onboarding pattern, so the observed
      // /categories page (and its realtime channel) is never disturbed by
      // navigation and the two-context flow below always runs.
      const tokenPage = await page.context().newPage();
      await tokenPage.goto('/home');
      await tokenPage.getByRole('link', { name: /Membres/ }).click();
      await tokenPage.getByRole('button', { name: 'Créer une invitation' }).click();
      const token = await tokenPage.locator('.invite-code-text').textContent();
      await tokenPage.close();

      await secondPage.getByLabel(/Code d.invitation complet/).fill(token ?? '');
      await secondPage.getByRole('button', { name: 'Rejoindre le foyer' }).click();
      await secondPage.waitForURL('/home', { timeout: 20000 });

      await secondPage.getByTestId('dashboard-card-categories').click();
      await expect(secondPage.getByText(categoryName)).toBeVisible({ timeout: 10000 });

        const newCategoryName = `Catégorie rt2 ${randomUUID()}`;
        await secondPage.getByTestId('btn-new-category').click();
        await secondPage.getByTestId('input-category-name').fill(newCategoryName);
        await secondPage.getByTestId('btn-create-category').click();
        // Success closes the form: fail fast here if the submit no-ops
        // (e.g. household not resolved yet) instead of matching the input value below.
        await expect(secondPage.getByTestId('input-category-name')).toBeHidden({ timeout: 10000 });
        await expect(secondPage.getByText(newCategoryName)).toBeVisible({ timeout: 10000 });

      await expect(page.getByText(newCategoryName)).toBeVisible({ timeout: 10000 });

      await secondContext.close();

      await confirmDeleteDialog(page, page.getByRole('button', { name: new RegExp(`Supprimer la catégorie ${categoryName}`) }), 'category-delete-confirm');
    });
  });

  test.describe('Category Order', () => {
    test('preserves order after creating multiple categories', async ({ page, account }) => {
      requireWrites();
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

      await confirmDeleteDialog(page, page.getByRole('button', { name: new RegExp(`Supprimer la catégorie ${cat1}`) }), 'category-delete-confirm');
      await confirmDeleteDialog(page, page.getByRole('button', { name: new RegExp(`Supprimer la catégorie ${cat2}`) }), 'category-delete-confirm');
      await confirmDeleteDialog(page, page.getByRole('button', { name: new RegExp(`Supprimer la catégorie ${cat3}`) }), 'category-delete-confirm');
    });
  });

  test.describe('Seed Categories Bilingual (P1-13, #107)', () => {
    test('new household lists the 10 default seed categories with French names', async ({
      page,
      account,
    }) => {
      requireWrites();
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
      requireWrites();
      await createHousehold(page, account);

      await page.getByTestId('dashboard-card-categories').click();
      await page.getByTestId('btn-new-category').click();
      await page.getByTestId('input-category-name').fill('12345');
      await page.getByTestId('btn-create-category').click();

      await expect(page.getByTestId('error-name-required-letter')).toBeVisible();
    });

    test('rejects a case-insensitive duplicate category name', async ({ page, account }) => {
      requireWrites();
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

      await confirmDeleteDialog(page, page
        .getByRole('button', { name: new RegExp(`Supprimer la catégorie ${baseName}`) })
        , 'category-delete-confirm');
    });
  });

  test.describe('Delete Blocked When Not Empty (#107)', () => {
    test('shows the move-or-delete message instead of deleting', async ({ page, account }) => {
      requireWrites();
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
      // Non-empty: the count check runs at confirm time, then the blocked
      // message renders instead of deleting.
      await page.getByTestId('category-delete-confirm').click();

      await expect(page.getByTestId('category-delete-blocked-message')).toBeVisible();
      await expect(page.getByTestId('error-category-not-empty')).toContainText(
        'Déplacez ou supprimez',
      );
      await expect(page.getByText(categoryName)).toBeVisible();

      await page.goto('/home');
      await page.getByTestId('dashboard-card-items').click();
      const itemRow = page.locator('.item-row').filter({ hasText: itemName });
      await confirmDeleteDialog(page, itemRow.getByTestId(/^btn-delete-item-/), 'item-delete-confirm');

      await page.goto('/home');
      await page.getByTestId('dashboard-card-categories').click();
      await confirmDeleteDialog(page, page
        .getByRole('button', { name: new RegExp(`Supprimer la catégorie ${categoryName}`) })
        , 'category-delete-confirm');
      await expect(page.getByText(categoryName)).toHaveCount(0);
    });
  });

  test.describe('Custom Order via Drag and Drop (#113)', () => {
    const names = (locator: Locator): Promise<string[]> =>
      locator.locator('.category-name').allInnerTexts();

    test('keyboard lifts and cancels a drag without changing order', async ({ page, account }) => {
      requireWrites();
      await createHousehold(page, account);

      await page.getByTestId('dashboard-card-categories').click();
      const cards = page.locator('[data-testid="category-section-default"] .category-card');
      await expect(cards).toHaveCount(10);
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
      requireWrites();
      await createHousehold(page, account);

      await page.getByTestId('dashboard-card-categories').click();
      const cards = page.locator('[data-testid="category-section-default"] .category-card');
      await expect(cards).toHaveCount(10);

      // Drag the first card one row down: same set, new order, first card
      // displaced. (Exact landing row is grid-layout dependent; movement +
      // persistence is the ticket criterion. Custom categories share the
      // exact same handleDragEnd/upsert path — no branch on is_default —
      // so one end-to-end drag covers both.)
      const before = await names(cards);
      await pointerDragDownOneRow(page, cards, 0);
      const after = await names(cards);
      expect(after.slice().sort()).toEqual(before.slice().sort());
      expect(after).not.toEqual(before);
      expect(after.indexOf(before[0])).toBeGreaterThan(0);

      // The new order survives a reload: positions persisted per household.
      await page.reload();
      await expect.poll(() => names(cards), { timeout: 10000 }).toEqual(after);
    });
  });
});
