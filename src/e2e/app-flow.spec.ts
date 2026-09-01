import { randomUUID } from 'node:crypto';
import { createAccount, createHousehold, expect, signUp, test } from './fixtures';
import {
  e2eEnvironment,
  fixtureRequiredReason,
  writesDisabledReason,
} from './environment';

test.describe('App Flow', () => {
  test('complete user flow: signup and navigate', async ({ page, account }) => {
    test.skip(!e2eEnvironment.writesAllowed, fixtureRequiredReason);
    await createHousehold(page, account);
    
    await page.getByTestId('dashboard-card-categories').click();
    await expect(page).toHaveURL('/categories');
    await expect(page.getByRole('heading', { name: 'Catégories' })).toBeVisible();
    
    await page.getByTestId('back-link').click();
    await expect(page).toHaveURL('/home');
    
    await page.getByTestId('dashboard-card-items').click();
    await expect(page).toHaveURL('/items');
    await expect(page.getByRole('heading', { name: 'Articles' })).toBeVisible();
    
    await page.getByTestId('back-link').click();
    await expect(page).toHaveURL('/home');
    
    await page.getByTestId('dashboard-card-to-buy').click();
    await expect(page).toHaveURL('/to-buy');
    await expect(page.getByRole('heading', { name: 'À acheter' })).toBeVisible();
  });

  test('can add and remove a new category', async ({ page, account }) => {
    test.skip(!e2eEnvironment.writesAllowed, writesDisabledReason);
    await createHousehold(page, account);

    const categoryName = `Catégorie e2e ${randomUUID()}`;
    await page.getByTestId('dashboard-card-categories').click();
    await page.getByTestId('btn-new-category').click();
    await page.getByTestId('input-category-name').fill(categoryName);
    await page.getByTestId('btn-create-category').click();

    await expect(page.getByText(categoryName)).toBeVisible({ timeout: 10000 });
    page.once('dialog', (dialog) => dialog.accept());
    await page.getByRole('button', { name: `Supprimer la catégorie ${categoryName}` }).click();
    await expect(page.getByText(categoryName)).toHaveCount(0);
  });

  test('can add and remove a new item', async ({ page, account }) => {
    test.skip(!e2eEnvironment.writesAllowed, writesDisabledReason);
    await createHousehold(page, account);

    const itemName = `Article e2e ${randomUUID()}`;
    await page.getByTestId('dashboard-card-items').click();
    await page.getByTestId('btn-new-item').click();
    await page.getByTestId('input-item-name').fill(itemName);
    await page.getByTestId('btn-create-item').click();

    await expect(page.getByText(itemName)).toBeVisible({ timeout: 10000 });
    page.once('dialog', (dialog) => dialog.accept());
    await page.getByRole('button', { name: `Supprimer l'article ${itemName}` }).click();
    await expect(page.getByText(itemName)).toHaveCount(0);
  });

  test('an invited user can join the newly created household', async ({ page, account, browser }) => {
    test.skip(!e2eEnvironment.writesAllowed, fixtureRequiredReason);
    const householdName = await createHousehold(page, account);

    await page.getByRole('link', { name: /Membres/ }).click();
    await expect(page).toHaveURL('/members');
    await expect(page.getByRole('heading', { name: /Membres du foyer/ })).toBeVisible();

    const createInvitation = page.getByRole('button', { name: 'Créer une invitation' });
    await createInvitation.click();
    const token = page.locator('.invite-code-text');
    await expect(token).not.toBeEmpty();
    const invitationToken = await token.textContent();

    const memberContext = await browser.newContext();
    const memberPage = await memberContext.newPage();
    const memberAccount = createAccount('e2e-member');
    try {
      await signUp(memberPage, memberAccount);
      await memberPage.getByLabel(/Code d.invitation complet/).fill(invitationToken!);
      await memberPage.getByRole('button', { name: 'Rejoindre le foyer' }).click();
      await memberPage.waitForURL('/home', { timeout: 20000 });
      await expect(memberPage.getByRole('heading', { level: 1, name: householdName })).toBeVisible();
      await memberPage.getByRole('link', { name: /Membres/ }).click();
      await expect(memberPage.getByRole('heading', { name: 'Membres du foyer (2)' })).toBeVisible();
    } finally {
      await memberContext.close();
    }
  });

  test('updates an item quantity atomically through the UI', async ({ page, account }) => {
    test.skip(!e2eEnvironment.writesAllowed, fixtureRequiredReason);
    await createHousehold(page, account);
    await page.getByRole('link', { name: 'Articles Voir et modifier' }).click();

    const itemName = `Article quantité ${randomUUID()}`;
    await page.getByRole('button', { name: 'Nouveau' }).click();
    await page.getByLabel('Nom').fill(itemName);
    await page.getByLabel('Quantité').fill('2');
    await page.getByRole('button', { name: 'Créer' }).click();

    const row = page.locator('.item-row').filter({ hasText: itemName });
    await row.getByRole('button', { name: `Augmenter la quantité de ${itemName}` }).click();
    await expect(row.locator('.qty-value')).toContainText('3');
    page.once('dialog', (dialog) => dialog.accept());
    await row.getByRole('button', { name: `Supprimer l’article ${itemName}` }).click();
  });
});
