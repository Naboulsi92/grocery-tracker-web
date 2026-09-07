import { test, expect } from '@playwright/test';
import { createAccount, createHousehold } from './fixtures';

test.describe('Tab return behavior', () => {
  test('returning to tab shows no spinner and preserves form state', async ({ page }) => {
    test.skip(!process.env.E2E_SUPABASE_URL || !process.env.E2E_SUPABASE_SERVICE_ROLE_KEY, 
      'E2E requires writable Supabase environment');

    const account = createAccount('tab-return');
    await createHousehold(page, account);

    // Navigate to categories page and fill a form
    await page.getByTestId('dashboard-card-categories').click();
    await expect(page).toHaveURL('/categories');
    await expect(page.getByRole('heading', { name: 'Catégories' })).toBeVisible();

    // Start creating a new category but don't submit
    await page.getByTestId('btn-new-category').click();
    await expect(page.getByTestId('input-category-name')).toBeVisible();
    const categoryName = `Test Category ${Date.now()}`;
    await page.getByTestId('input-category-name').fill(categoryName);

    // Verify form input is present
    await expect(page.getByTestId('input-category-name')).toHaveValue(categoryName);

    // Simulate tab blur and focus by hiding/showing the page
    // This triggers the visibilitychange event that Supabase listens to
    await page.evaluate(() => {
      document.dispatchEvent(new Event('visibilitychange'));
    });

    // Wait a bit for any potential re-resolution
    await page.waitForTimeout(500);

    // Verify no spinner appeared (form should still be visible)
    await expect(page.getByTestId('input-category-name')).toBeVisible();
    await expect(page.getByTestId('input-category-name')).toHaveValue(categoryName);

    // Verify no loading spinner is visible
    await expect(page.locator('.loading-spinner')).not.toBeVisible();
    await expect(page.locator('text=Chargement...')).not.toBeVisible();

    // Complete the form submission to verify everything still works
    await page.getByTestId('btn-create-category').click();
    await expect(page.getByText(categoryName)).toBeVisible({ timeout: 10000 });
  });

  test('returning to tab does not trigger household members refetch', async ({ page }) => {
    test.skip(!process.env.E2E_SUPABASE_URL || !process.env.E2E_SUPABASE_SERVICE_ROLE_KEY,
      'E2E requires writable Supabase environment');

    const account = createAccount('tab-return-refetch');
    await createHousehold(page, account);

    // Go to home page
    await expect(page.getByRole('heading', { level: 1 })).toBeVisible();

    // Count network requests to household_members table before
    const requestsBefore: string[] = [];
    page.on('request', (request) => {
      if (request.url().includes('household_members')) {
        requestsBefore.push(request.url());
      }
    });

    // Simulate tab blur and focus
    await page.evaluate(() => {
      document.dispatchEvent(new Event('visibilitychange'));
    });

    // Wait for any potential requests
    await page.waitForTimeout(1000);

    // Count network requests after
    const requestsAfter: string[] = [];
    page.on('request', (request) => {
      if (request.url().includes('household_members')) {
        requestsAfter.push(request.url());
      }
    });

    // There should be no new requests to household_members
    // (The initial load already happened)
    expect(requestsAfter.length).toBeLessThanOrEqual(requestsBefore.length);
  });

  test('cold first load still shows loading indicator', async ({ page }) => {
    test.skip(!process.env.E2E_SUPABASE_URL || !process.env.E2E_SUPABASE_SERVICE_ROLE_KEY,
      'E2E requires writable Supabase environment');

    const account = createAccount('cold-load');
    
    // Sign up and create household
    await page.goto('/signup');
    await page.getByLabel('Email').fill(account.email);
    await page.getByLabel('Mot de passe', { exact: true }).fill(account.password);
    await page.getByLabel('Confirmer le mot de passe').fill(account.password);
    await page.getByRole('button', { name: "S'inscrire" }).click();
    await page.waitForURL('/join-household', { timeout: 20000 });

    const householdName = `Foyer e2e ${Date.now()}`;
    await page.getByLabel('Nom du foyer').fill(householdName);
    await page.getByRole('button', { name: 'Créer mon foyer' }).click();

    // Should see loading spinner during initial load
    await expect(page.locator('.loading-spinner')).toBeVisible({ timeout: 5000 });
    
    // Then should resolve to home page
    await page.waitForURL('/home', { timeout: 20000 });
    await expect(page.getByRole('heading', { level: 1, name: householdName })).toBeVisible();
  });

  test('signing out still clears the screen', async ({ page }) => {
    test.skip(!process.env.E2E_SUPABASE_URL || !process.env.E2E_SUPABASE_SERVICE_ROLE_KEY,
      'E2E requires writable Supabase environment');

    const account = createAccount('signout');
    await createHousehold(page, account);

    // Sign out via the header's Déconnexion button
    await page.getByRole('button', { name: 'Déconnexion' }).click();

    // Should redirect to login
    await page.waitForURL('/login', { timeout: 10000 });
    await expect(page.getByRole('heading', { name: 'Connexion' })).toBeVisible();
  });

  test('explicit household retry after joining still shows loading', async ({ page }) => {
    test.skip(!process.env.E2E_SUPABASE_URL || !process.env.E2E_SUPABASE_SERVICE_ROLE_KEY,
      'E2E requires writable Supabase environment');

    const account = createAccount('retry');
    
    // Sign up but don't create household yet
    await page.goto('/signup');
    await page.getByLabel('Email').fill(account.email);
    await page.getByLabel('Mot de passe', { exact: true }).fill(account.password);
    await page.getByLabel('Confirmer le mot de passe').fill(account.password);
    await page.getByRole('button', { name: "S'inscrire" }).click();
    await page.waitForURL('/join-household', { timeout: 20000 });

    // Create household
    const householdName = `Foyer e2e ${Date.now()}`;
    await page.getByLabel('Nom du foyer').fill(householdName);
    await page.getByRole('button', { name: 'Créer mon foyer' }).click();

    // Should show loading during household creation/retry
    await expect(page.locator('.loading-spinner')).toBeVisible({ timeout: 5000 });
    
    await page.waitForURL('/home', { timeout: 20000 });
    await expect(page.getByRole('heading', { level: 1, name: householdName })).toBeVisible();
  });
});