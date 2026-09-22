import { expect, test } from './fixtures';

// Ticket #113 (PRD §4.10) : bascule FR/EN sur la page publique, sans backend.
// (Déplacé hors de mobile-responsiveness.spec.ts : ce n'est pas du responsive.)
test.describe('Language switch FR/EN (#113)', () => {
  test('toggles marketing copy and html lang', async ({ page, browserName }) => {
    test.skip(browserName !== 'chromium', 'Language tests on Chromium only');
    await page.goto('/');
    await expect(page.locator('html')).toHaveAttribute('lang', 'fr');
    await expect(page.getByRole('heading', { level: 1 })).toContainText(
      'Des listes de courses collaboratives',
    );

    await page.getByRole('button', { name: 'English' }).click();
    await expect(page.locator('html')).toHaveAttribute('lang', 'en');
    await expect(page.getByRole('heading', { level: 1 })).toContainText('Collaborative grocery lists');
    expect(await page.evaluate(() => localStorage.getItem('language'))).toBe('en');

    await page.getByRole('button', { name: 'Français' }).click();
    await expect(page.locator('html')).toHaveAttribute('lang', 'fr');
    await expect(page.getByRole('heading', { level: 1 })).toContainText(
      'Des listes de courses collaboratives',
    );
  });
});
