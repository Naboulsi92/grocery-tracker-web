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
    // RFC 2606 reserved domain: never a real credential (secret scanner).
    await page.getByTestId('forgot-email-input').fill('ghost-unknown@example.com');
    await page.getByTestId('forgot-submit-button').click();
    // Scoped to the app banner: Next's route announcer also carries role=alert.
    await expect(page.locator('.auth-error')).toContainText("Aucun compte n'existe avec cet email");
  });

  test('full loop: recovery link, new password, login with it (decision 6)', async ({
    page,
    browser,
  }) => {
    requireWrites();
    const account = createAccount('e2e-pwreset');
    await signUp(page, account);
    const newPassword = `${account.password}-new1`;

    // No inbox in CI: mint the recovery link via the Admin API and follow it
    // as-is. It points at GoTrue (/auth/v1/verify), which exchanges the
    // token and redirects to our callback — never rewrite its host to the
    // app (that path does not exist there and the middleware would bounce
    // it to /login).
    const admin = await adminClient();
    // redirectTo aligned with the app under test (both localhost and
    // 127.0.0.1 are allowlisted in supabase/config.toml). Deliberately bare:
    // GoTrue silently falls back to site_url on nested-query redirect URLs,
    // and the reset page lands on /login anyway (decision 6) — a forwarded
    // destination adds failure surface for zero value here.
    const appBase = process.env.E2E_BASE_URL ?? 'http://localhost:3000';
    const { data, error } = await admin.auth.admin.generateLink({
      type: 'recovery',
      email: account.email,
      options: { redirectTo: `${appBase}/auth/callback` },
    });
    expect(error).toBeNull();
    expect(data.properties).not.toBeNull();
    // Pin the generation contract before navigating: GoTrue host shape +
    // echoed redirect_to (all token-free). If either fails, generation —
    // not navigation — dropped the destination.
    const generated = new URL(data.properties!.action_link);
    expect(generated.pathname).toBe('/auth/v1/verify');
    expect(data.properties!.redirect_to).toContain('/auth/callback');
    const recoveryLink = data.properties!.action_link;

    const context = await browser.newContext();
    const recoveryPage = await context.newPage();
    try {
      await recoveryPage.goto(recoveryLink);
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
