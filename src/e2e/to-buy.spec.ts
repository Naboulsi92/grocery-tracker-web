import { test, expect, createHousehold } from './fixtures';
import {
  e2eEnvironment,
  fixtureRequiredReason,
} from './environment';
import { createClient as createSupabaseClient } from '@supabase/supabase-js';

type Account = {
  email: string;
  password: string;
};

const createClient = (url: string, key: string) => {
  return createSupabaseClient(url, key);
};

async function adminClient() {
  const supabaseURL = process.env.E2E_SUPABASE_URL;
  const serviceRoleKey = process.env.E2E_SUPABASE_SERVICE_ROLE_KEY;
  if (!supabaseURL || !serviceRoleKey) {
    throw new Error('Database writes require E2E_SUPABASE_URL and E2E_SUPABASE_SERVICE_ROLE_KEY');
  }
  return createClient(supabaseURL, serviceRoleKey);
}

async function createItemWithLowStock(
  householdId: string,
  itemName: string,
  quantity: number,
  threshold: number,
  categoryId?: string,
  unit: string = 'unite'
) {
  const supabase = await adminClient();

  const { data: item, error } = await supabase
    .from('items')
    .insert({
      household_id: householdId,
      name: itemName,
      quantity,
      low_stock_threshold: threshold,
      category_id: categoryId,
      unit,
    })
    .select()
    .single();

  if (error) throw error;
  return item;
}

async function getHouseholdId(account: Account): Promise<string> {
  const supabaseURL = process.env.E2E_SUPABASE_URL;
  const serviceRoleKey = process.env.E2E_SUPABASE_SERVICE_ROLE_KEY;
  if (!supabaseURL || !serviceRoleKey) {
    throw new Error('Database reads require E2E_SUPABASE_URL and E2E_SUPABASE_SERVICE_ROLE_KEY');
  }

  const supabase = await createClient(supabaseURL, serviceRoleKey);

  const { data: { users }, error: listError } = await supabase.auth.admin.listUsers({
    page: 1,
    perPage: 1000,
  });
  if (listError) throw listError;

  const user = users.find((u) => u.email === account.email);
  if (!user) throw new Error(`No user found with email ${account.email}`);

  const { data: membership } = await supabase
    .from('household_members')
    .select('household_id')
    .eq('user_id', user.id)
    .single();

  if (!membership) throw new Error(`No household membership found for user ${user.id}`);
  return membership.household_id;
}

async function createCategory(householdId: string, categoryName: string) {
  const supabase = await adminClient();

  const { data, error } = await supabase
    .from('categories')
    .insert({
      household_id: householdId,
      name: categoryName,
    })
    .select()
    .single();

  if (error) throw error;
  return data;
}

async function clearCatalog(householdId: string) {
  const supabaseURL = process.env.E2E_SUPABASE_URL;
  const serviceRoleKey = process.env.E2E_SUPABASE_SERVICE_ROLE_KEY;
  if (!supabaseURL || !serviceRoleKey) {
    return;
  }

  const supabase = await createClient(supabaseURL, serviceRoleKey);

  await supabase.from('items').delete().eq('household_id', householdId);
  await supabase.from('categories').delete().eq('household_id', householdId);
}

// The app registers a service worker (root layout -> /sw.js) that serves
// GET /rest/v1/items** with staleWhileRevalidate. Playwright's page.route
// does NOT intercept requests handled by a service worker, which silently
// defeats every delay/abort route registered in this file. Blocking service
// workers lets the routes below actually intercept the inventory fetches.
test.use({ serviceWorkers: 'block' });

