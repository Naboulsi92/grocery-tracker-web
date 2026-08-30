import { test, expect } from '@playwright/test';

test.describe('App Flow', () => {
  test('complete user flow: login and navigate', async ({ page }) => {
    page.on('console', msg => console.log(`[CONSOLE] ${msg.type()}: ${msg.text()}`));
    page.on('pageerror', err => console.log(`[PAGE ERROR] ${err.message}`));
    
    await page.goto('/login');
    await page.waitForLoadState('networkidle');
    
    const emailInput = page.getByLabel('Email');
    const passwordInput = page.getByLabel('Mot de passe');
    const submitButton = page.getByRole('button', { name: 'Se connecter' });
    
    await emailInput.fill('naboulsi.riyad@gmail.com');
    await passwordInput.fill('azerty');
    
    await Promise.all([
      page.waitForURL(/\/home/, { timeout: 20000 }),
      submitButton.click()
    ]);
    await expect(page.getByRole('heading', { name: 'Mon Foyer' })).toBeVisible({ timeout: 10000 });
    
    await page.locator('.dashboard-card').filter({ hasText: 'Catégories' }).click();
    await expect(page).toHaveURL('/categories');
    await expect(page.getByRole('heading', { name: 'Catégories' })).toBeVisible();
    
    await page.locator('.back-link').click();
    await expect(page).toHaveURL('/home');
    
    await page.locator('.dashboard-card').filter({ hasText: 'Articles' }).first().click();
    await expect(page).toHaveURL('/items');
    await expect(page.getByRole('heading', { name: 'Articles' })).toBeVisible();
    
    await page.locator('.back-link').click();
    await expect(page).toHaveURL('/home');
    
    await page.locator('.dashboard-card').filter({ hasText: 'À acheter' }).click();
    await expect(page).toHaveURL('/to-buy');
    await expect(page.getByRole('heading', { name: 'À acheter' })).toBeVisible();
  });

  test('can add a new category', async ({ page }) => {
    page.on('console', msg => console.log(`[CONSOLE] ${msg.type()}: ${msg.text()}`));
    page.on('pageerror', err => console.log(`[PAGE ERROR] ${err.message}`));
    
    await page.goto('/login');
    await page.waitForLoadState('networkidle');
    
    const emailInput = page.getByLabel('Email');
    const passwordInput = page.getByLabel('Mot de passe');
    const submitButton = page.getByRole('button', { name: 'Se connecter' });
    
    await emailInput.fill('naboulsi.riyad@gmail.com');
    await passwordInput.fill('azerty');
    
    await Promise.all([
      page.waitForURL(/\/home/, { timeout: 20000 }),
      submitButton.click()
    ]);
    
    await expect(page.getByRole('heading', { name: 'Mon Foyer' })).toBeVisible({ timeout: 10000 });
    
    await page.locator('.dashboard-card').filter({ hasText: 'Catégories' }).click();
    await page.getByRole('button', { name: 'Nouvelle' }).click();
    await page.locator('input[type="text"]').first().fill('Test Category');
    await page.getByRole('button', { name: 'Créer' }).click();
    
    await expect(page.getByText('Test Category')).toBeVisible({ timeout: 10000 });
  });

  test('can add a new item', async ({ page }) => {
    page.on('console', msg => console.log(`[CONSOLE] ${msg.type()}: ${msg.text()}`));
    page.on('pageerror', err => console.log(`[PAGE ERROR] ${err.message}`));
    
    await page.goto('/login');
    await page.waitForLoadState('networkidle');
    
    const emailInput = page.getByLabel('Email');
    const passwordInput = page.getByLabel('Mot de passe');
    const submitButton = page.getByRole('button', { name: 'Se connecter' });
    
    await emailInput.fill('naboulsi.riyad@gmail.com');
    await passwordInput.fill('azerty');
    
    await Promise.all([
      page.waitForURL(/\/home/, { timeout: 20000 }),
      submitButton.click()
    ]);
    
    await expect(page.getByRole('heading', { name: 'Mon Foyer' })).toBeVisible({ timeout: 10000 });
    
    await page.locator('.dashboard-card').filter({ hasText: 'Articles' }).first().click();
    await page.getByRole('button', { name: 'Nouveau' }).click();
    await page.locator('input[type="text"]').first().fill('Test Item');
    await page.getByRole('button', { name: 'Créer' }).click();
    
    await expect(page.getByText('Test Item')).toBeVisible({ timeout: 10000 });
  });
});