import { test, expect } from '@playwright/test';

test.describe('Signup Flow', () => {
  test('can sign up a new user', async ({ page }) => {
    page.on('console', msg => console.log(`[CONSOLE] ${msg.type()}: ${msg.text()}`));
    page.on('pageerror', err => console.log(`[PAGE ERROR] ${err.message}`));
    
    const timestamp = Date.now();
    const email = `test${timestamp}@example.com`;
    
    await page.goto('/signup');
    await page.waitForLoadState('networkidle');
    
    await page.getByLabel('Email').fill(email);
    await page.locator('#password').fill('testpassword123');
    await page.getByLabel('Confirmer le mot de passe').fill('testpassword123');
    await page.getByRole('button', { name: "S'inscrire" }).click();
    
    await page.waitForTimeout(3000);
    const errorText = await page.locator('.auth-error').textContent().catch(() => 'no error');
    console.log('Signup error:', errorText);
    
    await expect(page).toHaveURL(/\/home/, { timeout: 20000 });
  });
});