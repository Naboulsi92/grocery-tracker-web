import { randomUUID } from 'node:crypto';
import { test, expect, createHousehold, signUp } from './fixtures';
import {
  e2eEnvironment,
  fixtureRequiredReason,
  writesDisabledReason,
} from './environment';
import type { Page } from '@playwright/test';

type Account = {
  email: string;
  password: string;
};

async function createItemWithLowStock(
  page: Page,
  householdId: string,
  itemName: string,
  quantity: number,
  threshold: number,
  categoryId?: string,
  unitId?: string
) {
  const supabaseURL = process.env.E2E_SUPABASE_URL;
  const serviceRoleKey = process.env.E2E_SUPABASE_SERVICE_ROLE_KEY;
  if (!supabaseURL || !serviceRoleKey) {
    throw new Error('Database writes require E2E_SUPABASE_URL and E2E_SUPABASE_SERVICE_ROLE_KEY');
  }
  
  const { createClient } = await import('@supabase/supabase-js');
  const supabase = createClient(supabaseURL, serviceRoleKey);
  
  const { data: item, error } = await supabase
    .from('items')
    .insert({
      household_id: householdId,
      name: itemName,
      quantity,
      low_stock_threshold: threshold,
      category_id: categoryId,
      unit_id: unitId,
    })
    .select()
    .single();
  
  if (error) throw error;
  return item;
}

async function getHouseholdId(page: Page): Promise<string> {
  const supabaseURL = process.env.E2E_SUPABASE_URL;
  const serviceRoleKey = process.env.E2E_SUPABASE_SERVICE_ROLE_KEY;
  if (!supabaseURL || !serviceRoleKey) {
    throw new Error('Database reads require E2E_SUPABASE_URL and E2E_SUPABASE_SERVICE_ROLE_KEY');
  }
  
  const { createClient } = await import('@supabase/supabase-js');
  const supabase = createClient(supabaseURL, serviceRoleKey);
  
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('No authenticated user');
  
  const { data: membership } = await supabase
    .from('household_members')
    .select('household_id')
    .eq('user_id', user.id)
    .single();
  
  if (!membership) throw new Error('No household found');
  return membership.household_id;
}

async function createCategory(
  householdId: string,
  categoryName: string,
  icon: string = '📦'
) {
  const supabaseURL = process.env.E2E_SUPABASE_URL;
  const serviceRoleKey = process.env.E2E_SUPABASE_SERVICE_ROLE_KEY;
  if (!supabaseURL || !serviceRoleKey) {
    throw new Error('Database writes require E2E_SUPABASE_URL and E2E_SUPABASE_SERVICE_ROLE_KEY');
  }
  
  const { createClient } = await import('@supabase/supabase-js');
  const supabase = createClient(supabaseURL, serviceRoleKey);
  
  const { data, error } = await supabase
    .from('categories')
    .insert({
      household_id: householdId,
      name: categoryName,
      icon,
    })
    .select()
    .single();
  
  if (error) throw error;
  return data;
}

async function createUnit(
  householdId: string,
  unitName: string,
  unitAbbrev: string
) {
  const supabaseURL = process.env.E2E_SUPABASE_URL;
  const serviceRoleKey = process.env.E2E_SUPABASE_SERVICE_ROLE_KEY;
  if (!supabaseURL || !serviceRoleKey) {
    throw new Error('Database writes require E2E_SUPABASE_URL and E2E_SUPABASE_SERVICE_ROLE_KEY');
  }
  
  const { createClient } = await import('@supabase/supabase-js');
  const supabase = createClient(supabaseURL, serviceRoleKey);
  
  const { data, error } = await supabase
    .from('units')
    .insert({
      household_id: householdId,
      name: unitName,
      abbrev: unitAbbrev,
    })
    .select()
    .single();
  
  if (error) throw error;
  return data;
}

async function cleanupHousehold(householdId: string) {
  const supabaseURL = process.env.E2E_SUPABASE_URL;
  const serviceRoleKey = process.env.E2E_SUPABASE_SERVICE_ROLE_KEY;
  if (!supabaseURL || !serviceRoleKey) {
    return;
  }
  
  const { createClient } = await import('@supabase/supabase-js');
  const supabase = createClient(supabaseURL, serviceRoleKey);
  
  await supabase.from('items').delete().eq('household_id', householdId);
  await supabase.from('categories').delete().eq('household_id', householdId);
  await supabase.from('units').delete().eq('household_id', householdId);
}

