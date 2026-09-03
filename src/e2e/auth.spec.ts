import { test, expect } from '@playwright/test';
import { createAccount } from './fixtures';

test.describe('Authentication', () => {
  test('login page loads correctly @smoke', async ({ page }) => {
    await page.goto('/login');
    await expect(page.getByRole('heading', { name: 'Connexion' })).toBeVisible();
    await expect(page.getByLabel('Email')).toBeVisible();
    await expect(page.getByLabel('Mot de passe')).toBeVisible();
    await expect(page.getByRole('button', { name: 'Se connecter' })).toBeVisible();
  });

  test('signup page loads correctly', async ({ page }) => {
    await page.goto('/signup');
    await expect(page.getByRole('heading', { name: 'Inscription' })).toBeVisible();
    await expect(page.getByLabel('Email')).toBeVisible();
    await expect(page.getByLabel('Mot de passe', { exact: true })).toBeVisible();
    await expect(page.getByLabel('Confirmer le mot de passe')).toBeVisible();
  });

  test('can navigate between login and signup', async ({ page }) => {
    await page.goto('/login');
    await page.getByRole('link', { name: "S'inscrire" }).click();
    await expect(page).toHaveURL('/signup');
    
    await page.getByRole('link', { name: 'Se connecter' }).click();
    await expect(page).toHaveURL('/login');
  });

  test('signup shows error for mismatched passwords', async ({ page }) => {
    const account = createAccount('validation');
    await page.goto('/signup');
    await page.getByLabel('Email').fill(account.email);
    await page.getByLabel('Mot de passe', { exact: true }).fill(account.password);
    await page.getByLabel('Confirmer le mot de passe').fill(`${account.password}-different`);
    await page.getByRole('button', { name: "S'inscrire" }).click();
    
    await expect(page.getByText('Les mots de passe ne correspondent pas')).toBeVisible();
  });

  test('signup requires passwords of at least 8 characters', async ({ page }) => {
    const account = createAccount('validation');
    const shortPassword = String.fromCharCode(120).repeat(7);
    await page.goto('/signup');
    await page.getByLabel('Email').fill(account.email);
    const password = page.getByLabel('Mot de passe', { exact: true });
    const confirmPassword = page.getByLabel('Confirmer le mot de passe');
    await password.fill(shortPassword);
    await confirmPassword.fill(shortPassword);

    await expect(password).toHaveAttribute('minlength', '8');
    await expect(confirmPassword).toHaveAttribute('minlength', '8');
    await expect(password).toHaveJSProperty('validity.tooShort', true);
    await expect(confirmPassword).toHaveJSProperty('validity.tooShort', true);
    await page.getByRole('button', { name: "S'inscrire" }).click();

    await expect(password).toBeFocused();

    const minimumPassword = String.fromCharCode(120).repeat(8);
    await password.fill(minimumPassword);
    await confirmPassword.fill(minimumPassword);
    await expect(password).toHaveJSProperty('validity.valid', true);
    await expect(confirmPassword).toHaveJSProperty('validity.valid', true);
  });
});

test.describe('Navigation', () => {
  test('root shows marketing homepage when not authenticated', async ({ page }) => {
    await page.goto('/');
    await expect(page).toHaveURL('/');
    await expect(page.getByRole('heading', { name: /Collaborative grocery lists/i })).toBeVisible();
  });

  test('home page redirects to login when not authenticated', async ({ page }) => {
    await page.goto('/home');
    await expect(page).toHaveURL('/login');
  });

  test('categories page redirects to login when not authenticated', async ({ page }) => {
    await page.goto('/categories');
    await expect(page).toHaveURL('/login');
  });

  test('items page redirects to login when not authenticated', async ({ page }) => {
    await page.goto('/items');
    await expect(page).toHaveURL('/login');
  });
});
