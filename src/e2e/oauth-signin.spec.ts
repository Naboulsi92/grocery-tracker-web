import { expect, test } from './fixtures';

test.describe('OAuth sign-in (ticket #166)', () => {
  test('login and signup expose the Google button', async ({ page }) => {
    await page.goto('/login');
    await expect(page.getByTestId('oauth-google-button')).toBeVisible();

    await page.goto('/signup');
    await expect(page.getByTestId('oauth-google-button')).toBeVisible();
  });

  // No test Google account exists anywhere (local or CI), so completion is
  // manual QA (see issue #166). What IS proven here: clicking initiates the
  // GoTrue round-trip with the right provider and our callback as the
  // destination. The request is aborted before leaving — no side effects.
  test('google button initiates the provider round-trip', async ({ page }) => {
    let authorizeUrl: string | null = null;
    await page.route('**/auth/v1/authorize**', async (route) => {
      authorizeUrl = route.request().url();
      await route.abort();
    });

    await page.goto('/login');
    await page.getByTestId('oauth-google-button').click();
    await expect
      .poll(() => authorizeUrl, { timeout: 15000 })
      .not.toBeNull();
    expect(authorizeUrl).toContain('provider=google');
    expect(authorizeUrl).toContain(encodeURIComponent('/auth/callback'));
  });
});
