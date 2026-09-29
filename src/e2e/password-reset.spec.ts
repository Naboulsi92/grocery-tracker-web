import { requireWrites, createAccount, expect, signUp, test } from './fixtures';
import { createClient as createSupabaseClient } from '@supabase/supabase-js';

async function adminClient() {
  const supabaseURL = process.env.E2E_SUPABASE_URL;
  const serviceRoleKey = process.env.E2E_SUPABASE_SERVICE_ROLE_KEY;
  if (!supabaseURL || !serviceRoleKey) {
    throw new Error('Database writes require E2E_SUPABASE_URL and E2E_SUPABASE_SERVICE_ROLE_KEY');
  }
  return createSupabaseClient(supabaseURL, serviceRoleKey);
}

test.describe('Password reset (ticket #164)', () => {
  test('login exposes the forgot-password entry point preserving ?next=', async ({ page }) => {
    await page.goto('/login?next=%2Fitems');
    await page.getByRole('link', { name: 'Mot de passe oublié ?' }).click();
    await expect(page).toHaveURL('/forgot-password?next=%2Fitems');
    await expect(page.getByRole('heading', { name: 'Mot de passe oublié' })).toBeVisible();
  });

  test('reset page without a session shows the expired state with retry', async ({ page }) => {
    await page.goto('/reset-password');
    await expect(page.getByTestId('reset-request-new-link')).toBeVisible();
    await page.getByTestId('reset-request-new-link').click();
    await expect(page).toHaveURL('/forgot-password');
  });

  test('callback with an invalid code lands on forgot with an error', async ({ page }) => {
    await page.goto('/auth/callback?code=invalid-code');
    await expect(page).toHaveURL(/\/forgot-password\?error=/);
    await expect(page.getByRole('heading', { name: 'Mot de passe oublié' })).toBeVisible();
  });

  test('unknown email shows an explicit error and sends nothing (decision 1)', async ({
    page,
  }) => {
    requireWrites();
    await page.goto('/forgot-password');
    await page.getByTestId('forgot-email-input').fill('ghost-unknown@example.test');
    await page.getByTestId('forgot-submit-button').click();
    await expect(page.getByRole('alert')).toContainText("Aucun compte n'existe avec cet email");
  });

  test('full loop: recovery link, new password, login with it (decision 6)', async ({
    page,
    browser,
  }) => {
    requireWrites();
    const account = createAccount('e2e-pwreset');
    await signUp(page, account);
    const newPassword = `${account.password}-new1`;

    // No inbox in CI: mint the recovery link via the Admin API, then rewrite
    // its host to the app under test (same code path as the emailed link).
    const admin = await adminClient();
    const { data, error } = await admin.auth.admin.generateLink({
      type: 'recovery',
      email: account.email,
      options: { redirectTo: 'http://localhost:3000/auth/callback?next=%2Freset-password' },
    });
    expect(error).toBeNull();
    expect(data.properties).not.toBeNull();
    const appBase = new URL(page.url()).origin;
    const url = new URL(data.properties!.action_link);
    url.protocol = new URL(appBase).protocol;
    url.host = new URL(appBase).host;

    const context = await browser.newContext();
    const recoveryPage = await context.newPage();
    try {
      await recoveryPage.goto(url.toString());
      await expect(recoveryPage.getByTestId('reset-new-password-input')).toBeVisible(
        { timeout: 20000 }
      );

      await recoveryPage.getByTestId('reset-new-password-input').fill(newPassword);
      await recoveryPage.getByTestId('reset-confirm-password-input').fill(newPassword);
      await recoveryPage.getByTestId('reset-submit-button').click();

      // Decision 6: landing is /login, signed out — reconnect with the new
      // password to prove the full loop, ending on the dashboard.
      await recoveryPage.waitForURL('/login', { timeout: 20000 });
      await recoveryPage.getByLabel('Email').fill(account.email);
      await recoveryPage.getByLabel('Mot de passe', { exact: true }).fill(newPassword);
      await recoveryPage.getByRole('button', { name: 'Se connecter' }).click();
      await recoveryPage.waitForURL('/home', { timeout: 20000 });
    } finally {
      await context.close();
    }
  });
});
