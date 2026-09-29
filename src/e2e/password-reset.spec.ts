import { requireWrites, createAccount, expect, signUp, test } from './fixtures';

const INBUCKET_URL = 'http://127.0.0.1:54324';

/** Polls the local catch-all mailbox for a message to an address. */
async function waitForEmail(toEmail: string): Promise<string> {
  let html = '';
  await expect
    .poll(
      async () => {
        // Inbucket REST: GET /api/v1/mailbox/{address} -> { messages: [...] }.
        const listResponse = await fetch(
          `${INBUCKET_URL}/api/v1/mailbox/${encodeURIComponent(toEmail)}`
        );
        if (!listResponse.ok) return null;
        const list = (await listResponse.json()) as {
          messages?: { id: string }[];
        };
        const latest = list.messages?.[0];
        if (!latest) return null;
        const detailResponse = await fetch(
          `${INBUCKET_URL}/api/v1/mailbox/${encodeURIComponent(toEmail)}/${latest.id}`
        );
        if (!detailResponse.ok) return null;
        const detail = (await detailResponse.json()) as {
          body: { html: string; text: string };
        };
        html = detail.body.html || detail.body.text || '';
        const match = html.match(/https?:\/\/[^\s"']*\/verify[^\s"']*/);
        return match?.[0].replace(/&amp;/g, '&') ?? null;
      },
      { timeout: 60000 }
    )
    .not.toBeNull();
  return html.match(/https?:\/\/[^\s"']*\/verify[^\s"']*/)?.[0].replace(/&amp;/g, '&') ?? '';
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

  test('full loop: forgot form, real email, new password, login with it (decision 6)', async ({
    page,
    browser,
  }) => {
    requireWrites();
    const account = createAccount('e2e-pwreset');
    await signUp(page, account);
    const newPassword = `${account.password}-new1`;

    // Real user path, no Admin API: submit the forgot form (the known email
    // passes the DB existence check), then catch the actual email in the
    // local Inbucket mailbox and follow its recovery link. This exercises the
    // shipped redirectTo end to end — the admin generateLink endpoint
    // demonstrably drops custom redirect_to (silent site_url fallback), so it
    // cannot prove this flow.
    await page.goto('/forgot-password');
    await page.getByTestId('forgot-email-input').fill(account.email);
    await page.getByTestId('forgot-submit-button').click();
    await expect(page.getByTestId('forgot-success')).toBeVisible();

    const recoveryLink = await waitForEmail(account.email);

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
