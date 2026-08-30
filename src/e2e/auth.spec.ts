import { test, expect } from '@playwright/test';

test.describe('Authentication', () => {
  test('login page loads correctly', async ({ page }) => {
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
    await page.goto('/signup');
    await page.getByLabel('Email').fill('test@example.com');
    await page.getByLabel('Mot de passe', { exact: true }).fill('password123');
    await page.getByLabel('Confirmer le mot de passe').fill('differentpassword');
    await page.getByRole('button', { name: "S'inscrire" }).click();
    
    await expect(page.getByText('Les mots de passe ne correspondent pas')).toBeVisible();
  });

  test('signup shows error for short password', async ({ page }) => {
    await page.goto('/signup');
    await page.getByLabel('Email').fill('test@example.com');
    await page.getByLabel('Mot de passe', { exact: true }).fill('123');
    await page.getByLabel('Confirmer le mot de passe').fill('123');
    await page.getByRole('button', { name: "S'inscrire" }).click();
    
    await expect(page.getByText('Le mot de passe doit contenir au moins 6 caractères')).toBeVisible();
  });
});

test.describe('Navigation', () => {
  test('root redirects to login when not authenticated', async ({ page }) => {
    await page.goto('/');
    await expect(page).toHaveURL('/login');
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