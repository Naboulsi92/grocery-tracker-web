import { requireWrites, createAccount, createHousehold, expect, signUp, test } from './fixtures';

test.describe('Auth navigation (ticket #48)', () => {
  test('login offers a way back to the landing page', async ({ page }) => {
    await page.goto('/login');
    await page.getByTestId('back-home-link').click();
    await expect(page).toHaveURL('/');
    await expect(page.getByTestId('hero-households-text')).toBeVisible();
  });

  test('signup offers a way back to the landing page', async ({ page }) => {
    await page.goto('/signup');
    await page.getByTestId('back-home-link').click();
    await expect(page).toHaveURL('/');
    await expect(page.getByTestId('hero-households-text')).toBeVisible();
  });

  test('onboarding returns to the landing (never the dashboard) with sign-out beside it', async ({
    browser,
  }) => {
    requireWrites();
    const context = await browser.newContext();
    const onboardingPage = await context.newPage();
    try {
      // No household yet: the join screen is the onboarding screen.
      await signUp(onboardingPage, createAccount('e2e-onboarding-nav'));

      await onboardingPage.goto('/join-household');
      await expect(onboardingPage.getByTestId('back-home-link')).toBeVisible();
      await expect(onboardingPage.getByTestId('auth-header-sign-out-button')).toBeVisible();

      await onboardingPage.getByTestId('back-home-link').click();
      await expect(onboardingPage).toHaveURL('/');
    } finally {
      await context.close();
    }
  });

  test('server redirect preserves a bookmarked deep link across sign-in (ticket #71)', async ({
    page,
    account,
    browser,
  }) => {
    requireWrites();
    await createHousehold(page, account);

    const anonContext = await browser.newContext();
    const anonPage = await anonContext.newPage();
    try {
      // Bookmarked deep link while signed out: middleware bounces with ?next=.
      await anonPage.goto('/items');
      await anonPage.waitForURL(/\/login\?next=%2Fitems/, { timeout: 15000 });

      // Sign in: straight to the bookmark, not the default landing.
      await anonPage.getByLabel('Email').fill(account.email);
      await anonPage.getByLabel('Mot de passe', { exact: true }).fill(account.password);
      await anonPage.getByRole('button', { name: 'Se connecter' }).click();
      await anonPage.waitForURL('/items', { timeout: 20000 });
      await expect(anonPage.getByRole('heading', { name: 'Articles' })).toBeVisible();
    } finally {
      await anonContext.close();
    }
  });
});
