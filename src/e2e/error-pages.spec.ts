import { test, expect } from './fixtures';

/**
 * Route error pages (ticket #122). Unknown URLs fail closed to /login
 * (deny-default, #115) rather than rendering not-found: not-found.tsx serves
 * explicit notFound() calls (unit-covered). This smoke test pins the
 * fail-closed behavior on an unknown URL.
 */
test.describe('Error pages (#122)', () => {
  test('unknown URL fails closed to login', async ({ page }) => {
    await page.goto('/cette-page-nexiste-pas-12345');
    // Ticket #71 : deny-default still fails closed to sign-in, now carrying
    // the attempted destination in ?next=.
    await expect(page).toHaveURL('/login?next=%2Fcette-page-nexiste-pas-12345', { timeout: 15000 });
    await expect(page.getByRole('heading', { level: 1, name: 'Connexion' })).toBeVisible();
  });
});