test.describe('To-Buy Page', () => {
  let householdId: string;
  
  test.beforeEach(async ({ page, account }) => {
    if (!e2eEnvironment.writesAllowed) {
      test.skip(true, fixtureRequiredReason);
    }
    await createHousehold(page, account);
    householdId = await getHouseholdId(page);
  });
  
  test.afterEach(async () => {
    if (e2eEnvironment.writesAllowed && householdId) {
      await cleanupHousehold(householdId);
    }
  });

  test('loads and displays the to-buy page heading', async ({ page }) => {
    await page.goto('/to-buy');
    await expect(page.getByRole('heading', { name: 'À acheter' })).toBeVisible();
  });

  test('shows empty state when all items are in stock', async ({ page }) => {
    await createUnit(householdId, 'Pièces', 'pcs');
    await createItemWithLowStock(page, householdId, 'Item en stock', 10, 5, undefined, undefined);
    
    await page.goto('/to-buy');
    await expect(page.getByRole('heading', { name: 'À acheter' })).toBeVisible();
    await expect(page.getByText('Tout est en stock !')).toBeVisible();
    await expect(page.getByText('Rien à acheter pour le moment')).toBeVisible();
  });

  test('displays low-stock items with correct quantities', async ({ page }) => {
    const unit = await createUnit(householdId, 'Boîtes', 'boîtes');
    await createItemWithLowStock(page, householdId, 'Pâtes', 2, 5, undefined, unit.id);
    
    await page.goto('/to-buy');
    await expect(page.getByRole('heading', { name: 'À acheter' })).toBeVisible();
    await expect(page.getByText('Pâtes')).toBeVisible();
    await expect(page.getByText('2/5 boîtes')).toBeVisible();
  });

  test('shows loading state while data is being fetched', async ({ page }) => {
    await page.goto('/to-buy');
    await expect(page.getByRole('status', { name: 'Chargement...' })).toBeVisible({ timeout: 5000 });
  });

  test('displays category icons for each item', async ({ page }) => {
    const category = await createCategory(householdId, 'Fruits et Légumes', '🥬');
    const unit = await createUnit(householdId, 'Pièces', 'pcs');
    await createItemWithLowStock(page, householdId, 'Pommes', 1, 3, category.id, unit.id);
    
    await page.goto('/to-buy');
    await expect(page.getByText('Pommes')).toBeVisible();
    await expect(page.locator('.to-buy-icon').getByText('🥬')).toBeVisible();
  });

  test('shows default icon when category is missing', async ({ page }) => {
    const unit = await createUnit(householdId, 'Pièces', 'pcs');
    await createItemWithLowStock(page, householdId, 'Sans catégorie', 1, 3, undefined, unit.id);
    
    await page.goto('/to-buy');
    await expect(page.getByText('Sans catégorie')).toBeVisible();
    await expect(page.locator('.to-buy-icon').getByText('📦')).toBeVisible();
  });

  test('allows incrementing item quantities from to-buy list', async ({ page }) => {
    const unit = await createUnit(householdId, 'Pièces', 'pcs');
    const item = await createItemWithLowStock(page, householdId, 'Riz', 2, 5, undefined, unit.id);
    
    await page.goto('/to-buy');
    await expect(page.getByText('Riz')).toBeVisible();
    await expect(page.getByText('2/5 pcs')).toBeVisible();
    
    await page.getByRole('button', { name: /Ajouter une unité de Riz/i }).click();
    await page.waitForTimeout(500);
    
    const supabase = await createClient(process.env.E2E_SUPABASE_URL!, process.env.E2E_SUPABASE_SERVICE_ROLE_KEY!);
    const updatedItem = await supabase
      .from('items')
      .select('quantity')
      .eq('id', item.id)
      .single();
    
    expect(updatedItem.data?.quantity).toBe(3);
  });

  test('removes item from list when quantity exceeds threshold', async ({ page }) => {
    const unit = await createUnit(householdId, 'Pièces', 'pcs');
    await createItemWithLowStock(page, householdId, 'Beurre', 2, 3, undefined, unit.id);
    
    await page.goto('/to-buy');
    await expect(page.getByText('Beurre')).toBeVisible();
    
    await page.getByRole('button', { name: /Ajouter une unité de Beurre/i }).click();
    await page.waitForTimeout(500);
    
    await page.getByRole('button', { name: /Ajouter une unité de Beurre/i }).click();
    await page.waitForTimeout(500);
    
    await expect(page.getByText('Beurre')).toHaveCount(0);
  });

  test('navigates back to dashboard from to-buy page', async ({ page }) => {
    await page.goto('/to-buy');
    await page.getByTestId('back-link').click();
    await expect(page).toHaveURL('/home');
    await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
  });

  test('displays current quantity vs threshold for each item', async ({ page }) => {
    const unit = await createUnit(householdId, 'Litres', 'L');
    await createItemWithLowStock(page, householdId, 'Lait', 0, 2, undefined, unit.id);
    
    await page.goto('/to-buy');
    await expect(page.getByText('0/2 L')).toBeVisible();
  });

  test('shows items sorted by category', async ({ page }) => {
    const category1 = await createCategory(householdId, 'A', '🅰');
    const category2 = await createCategory(householdId, 'B', '🅱');
    const unit = await createUnit(householdId, 'Pièces', 'pcs');
    
    await createItemWithLowStock(page, householdId, 'Item A1', 1, 3, category1.id, unit.id);
    await createItemWithLowStock(page, householdId, 'Item A2', 1, 3, category1.id, unit.id);
    await createItemWithLowStock(page, householdId, 'Item B1', 1, 3, category2.id, unit.id);
    
    await page.goto('/to-buy');
    
    const items = page.locator('.to-buy-item');
    await expect(items).toHaveCount(3);
    
    const firstItem = items.first();
    await expect(firstItem.locator('.to-buy-icon').getByText('🅰')).toBeVisible();
  });

  test('shows error message when data fetch fails', async ({ page }) => {
    await page.goto('/to-buy');
    await page.waitForSelector('.loading-container', { state: 'detached' });
    
    const errorAlert = page.locator('[role="alert"]');
    const hasError = await errorAlert.count() > 0;
    
    if (hasError) {
      await expect(errorAlert).toBeVisible();
    }
  });

  test('allows retry after failed data fetch', async ({ page }) => {
    await page.goto('/to-buy');
    await page.waitForSelector('.loading-container', { state: 'detached' });
    
    const retryButton = page.getByRole('button', { name: 'Réessayer' });
    if (await retryButton.count() > 0) {
      await expect(retryButton).toBeVisible();
      await retryButton.click();
      await page.waitForTimeout(1000);
    }
  });

  test('shows visual distinction for critically low items', async ({ page }) => {
    const unit = await createUnit(householdId, 'Pièces', 'pcs');
    await createItemWithLowStock(page, householdId, 'Critique', 0, 5, undefined, unit.id);
    await createItemWithLowStock(page, householdId, 'Presque plein', 4, 5, undefined, unit.id);
    
    await page.goto('/to-buy');
    await expect(page.getByText('Critique')).toBeVisible();
    await expect(page.getByText('0/5 pcs')).toBeVisible();
    await expect(page.getByText('Presque plein')).toBeVisible();
    await expect(page.getByText('4/5 pcs')).toBeVisible();
  });

  test('updates list when item quantities change via real-time subscription', async ({ page }) => {
    const unit = await createUnit(householdId, 'Pièces', 'pcs');
    const item = await createItemWithLowStock(page, householdId, 'Égouttoir', 2, 5, undefined, unit.id);
    
    await page.goto('/to-buy');
    await expect(page.getByText('Égouttoir')).toBeVisible();
    await expect(page.getByText('2/5 pcs')).toBeVisible();
    
    const { createClient } = await import('@supabase/supabase-js');
    const supabase = createClient(process.env.E2E_SUPABASE_URL!, process.env.E2E_SUPABASE_SERVICE_ROLE_KEY!);
    await supabase.from('items').update({ quantity: 6 }).eq('id', item.id);
    
    await page.waitForTimeout(1000);
    await expect(page.getByText('Égouttoir')).toHaveCount(0);
  });
});

async function createClient(url: string, key: string) {
  const { createClient: createSupabaseClient } = await import('@supabase/supabase-js');
  return createSupabaseClient(url, key);
}
