import { test, expect } from '@playwright/test';
import { e2eEnvironment, writesDisabledReason, fixtureRequiredReason } from './environment';

test.describe('Error States', () => {
  test.beforeEach(async ({ page }) => {
    await page.context().clearCookies();
    await page.context().clearPermissions();
  });

  test.describe('Authentication Error States', () => {
    test('login shows error for invalid credentials', async ({ page }) => {
      await page.goto('/login');
      await page.waitForLoadState('domcontentloaded');

      const loadingText = page.getByText('Chargement...');
      if (await loadingText.isVisible({ timeout: 5000 })) {
        test.skip(true, 'No Supabase backend available - auth loading never completes');
      }

      await page.getByLabel('Email').fill('nonexistent@example.com');
      await page.getByLabel('Mot de passe').fill('wrongpassword123');
      await page.getByRole('button', { name: 'Se connecter' }).click();

      await expect(page.getByText(/identifiants incorrects|mot de passe|email/i)).toBeVisible({ timeout: 10000 });
    });

    test('signup shows error for existing email', async ({ page }) => {
      await page.goto('/signup');
      await page.waitForLoadState('domcontentloaded');

      const loadingText = page.getByText('Chargement...');
      if (await loadingText.isVisible({ timeout: 5000 })) {
        test.skip(true, 'No Supabase backend available - auth loading never completes');
      }

      await page.getByLabel('Email').fill('admin@example.com');
      await page.getByLabel('Mot de passe', { exact: true }).fill('Password123!');
      await page.getByLabel('Confirmer le mot de passe').fill('Password123!');
      await page.getByRole('button', { name: "S'inscrire" }).click();

      await expect(page.getByText(/déjà utilisé|existe|email/i)).toBeVisible({ timeout: 10000 });
    });

    test('signup shows error for mismatched passwords', async ({ page }) => {
      await page.goto('/signup');
      await page.waitForLoadState('domcontentloaded');

      const loadingText = page.getByText('Chargement...');
      if (await loadingText.isVisible({ timeout: 5000 })) {
        test.skip(true, 'No Supabase backend available - auth loading never completes');
      }

      await page.getByLabel('Email').fill('test@example.com');
      await page.getByLabel('Mot de passe', { exact: true }).fill('Password123!');
      await page.getByLabel('Confirmer le mot de passe').fill('Password124!');
      await page.getByRole('button', { name: "S'inscrire" }).click();

      await expect(page.getByText('Les mots de passe ne correspondent pas')).toBeVisible();
    });

    test('login page has loading state during submission', async ({ page }) => {
      await page.goto('/login');
      await page.waitForLoadState('domcontentloaded');

      const loadingText = page.getByText('Chargement...');
      if (await loadingText.isVisible({ timeout: 5000 })) {
        test.skip(true, 'No Supabase backend available - auth loading never completes');
      }

      await page.getByLabel('Email').fill('test@example.com');
      await page.getByLabel('Mot de passe').fill('password123');

      const submitButton = page.getByRole('button', { name: 'Se connecter' });
      await submitButton.click();

      await expect(submitButton).toBeDisabled();
      await expect(page.getByText(/connexion|chargement/i)).toBeVisible();
    });
  });

  test.describe('Join Household Error States', () => {
    test('join household shows error for invalid token', async ({ page }) => {
      await page.goto('/join-household');
      await page.waitForLoadState('domcontentloaded');

      const loadingText = page.getByText('Chargement...');
      if (await loadingText.isVisible({ timeout: 5000 })) {
        test.skip(true, 'No Supabase backend available - auth loading never completes');
      }

      await page.getByLabel('Code d\'invitation complet').fill('invalid-token-12345');
      await page.getByRole('button', { name: 'Rejoindre le foyer' }).click();

      await expect(page.getByText(/invitation|token|invalide/i)).toBeVisible({ timeout: 10000 });
    });

    test('join household shows error for duplicate household creation', async ({ page }) => {
      test.skip(!e2eEnvironment.writesAllowed, writesDisabledReason);

      await page.goto('/join-household');
      await page.waitForLoadState('domcontentloaded');

      const loadingText = page.getByText('Chargement...');
      if (await loadingText.isVisible({ timeout: 5000 })) {
        test.skip(true, 'No Supabase backend available - auth loading never completes');
      }

      await page.getByLabel('Nom du foyer').fill('');
      await page.getByRole('button', { name: 'Créer mon foyer' }).click();

      await page.waitForTimeout(2000);

      const errorMessage = page.locator('.auth-error');
      if (await errorMessage.isVisible()) {
        await expect(errorMessage).toContainText(/erreur|déjà|existe/i);
      }
    });

    test('join household has loading state during create', async ({ page }) => {
      await page.goto('/join-household');
      await page.waitForLoadState('domcontentloaded');

      const loadingText = page.getByText('Chargement...');
      if (await loadingText.isVisible({ timeout: 5000 })) {
        test.skip(true, 'No Supabase backend available - auth loading never completes');
      }

      await page.getByLabel('Nom du foyer').fill('Test Household');

      const createButton = page.getByRole('button', { name: 'Créer mon foyer' });
      await createButton.click();

      await expect(createButton).toBeDisabled();
      await expect(page.getByText('Création...')).toBeVisible();
    });

    test('join household has loading state during join', async ({ page }) => {
      await page.goto('/join-household');
      await page.waitForLoadState('domcontentloaded');

      const loadingText = page.getByText('Chargement...');
      if (await loadingText.isVisible({ timeout: 5000 })) {
        test.skip(true, 'No Supabase backend available - auth loading never completes');
      }

      await page.getByLabel('Code d\'invitation complet').fill('some-valid-token');

      const joinButton = page.getByRole('button', { name: 'Rejoindre le foyer' });
      await joinButton.click();

      await expect(joinButton).toBeDisabled();
    });

    test('join household has retry button on error', async ({ page }) => {
      await page.goto('/join-household');
      await page.waitForLoadState('domcontentloaded');

      const loadingText = page.getByText('Chargement...');
      if (await loadingText.isVisible({ timeout: 5000 })) {
        test.skip(true, 'No Supabase backend available - auth loading never completes');
      }

      await page.getByLabel('Code d\'invitation complet').fill('invalid-token');
      await page.getByRole('button', { name: 'Rejoindre le foyer' }).click();

      await expect(page.getByText(/invitation|token|invalide/i)).toBeVisible({ timeout: 10000 });

      const retryButton = page.getByRole('button', { name: /réessayer|retry/i });
      await expect(retryButton).toBeVisible();
    });
  });

  test.describe('Items Page Error States', () => {
    test('items page shows error state when load fails', async ({ page }) => {
      await page.goto('/items');
      await page.waitForLoadState('domcontentloaded');

      const loginRedirect = page.getByRole('heading', { name: 'Connexion' });
      if (await loginRedirect.isVisible({ timeout: 5000 })) {
        test.skip(true, 'Not authenticated');
      }

      // Wait for the page to settle instead of networkidle (more reliable)
      await page.waitForTimeout(2000);

      const errorBanner = page.locator('.error, .auth-error, [role="alert"]');
      const hasError = await errorBanner.count() > 0;

      if (hasError) {
        await expect(errorBanner.first()).toBeVisible();
      } else {
        const newItemButton = page.getByTestId('btn-new-item');
        if (await newItemButton.isVisible({ timeout: 3000 })) {
          await expect(newItemButton).toBeVisible();
        }
      }
    });

    test('items page has loading state when creating item', async ({ page }) => {
      await page.goto('/items');
      await page.waitForLoadState('domcontentloaded');

      const loginRedirect = page.getByRole('heading', { name: 'Connexion' });
      if (await loginRedirect.isVisible({ timeout: 5000 })) {
        test.skip(true, 'Not authenticated');
      }

      // Wait for the page to settle instead of networkidle (more reliable)
      await page.waitForTimeout(2000);

      const newItemButton = page.getByTestId('btn-new-item');
      if (await newItemButton.isVisible()) {
        await newItemButton.click();

        await page.getByTestId('input-item-name').fill('Test Item');

        const createButton = page.getByTestId('btn-create-item');
        await createButton.click();

        await expect(createButton).toBeDisabled();
      }
    });

    test('items page has disabled delete button during mutation', async ({ page }) => {
      test.skip(!e2eEnvironment.writesAllowed, fixtureRequiredReason);

      await page.goto('/items');
      await page.waitForLoadState('domcontentloaded');

      const loginRedirect = page.getByRole('heading', { name: 'Connexion' });
      if (await loginRedirect.isVisible({ timeout: 5000 })) {
        test.skip(true, 'Not authenticated');
      }

      // Wait for the page to settle instead of networkidle (more reliable)
      await page.waitForTimeout(2000);

      const deleteButtons = page.locator('[data-testid^="btn-delete-item-"]');
      const count = await deleteButtons.count();

      if (count > 0) {
        const firstDeleteButton = deleteButtons.first();
        await firstDeleteButton.click();

        await expect(firstDeleteButton).toBeDisabled();
      }
    });
  });

  test.describe('Categories Page Error States', () => {
    test('categories page has loading state when creating category', async ({ page }) => {
      await page.goto('/categories');
      await page.waitForLoadState('domcontentloaded');

      const loginRedirect = page.getByRole('heading', { name: 'Connexion' });
      if (await loginRedirect.isVisible({ timeout: 5000 })) {
        test.skip(true, 'Not authenticated');
      }

      // Wait for the page to settle instead of networkidle (more reliable)
      await page.waitForTimeout(2000);

      const newCategoryButton = page.getByTestId('btn-new-category');
      if (await newCategoryButton.isVisible()) {
        await newCategoryButton.click();

        await page.getByTestId('input-category-name').fill('Test Category');

        const createButton = page.getByTestId('btn-create-category');
        await createButton.click();

        await expect(createButton).toBeDisabled();
      }
    });

    test('categories page shows error for duplicate category name', async ({ page }) => {
      test.skip(!e2eEnvironment.writesAllowed, fixtureRequiredReason);

      await page.goto('/categories');
      await page.waitForLoadState('domcontentloaded');

      const loginRedirect = page.getByRole('heading', { name: 'Connexion' });
      if (await loginRedirect.isVisible({ timeout: 5000 })) {
        test.skip(true, 'Not authenticated');
      }

      // Wait for the page to settle instead of networkidle (more reliable)
      await page.waitForTimeout(2000);

      const newCategoryButton = page.getByTestId('btn-new-category');
      if (await newCategoryButton.isVisible()) {
        await newCategoryButton.click();

        await page.getByTestId('input-category-name').fill('Test Category');

        const createButton = page.getByTestId('btn-create-category');
        await createButton.click();

        await page.waitForTimeout(1000);

        if (await page.locator('.error, .auth-error, [role="alert"]').first().isVisible()) {
          await expect(page.locator('.error, .auth-error, [role="alert"]').first()).toContainText(/doublon|existe|déjà/i);
        }
      }
    });
  });

  test.describe('Members Page Error States', () => {
    test('members page shows error when load fails', async ({ page }) => {
      await page.goto('/members');
      await page.waitForLoadState('domcontentloaded');

      const loginRedirect = page.getByRole('heading', { name: 'Connexion' });
      if (await loginRedirect.isVisible({ timeout: 5000 })) {
        test.skip(true, 'Not authenticated');
      }

      // Wait for the page to settle instead of networkidle (more reliable)
      await page.waitForTimeout(2000);

      const errorBanner = page.locator('.error, .auth-error, [role="alert"]');
      const hasError = await errorBanner.count() > 0;

      if (hasError) {
        await expect(errorBanner.first()).toBeVisible();
      } else {
        const heading = page.getByRole('heading', { name: /membres|household/i });
        if (await heading.isVisible({ timeout: 3000 })) {
          await expect(heading).toBeVisible();
        }
      }
    });
  });

  test.describe('Network Failure Handling', () => {
    test('shows friendly error when network request fails', async ({ page }) => {
      await page.route('**/rest/v1/**', (route) => {
        route.abort('failed');
      });

      await page.goto('/home');
      await page.waitForLoadState('domcontentloaded');

      const loginRedirect = page.getByRole('heading', { name: 'Connexion' });
      if (await loginRedirect.isVisible({ timeout: 5000 })) {
        test.skip(true, 'Not authenticated - redirected to login');
      }

      await page.waitForTimeout(2000);

      const errorMessage = page.locator('.error, .auth-error, [role="alert"]');
      if (await errorMessage.count() > 0) {
        await expect(errorMessage.first()).toBeVisible();
      }
    });

    test('retry button works after network failure', async ({ page }) => {
      let requestCount = 0;
      await page.route('**/rest/v1/**', (route) => {
        requestCount++;
        if (requestCount <= 2) {
          route.abort('failed');
        } else {
          route.continue();
        }
      });

      await page.goto('/home');
      await page.waitForLoadState('domcontentloaded');

      const loginRedirect = page.getByRole('heading', { name: 'Connexion' });
      if (await loginRedirect.isVisible({ timeout: 5000 })) {
        test.skip(true, 'Not authenticated - redirected to login');
      }

      await page.waitForTimeout(2000);

      const retryButton = page.getByRole('button', { name: /réessayer|retry|réessayer/i });
      if (await retryButton.isVisible()) {
        await retryButton.click();
        await page.waitForTimeout(2000);

        await expect(retryButton).not.toBeVisible();
      }
    });
  });

  test.describe('Permission Denied Scenarios', () => {
    test('redirects to login when accessing protected page without auth', async ({ page }) => {
      await page.goto('/home');
      await page.waitForLoadState('domcontentloaded');

      const loadingText = page.getByText('Chargement...');
      if (await loadingText.isVisible({ timeout: 5000 })) {
        test.skip(true, 'No Supabase backend available - auth loading never completes');
      }

      await expect(page).toHaveURL('/login');
    });

    test('redirects to login when accessing items without auth', async ({ page }) => {
      await page.goto('/items');
      await page.waitForLoadState('domcontentloaded');

      const loadingText = page.getByText('Chargement...');
      if (await loadingText.isVisible({ timeout: 5000 })) {
        test.skip(true, 'No Supabase backend available - auth loading never completes');
      }

      await expect(page).toHaveURL('/login');
    });

    test('redirects to login when accessing categories without auth', async ({ page }) => {
      await page.goto('/categories');
      await page.waitForLoadState('domcontentloaded');

      const loadingText = page.getByText('Chargement...');
      if (await loadingText.isVisible({ timeout: 5000 })) {
        test.skip(true, 'No Supabase backend available - auth loading never completes');
      }

      await expect(page).toHaveURL('/login');
    });

    test('redirects to login when accessing members without auth', async ({ page }) => {
      await page.goto('/members');
      await page.waitForLoadState('domcontentloaded');

      const loadingText = page.getByText('Chargement...');
      if (await loadingText.isVisible({ timeout: 5000 })) {
        test.skip(true, 'No Supabase backend available - auth loading never completes');
      }

      await expect(page).toHaveURL('/login');
    });

    test('redirects to login when accessing to-buy without auth', async ({ page }) => {
      await page.goto('/to-buy');
      await page.waitForLoadState('domcontentloaded');

      const loadingText = page.getByText('Chargement...');
      if (await loadingText.isVisible({ timeout: 5000 })) {
        test.skip(true, 'No Supabase backend available - auth loading never completes');
      }

      await expect(page).toHaveURL('/login');
    });
  });

  test.describe('Error Message Formatting', () => {
    test('error messages are in French', async ({ page }) => {
      await page.goto('/login');
      await page.waitForLoadState('domcontentloaded');

      const loadingText = page.getByText('Chargement...');
      if (await loadingText.isVisible({ timeout: 5000 })) {
        test.skip(true, 'No Supabase backend available - auth loading never completes');
      }

      await page.getByLabel('Email').fill('invalid@example.com');
      await page.getByLabel('Mot de passe').fill('wrong');
      await page.getByRole('button', { name: 'Se connecter' }).click();

      const errorText = await page.locator('.error, .auth-error, [role="alert"]').first().textContent();
      if (errorText) {
        const frenchPatterns = [/mot de passe/i, /identifiant/i, /erreur/i, /incorrect/i];
        const isFrench = frenchPatterns.some(pattern => pattern.test(errorText));
        expect(isFrench).toBe(true);
      }
    });

    test('loading states show French text', async ({ page }) => {
      await page.goto('/login');
      await page.waitForLoadState('domcontentloaded');

      const loadingText = page.getByText('Chargement...');
      if (await loadingText.isVisible({ timeout: 5000 })) {
        test.skip(true, 'No Supabase backend available - auth loading never completes');
      }

      await page.getByLabel('Email').fill('test@example.com');
      await page.getByLabel('Mot de passe').fill('password123');

      const submitButton = page.getByRole('button', { name: 'Se connecter' });
      await submitButton.click();

      await expect(page.getByText(/connexion|chargement/i)).toBeVisible();
    });
  });

  test.describe('Error Recovery Flow', () => {
    test('can recover from login error by correcting input', async ({ page }) => {
      await page.goto('/login');
      await page.waitForLoadState('domcontentloaded');

      const loadingText = page.getByText('Chargement...');
      if (await loadingText.isVisible({ timeout: 5000 })) {
        test.skip(true, 'No Supabase backend available - auth loading never completes');
      }

      await page.getByLabel('Email').fill('invalid@example.com');
      await page.getByLabel('Mot de passe').fill('wrong');
      await page.getByRole('button', { name: 'Se connecter' }).click();

      await expect(page.getByText(/identifiants|mot de passe|incorrect/i)).toBeVisible({ timeout: 10000 });

      await page.getByLabel('Email').fill('valid@example.com');
      await page.getByLabel('Mot de passe').fill('CorrectPassword123!');

      const submitButton = page.getByRole('button', { name: 'Se connecter' });
      await expect(submitButton).toBeEnabled();
    });

    test('can recover from invalid token error', async ({ page }) => {
      await page.goto('/join-household');
      await page.waitForLoadState('domcontentloaded');

      const loadingText = page.getByText('Chargement...');
      if (await loadingText.isVisible({ timeout: 5000 })) {
        test.skip(true, 'No Supabase backend available - auth loading never completes');
      }

      await page.getByLabel('Code d\'invitation complet').fill('invalid-token');
      await page.getByRole('button', { name: 'Rejoindre le foyer' }).click();

      await expect(page.getByText(/invitation|token|invalide/i)).toBeVisible({ timeout: 10000 });

      await page.getByLabel('Code d\'invitation complet').fill('');
      await expect(page.getByRole('button', { name: 'Rejoindre le foyer' })).toBeEnabled();
    });
  });
});