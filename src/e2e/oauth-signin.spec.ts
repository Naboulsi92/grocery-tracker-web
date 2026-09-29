import { expect, test } from './fixtures';

test.describe('OAuth sign-in (ticket #166)', () => {
  test('login and signup expose both provider buttons', async ({ page }) => {
    await page.goto('/login');
    await expect(page.getByTestId('oauth-google-button')).toBeVisible();
    await expect(page.getByTestId('oauth-apple-button')).toBeVisible();

    await page.goto('/signup');
    await expect(page.getByTestId('oauth-google-button')).toBeVisible();
    await expect(page.getByTestId('oauth-apple-button')).toBeVisible();
  });

  // No test Google/Apple accounts exist anywhere (local or CI), so completion
  // is manual QA (see issue #166). What IS proven here: clicking initiates
  // the GoTrue round-trip with the right provider and our callback as the
  // destination. The request is aborted before leaving — no side effects.
  for (const provider of ['google', 'apple'] as const) {
    test(`${provider} button initiates the provider round-trip`, async ({ page }) => {
      let authorizeUrl: string | null = null;
      await page.route('**/auth/v1/authorize**', async (route) => {
        authorizeUrl = route.request().url();
        await route.abort();
      });

      await page.goto('/login');
      await page.getByTestId(`oauth-${provider}-button`).click();
      await expect
        .poll(() => authorizeUrl, { timeout: 15000 })
        .not.toBeNull();
      expect(authorizeUrl).toContain(`provider=${provider}`);
      expect(authorizeUrl).toContain(encodeURIComponent('/auth/callback'));
    });
  }
});
