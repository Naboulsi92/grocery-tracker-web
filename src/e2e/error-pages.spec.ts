import { test, expect } from './fixtures';

/**
 * Route error pages (ticket #122): unknown URLs land on the translated
 * not-found page (no backend needed — static boundary).
 */
test.describe('Error pages (#122)', () => {
  test('unknown URL renders the translated not-found page', async ({ page }) => {
    await page.goto('/cette-page-nexiste-pas-12345');
    await expect(page.getByRole('heading', { level: 1, name: 'Page introuvable' })).toBeVisible({
      timeout: 15000,
    });
    await page.getByRole('link', { name: "Retour à l'accueil" }).click();
    await expect(page).toHaveURL('/');
  });
});
