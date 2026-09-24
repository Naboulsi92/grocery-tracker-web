import { requireWrites, createAccount, createHousehold, expect, signUp, test } from './fixtures';

test.describe('Dashboard shell (ticket #56)', () => {
  test('signed-in member visiting the landing is taken to the dashboard', async ({ page, account }) => {
    requireWrites();
    await createHousehold(page, account);

    await page.goto('/');
    await page.waitForURL('/home', { timeout: 20000 });
    await expect(page.getByRole('heading', { name: 'Tableau de bord' })).toBeVisible();
  });

  test('anonymous visitor sees the landing immediately with no redirect', async ({ page }) => {
    await page.goto('/');
    await expect(page).toHaveURL('/');
    await expect(page.getByTestId('hero-households-text')).toBeVisible();
  });

  test('member without a household gets the onboarding prompt on the dashboard', async ({ browser }) => {
    requireWrites();
    const freshContext = await browser.newContext();
    const freshPage = await freshContext.newPage();
    try {
      // Signed up but no household yet: no-household access state.
      await signUp(freshPage, createAccount('e2e-no-household'));

      await freshPage.goto('/home');
      await expect(freshPage.getByTestId('onboarding-join-button')).toBeVisible();
      await expect(freshPage.getByTestId('onboarding-sign-out-button')).toBeVisible();

      // The prompt leads to the join flow, which lands back on the dashboard.
      await freshPage.getByTestId('onboarding-join-button').click();
      await expect(freshPage).toHaveURL('/join-household');
    } finally {
      await freshContext.close();
    }
  });

  test('member without a household is still bounced from data screens', async ({ browser }) => {
    requireWrites();
    const freshContext = await browser.newContext();
    const freshPage = await freshContext.newPage();
    try {
      await signUp(freshPage, createAccount('e2e-no-household-guard'));

      await freshPage.goto('/items');
      await freshPage.waitForURL('/join-household', { timeout: 20000 });
    } finally {
      await freshContext.close();
    }
  });
});
