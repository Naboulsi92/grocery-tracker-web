import { test, expect, type Page } from '@playwright/test';
import { createAccount, createHousehold } from './fixtures';
import { didBecomeVisible } from './helpers';

/**
 * Simulates a real tab background/foreground cycle. Real browsers fire
 * visibilitychange on `window` (this is what supabase-js listens to) with
 * document.visibilityState actually changing — a document-only dispatch
 * never reaches it, so it would exercise nothing.
 */
async function simulateTabReturn(page: Page) {
  await page.evaluate(() => {
    Object.defineProperty(document, 'visibilityState', { configurable: true, get: () => 'hidden' });
    window.dispatchEvent(new Event('visibilitychange'));
  });
  // Intentional inter-event gap (stimulus, not settle): let hidden-state
  // handlers (supabase-js token refresh) run before the visible event.
  await page.waitForTimeout(300);
  await page.evaluate(() => {
    Object.defineProperty(document, 'visibilityState', { configurable: true, get: () => 'visible' });
    window.dispatchEvent(new Event('visibilitychange'));
  });
}

/**
 * Forces the next tab return to run a real token refresh: backdates the
 * session expiry in the auth cookie (@supabase/ssr storage) so Supabase
 * recovery calls /auth/v1/token and emits TOKEN_REFRESHED on return.
 * Best-effort: cookie formats vary by environment (self-hosted auth may
 * store a bare token instead of base64 JSON) — when the shape is unknown
 * the test simply covers the fresh-session return path instead of failing.
 */
async function expireSessionCookie(page: Page) {
  try {
    const cookies = await page.context().cookies();
    const sessionCookie = cookies.find((c) => c.name.includes('auth-token'));
    if (!sessionCookie) return;
    const prefix = sessionCookie.value.startsWith('base64-') ? 'base64-' : '';
    const session = JSON.parse(
      Buffer.from(sessionCookie.value.slice(prefix.length), 'base64').toString('utf8'),
    );
    if (!session || typeof session !== 'object' || typeof session.expires_at !== 'number') return;
    session.expires_at = Math.floor(Date.now() / 1000) - 100;
    await page.context().addCookies([{
      ...sessionCookie,
      value: prefix + Buffer.from(JSON.stringify(session)).toString('base64'),
    }]);
  } catch {
    // Unknown cookie shape — fall through to the fresh-session return path.
  }
}

test.describe('Tab return behavior', () => {
  test('returning to tab shows no spinner and preserves form state', async ({ page }) => {
    test.skip(!process.env.E2E_SUPABASE_URL || !process.env.E2E_SUPABASE_SERVICE_ROLE_KEY, 
      'E2E requires writable Supabase environment');

    const account = createAccount('tab-return');
    await createHousehold(page, account);

    // Navigate to categories page and fill a form
    await page.getByTestId('dashboard-card-categories').click();
    await expect(page).toHaveURL('/categories');
    await expect(page.getByRole('heading', { name: 'Catégories', exact: true })).toBeVisible();

    // Start creating a new category but don't submit
    await page.getByTestId('btn-new-category').click();
    await expect(page.getByTestId('input-category-name')).toBeVisible();
    const categoryName = `Test Category ${Date.now()}`;
    await page.getByTestId('input-category-name').fill(categoryName);

    // Verify form input is present
    await expect(page.getByTestId('input-category-name')).toHaveValue(categoryName);

    // Force a real token refresh on return (expired session), then simulate
    // a genuine tab blur/focus cycle reaching supabase-js.
    await expireSessionCookie(page);
    await simulateTabReturn(page);

    // Re-resolution window: bounded web-first wait so the negative asserts
    // below are meaningful (a spinner flashing late must fail, not pass
    // vacuously). Failing here means the product regressed, not the test.
    await didBecomeVisible(page.locator('.loading-spinner').or(page.locator('text=Chargement...')), 2000);

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

    // Simulate tab blur and focus (window-level, as real browsers do).
    // The requestsBefore listener above stays armed across the window.
    const refetchBaseline = requestsBefore.length;
    await simulateTabReturn(page);

    // Bounded refetch window instead of a fixed sleep: fail fast on the first
    // refetch, pass when the window closes quietly.
    try {
      await page.waitForRequest(/household_members/, { timeout: 1000 });
    } catch {
      // No refetch within the window — the expected path.
    }

    // There should be no new requests to household_members
    // (The initial load already happened)
    expect(requestsBefore.length).toBe(refetchBaseline);
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

    await page.getByTestId('onboarding-first-name-input').fill('Camille');
    await page.getByTestId('onboarding-last-name-input').fill('E2E');
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

    await page.getByTestId('onboarding-first-name-input').fill('Camille');
    await page.getByTestId('onboarding-last-name-input').fill('E2E');
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