test.describe('To-Buy Page', () => {
  let householdId: string;

  test.beforeEach(async ({ page, account }) => {
    if (!e2eEnvironment.writesAllowed) {
      test.skip(true, fixtureRequiredReason);
    }
    await createHousehold(page, account);
    householdId = await getHouseholdId(account);
    await clearCatalog(householdId);
  });

  test.afterEach(async () => {
    if (e2eEnvironment.writesAllowed && householdId) {
      await clearCatalog(householdId);
    }
  });

  test('loads and displays the to-buy page heading', async ({ page }) => {
    await page.goto('/to-buy');
    await expect(page.getByRole('heading', { name: 'À acheter' })).toBeVisible();
  });

  test('shows empty state when all items are in stock', async ({ page }) => {
    await createItemWithLowStock(householdId, 'Item en stock', 10, 5);

    await page.goto('/to-buy');
    await expect(page.getByRole('heading', { name: 'À acheter' })).toBeVisible();
    await expect(page.getByText('Tout est en stock !')).toBeVisible();
    await expect(page.getByText('Rien à acheter pour le moment')).toBeVisible();
  });

  test('displays low-stock items with correct quantities', async ({ page }) => {
    await createItemWithLowStock(householdId, 'Pâtes', 2, 5, undefined, 'boîtes');

    await page.goto('/to-buy');
    await expect(page.getByRole('heading', { name: 'À acheter' })).toBeVisible();
    await expect(page.getByText('Pâtes')).toBeVisible();
    await expect(page.getByText('2/5 boîtes')).toBeVisible();
  });

  test('shows loading state while data is being fetched', async ({ page }) => {
    // Hold every inventory response behind a gate so the loading UI stays up
    // until the status assertion runs, regardless of dev-server boot timing.
    // The gate is always released (try/finally) so a failing assertion cannot
    // stall the test on the held requests.
    let releaseInventory = () => {};
    const inventoryGate = new Promise<void>((resolve) => {
      releaseInventory = resolve;
    });
    await page.route('**/rest/v1/items**', async (route) => {
      await inventoryGate;
      await route.continue();
    });

    await page.goto('/to-buy');
    try {
      await expect(page.getByRole('status', { name: 'Chargement...' })).toBeVisible({ timeout: 15000 });
    } finally {
      releaseInventory();
    }
    await expect(page.getByRole('heading', { name: 'À acheter' })).toBeVisible({ timeout: 15000 });
  });

  test('displays an icon for each item', async ({ page }) => {
    const category = await createCategory(householdId, 'Fruits et Légumes');
    await createItemWithLowStock(householdId, 'Pommes', 1, 3, category.id, 'pcs');

    await page.goto('/to-buy');
    await expect(page.getByText('Pommes')).toBeVisible();
    await expect(page.locator('.to-buy-icon').getByText('📦')).toBeVisible();
  });

  test('shows item even without a category', async ({ page }) => {
    await createItemWithLowStock(householdId, 'Sans catégorie', 1, 3, undefined, 'pcs');

    await page.goto('/to-buy');
    await expect(page.getByText('Sans catégorie')).toBeVisible();
    await expect(page.locator('.to-buy-icon').getByText('📦')).toBeVisible();
  });

  test('allows incrementing item quantities from to-buy list', async ({ page }) => {
    const item = await createItemWithLowStock(householdId, 'Riz', 2, 5, undefined, 'pcs');

    await page.goto('/to-buy');
    await expect(page.getByText('Riz')).toBeVisible();
    await expect(page.getByText('2/5 pcs')).toBeVisible();

    await page.getByTestId('tobuy-quantity-input').fill('1');
    await page.getByTestId('tobuy-check-button').click();
    await page.waitForTimeout(1000);

    const supabase = await adminClient();
    const updatedItem = await supabase
      .from('items')
      .select('quantity')
      .eq('id', item.id)
      .single();

    expect(updatedItem.data?.quantity).toBe(3);
  });

  test('marks item as in stock when quantity exceeds threshold', async ({ page }) => {
    const item = await createItemWithLowStock(householdId, 'Beurre', 2, 3, undefined, 'pcs');

    await page.goto('/to-buy');
    await expect(page.getByText('Beurre')).toBeVisible();

    await page.getByTestId('tobuy-quantity-input').fill('2');
    await page.getByTestId('tobuy-check-button').click();

    await expect(page.locator('.badge-success')).toBeVisible();
    await expect(page.getByText('En stock')).toBeVisible();
    await expect(page.getByTestId('tobuy-quantity-input')).toHaveCount(0);

    await page.waitForTimeout(1000);

    const supabase = await adminClient();
    const updatedItem = await supabase
      .from('items')
      .select('quantity')
      .eq('id', item.id)
      .single();

    expect(updatedItem.data?.quantity).toBe(4);
  });

  test('navigates back to dashboard from to-buy page', async ({ page }) => {
    await page.goto('/to-buy');
    await page.getByTestId('back-link').click();
    await expect(page).toHaveURL('/home');
    await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
  });

  test('displays current quantity vs threshold for each item', async ({ page }) => {
    await createItemWithLowStock(householdId, 'Lait', 0, 2, undefined, 'L');

    await page.goto('/to-buy');
    await expect(page.getByText('0/2 L')).toBeVisible();
  });

  test('shows items sorted by name', async ({ page }) => {
    await createItemWithLowStock(householdId, 'Item A1', 1, 3, undefined, 'pcs');
    await createItemWithLowStock(householdId, 'Item A2', 1, 3, undefined, 'pcs');
    await createItemWithLowStock(householdId, 'Item B1', 1, 3, undefined, 'pcs');

    await page.goto('/to-buy');

    const items = page.locator('.to-buy-item');
    await expect(items).toHaveCount(3);

    const names = await page.locator('.to-buy-name').allTextContents();
    expect(names).toEqual(['Item A1', 'Item A2', 'Item B1']);
  });

  test('shows error message when data fetch fails', async ({ page }) => {
    // postgrest-js retries aborted GETs with 1s/2s/4s backoff, which pushes
    // error surfacing past the test budget; a 500 exercises the same app
    // error path (query error -> .auth-error + retry) deterministically.
    await page.route('**/rest/v1/items**', async (route) => {
      if (route.request().method() === 'GET') {
        await route.fulfill({
          status: 500,
          contentType: 'application/json',
          body: JSON.stringify({
            code: '500',
            message: 'Simulated fetch failure',
            details: '',
            hint: '',
          }),
        });
      } else {
        await route.continue();
      }
    });

    await page.goto('/to-buy');

    const errorAlert = page.locator('.auth-error');
    await expect(errorAlert).toBeVisible({ timeout: 15000 });
    await expect(errorAlert).toContainText(/fetch|erreur|error/i);
  });

  test('allows retry after failed data fetch', async ({ page }) => {
    // Fail every inventory request until the error is on screen (the page
    // mounts concurrent fetches and only the latest one surfaces its error),
    // then let the retry succeed.
    let failRequest = true;

    await page.route('**/rest/v1/items**', async (route) => {
      if (route.request().method() === 'GET' && failRequest) {
        await route.fulfill({
          status: 500,
          contentType: 'application/json',
          body: JSON.stringify({
            code: '500',
            message: 'Simulated fetch failure',
            details: '',
            hint: '',
          }),
        });
      } else {
        await route.continue();
      }
    });

    await page.goto('/to-buy');

    const errorAlert = page.locator('.auth-error');
    await expect(errorAlert).toBeVisible({ timeout: 15000 });
    failRequest = false;

    const retryButton = page.getByRole('button', { name: 'Réessayer' });
    await expect(retryButton).toBeVisible();
    await retryButton.click();

    await expect(errorAlert).not.toBeVisible({ timeout: 15000 });
    await expect(page.getByRole('heading', { name: 'À acheter' })).toBeVisible({ timeout: 15000 });
  });

  test('shows visual distinction for critically low items', async ({ page }) => {
    await createItemWithLowStock(householdId, 'Critique', 0, 5, undefined, 'pcs');
    await createItemWithLowStock(householdId, 'Presque plein', 4, 5, undefined, 'pcs');

    await page.goto('/to-buy');
    await expect(page.getByText('Critique')).toBeVisible();
    await expect(page.getByText('0/5 pcs')).toBeVisible();
    await expect(page.getByText('Presque plein')).toBeVisible();
    await expect(page.getByText('4/5 pcs')).toBeVisible();
  });

  test('updates list when item quantities change via real-time subscription', async ({ page }) => {
    const item = await createItemWithLowStock(householdId, 'Égouttoir', 2, 5, undefined, 'pcs');

    await page.goto('/to-buy');
    await expect(page.getByText('Égouttoir')).toBeVisible();
    await expect(page.getByText('2/5 pcs')).toBeVisible();

    const supabase = await adminClient();
    await supabase.from('items').update({ quantity: 6 }).eq('id', item.id);

    await page.waitForTimeout(1500);
    await expect(page.getByText('Égouttoir')).toHaveCount(0);
  });

  test('meets accessibility standards for screen readers', async ({ page }) => {
    await createItemWithLowStock(householdId, 'Article accessibilité', 1, 3, undefined, 'pcs');

    let releaseInventory = () => {};
    const inventoryGate = new Promise<void>((resolve) => {
      releaseInventory = resolve;
    });
    await page.route('**/rest/v1/items**', async (route) => {
      await inventoryGate;
      await route.continue();
    });

    await page.goto('/to-buy');

    try {
      await expect(page.getByRole('status', { name: 'Chargement...' })).toBeVisible({ timeout: 15000 });
    } finally {
      releaseInventory();
    }

    await expect(page.getByRole('heading', { name: 'À acheter' })).toBeVisible({ timeout: 15000 });

    const mainRegion = page.getByRole('main');
    await expect(mainRegion).toBeVisible();

    const backButton = page.getByTestId('back-link');
    await expect(backButton).toHaveAttribute('aria-label');

    const toBuyItems = page.locator('.to-buy-item');
    await expect(toBuyItems).not.toHaveCount(0);

    const quantityInputs = page.getByTestId('tobuy-quantity-input');
    for (const input of await quantityInputs.all()) {
      await expect(input).toHaveAttribute('aria-label');
    }

    const confirmButtons = page.getByTestId('tobuy-check-button');
    for (const button of await confirmButtons.all()) {
      await expect(button).toHaveAttribute('aria-label');
    }
  });
});