import { randomUUID } from 'node:crypto';
import { requireWrites, createAccount, createHousehold, expect, signUp, test } from './fixtures';
import { confirmDeleteDialog, deleteAllItems, deleteItemRow } from './helpers';

test.describe('Items CRUD', () => {
  test.describe('Create Item', () => {
    test('shows error message on create failure', async ({ page, account }) => {
      requireWrites();
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

      await expect(page.locator('.auth-error')).toBeVisible();
    });

    test('validates unit selection and display', async ({ page, account }) => {
      requireWrites();
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
      
      await confirmDeleteDialog(page, itemRow.getByTestId(/^btn-delete-item-/), 'item-delete-confirm');
    });
  });

  test.describe('Edit Item', () => {
    test('can edit item name (US 45)', async ({ page, account }) => {
      requireWrites();
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
      
      await confirmDeleteDialog(page, page.locator('.item-row').filter({ hasText: newName }).getByTestId(/^btn-delete-item-/), 'item-delete-confirm');
    });

    test('can adjust item quantity via atomic buttons (US 46)', async ({ page, account }) => {
      requireWrites();
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

      await confirmDeleteDialog(page, itemRow.getByTestId(/^btn-delete-item-/), 'item-delete-confirm');
    });

    test('can edit item category assignment (US 47)', async ({ page, account }) => {
      requireWrites();
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

      await deleteItemRow(page, page.locator('.item-row').filter({ hasText: itemName }));
      await page.goto('/home');
      await page.getByTestId('dashboard-card-categories').click();
      await confirmDeleteDialog(page, page.getByRole('button', { name: new RegExp(`Supprimer la catégorie ${categoryName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}`) }), 'category-delete-confirm');
    });

    test('can edit low stock threshold (US 48)', async ({ page, account }) => {
      requireWrites();
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
      
      await confirmDeleteDialog(page, itemRow.getByTestId(/^btn-delete-item-/), 'item-delete-confirm');
    });
  });

  test.describe('Atomic Operations', () => {
    test('can increment quantity atomically (US 49)', async ({ page, account }) => {
      requireWrites();
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
      
      await confirmDeleteDialog(page, itemRow.getByTestId(/^btn-delete-item-/), 'item-delete-confirm');
    });

    test('can decrement quantity atomically (US 50)', async ({ page, account }) => {
      requireWrites();
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
      
      await confirmDeleteDialog(page, itemRow.getByTestId(/^btn-delete-item-/), 'item-delete-confirm');
    });

    test('cannot decrement below zero', async ({ page, account }) => {
      requireWrites();
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
      
      await confirmDeleteDialog(page, itemRow.getByTestId(/^btn-delete-item-/), 'item-delete-confirm');
    });
  });

  test.describe('Empty State', () => {
    test('shows empty state with call-to-action when no items exist (US 51, 81)', async ({ page, account }) => {
      requireWrites();
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
      requireWrites();
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

      const itemRow = page.locator('.item-row').filter({ hasText: itemName });
      await confirmDeleteDialog(page, itemRow.getByTestId(/^btn-delete-item-/), 'item-delete-confirm');

      await expect(page.locator('.auth-error')).toBeVisible();
    });
  });

  test.describe('Real-time Updates', () => {
    test('updates in real-time when items change', async ({ page, account, browser }) => {
      requireWrites();
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
  });

  test.describe('Low Stock Badge', () => {
    test('displays low-stock badge correctly', async ({ page, account }) => {
      requireWrites();
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

      await confirmDeleteDialog(page, itemRow.getByTestId(/^btn-delete-item-/), 'item-delete-confirm');
    });
  });

  test.describe('Fork Isolation (P0-5, #107)', () => {
    test('renaming seeded Lait in household A does not affect household B', async ({
      page,
      account,
      browser,
    }) => {
      requireWrites();
      await createHousehold(page, account);

      await page.getByTestId('dashboard-card-items').click();
      // Fork seed: each new household owns its private copy of the 10 templates.
      await expect(page.getByText('Lait', { exact: true })).toBeVisible({ timeout: 10000 });

      const renamedLait = `Lait renomme ${randomUUID().slice(0, 8)}`;
      const laitRow = page.locator('.item-row').filter({ hasText: 'Lait' }).first();
      await laitRow.getByRole('button', { name: /Modifier l'article/ }).click();
      await page.getByTestId('input-item-name').fill(renamedLait);
      await page.getByTestId('btn-create-item').click();
      await expect(page.getByText(renamedLait)).toBeVisible();

      // Second, fully isolated household: must still show the pristine fork.
      const secondContext = await browser.newContext();
      const secondPage = await secondContext.newPage();
      const secondAccount = createAccount('e2e-fork-b');
      await createHousehold(secondPage, secondAccount);
      await secondPage.getByTestId('dashboard-card-items').click();
      await expect(secondPage.getByText('Lait', { exact: true })).toBeVisible({ timeout: 10000 });
      await expect(secondPage.getByText(renamedLait)).toHaveCount(0);
      await secondContext.close();

      await deleteItemRow(page, page.locator('.item-row').filter({ hasText: renamedLait }));
    });
  });

  test.describe('Field Validation (P1-7, #107)', () => {
    test('rejects a name without any letter', async ({ page, account }) => {
      requireWrites();
      await createHousehold(page, account);

      await page.getByTestId('dashboard-card-items').click();
      await page.getByTestId('btn-new-item').click();
      await page.getByTestId('input-item-name').fill('12345');
      await page.getByTestId('btn-create-item').click();

      await expect(page.getByTestId('error-name-required-letter')).toBeVisible();
    });

    test('rejects a name longer than 50 characters', async ({ page, account }) => {
      requireWrites();
      await createHousehold(page, account);

      await page.getByTestId('dashboard-card-items').click();
      await page.getByTestId('btn-new-item').click();
      await page.getByTestId('input-item-name').fill(`A${'a'.repeat(50)}`);
      await page.getByTestId('btn-create-item').click();

      await expect(page.getByTestId('error-name-too-long')).toBeVisible();
    });

    test('rejects a case-insensitive duplicate name', async ({ page, account }) => {
      requireWrites();
      await createHousehold(page, account);

      const baseName = `Doublon ${randomUUID().slice(0, 8)}`;
      await page.getByTestId('dashboard-card-items').click();
      await page.getByTestId('btn-new-item').click();
      await page.getByTestId('input-item-name').fill(baseName);
      await page.getByTestId('btn-create-item').click();
      await expect(page.getByText(baseName)).toBeVisible({ timeout: 10000 });

      await page.getByTestId('btn-new-item').click();
      await page.getByTestId('input-item-name').fill(baseName.toLowerCase());
      await page.getByTestId('btn-create-item').click();

      await expect(page.getByTestId('error-name-duplicate')).toBeVisible();

      await deleteItemRow(page, page.locator('.item-row').filter({ hasText: baseName }));
    });

    test('rejects a negative quantity', async ({ page, account }) => {
      requireWrites();
      await createHousehold(page, account);

      await page.getByTestId('dashboard-card-items').click();
      await page.getByTestId('btn-new-item').click();
      await page.getByTestId('input-item-name').fill(`Article neg ${randomUUID().slice(0, 8)}`);
      await page.getByLabel('Quantité', { exact: true }).fill('-1');
      await page.getByTestId('btn-create-item').click();

      await expect(page.getByTestId('error-quantity-negative')).toBeVisible();
    });

    test('rejects a decimal quantity', async ({ page, account }) => {
      requireWrites();
      await createHousehold(page, account);

      await page.getByTestId('dashboard-card-items').click();
      await page.getByTestId('btn-new-item').click();
      await page.getByTestId('input-item-name').fill(`Article dec ${randomUUID().slice(0, 8)}`);
      await page.getByLabel('Quantité', { exact: true }).fill('1.5');
      await page.getByTestId('btn-create-item').click();

      await expect(page.getByTestId('error-quantity-negative')).toBeVisible();
    });

    test('rejects a zero threshold', async ({ page, account }) => {
      requireWrites();
      await createHousehold(page, account);

      await page.getByTestId('dashboard-card-items').click();
      await page.getByTestId('btn-new-item').click();
      await page.getByTestId('input-item-name').fill(`Article seuil ${randomUUID().slice(0, 8)}`);
      await page.getByLabel('Seuil stock bas').fill('0');
      await page.getByTestId('btn-create-item').click();

      await expect(page.getByTestId('error-threshold-required')).toBeVisible();
    });

    test('shows an error on empty submit instead of silently returning (#129)', async ({ page, account }) => {
      requireWrites();
      await createHousehold(page, account);

      await page.getByTestId('dashboard-card-items').click();
      await page.getByTestId('btn-new-item').click();
      await page.getByLabel('Quantité', { exact: true }).fill('1');
      await page.getByTestId('btn-create-item').click();

      // No insert: the form stays open with a name error.
      await expect(page.getByTestId('error-name-required-letter')).toBeVisible();
      await expect(page.getByTestId('input-item-name')).toBeVisible();
    });

    test('shows the unit error in English when the locale is EN (#128)', async ({ page, account }) => {
      requireWrites();
      await createHousehold(page, account);

      await page.getByTestId('dashboard-card-account').click();
      await page.getByTestId('account-language-selector').selectOption('en');
      await expect(page.getByRole('heading', { level: 1, name: 'Account settings' })).toBeVisible({
        timeout: 10000,
      });

      await page.goto('/items');
      await page.getByTestId('btn-new-item').click();
      await page.getByTestId('input-item-name').fill(`Article unit ${randomUUID().slice(0, 8)}`);
      await page.locator('#item-unit').evaluate((select: HTMLSelectElement) => {
        select.value = 'litre';
        select.dispatchEvent(new Event('change', { bubbles: true }));
      });
      await page.getByTestId('btn-create-item').click();

      await expect(page.getByTestId('error-unit-invalid')).toBeVisible();
      await expect(page.getByTestId('error-unit-invalid')).toContainText(
        'Choose a unit from kg, g, l, ml, unit.',
      );
    });
  });

  test.describe('Unit Change (P1-8, #107)', () => {
    test('changing unit clears quantity and threshold', async ({ page, account }) => {
      requireWrites();
      await createHousehold(page, account);

      await page.getByTestId('dashboard-card-items').click();
      await page.getByTestId('btn-new-item').click();
      await page.getByLabel('Quantité', { exact: true }).fill('5');
      await page.getByLabel('Seuil stock bas').fill('3');

      // Scope C note: #item-unit has no kebab data-testid yet (Scope A/B should
      // add data-testid="input-item-unit"); this selector accepts either form.
      const unitSelect = page.locator('[data-testid="input-item-unit"], #item-unit');
      await unitSelect.selectOption('kg');

      await expect(page.getByLabel('Quantité', { exact: true })).toHaveValue('');
      await expect(page.getByLabel('Seuil stock bas')).toHaveValue('');
    });

    test('unit select offers exactly the 5 closed PRD values', async ({ page, account }) => {
      requireWrites();
      await createHousehold(page, account);

      await page.getByTestId('dashboard-card-items').click();
      await page.getByTestId('btn-new-item').click();

      const unitSelect = page.locator('[data-testid="input-item-unit"], #item-unit');
      const values = await unitSelect
        .locator('option')
        .evaluateAll((options) => options.map((option) => (option as HTMLOptionElement).value).sort());
      expect(values).toEqual(['g', 'kg', 'l', 'ml', 'unite']);
    });
  });

  test.describe('Seed Items (P1-13, #107)', () => {
    test('new household owns the 10 forked seed items at quantity 0', async ({ page, account }) => {
      requireWrites();
      await createHousehold(page, account);

      await page.getByTestId('dashboard-card-items').click();
      const rows = page.locator('.item-row');
      await expect(rows).toHaveCount(10, { timeout: 10000 });

      // Forked rows snapshot the French template names (EN names live in the
      // item_templates.name_en seed column, verified at DB level — Scope A).
      for (const name of [
        'Lait',
        'Pain',
        'Œufs',
        'Tomates',
        'Pommes',
        'Poulet',
        'Pâtes',
        'Café',
        'Eau',
        'Papier toilette',
      ]) {
        await expect(page.getByText(name, { exact: true }).first()).toBeVisible();
      }

      const laitRow = rows.filter({ hasText: 'Lait' }).first();
      await expect(laitRow.locator('.qty-value')).toContainText('0');
    });
  });
});