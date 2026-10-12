import { requireWrites, createAccount, expect, test } from './fixtures';
import { createClient as createSupabaseClient } from '@supabase/supabase-js';

async function adminClient() {
  const supabaseURL = process.env.E2E_SUPABASE_URL;
  const serviceRoleKey = process.env.E2E_SUPABASE_SERVICE_ROLE_KEY;
  if (!supabaseURL || !serviceRoleKey) {
    throw new Error('Database writes require E2E_SUPABASE_URL and E2E_SUPABASE_SERVICE_ROLE_KEY');
  }
  return createSupabaseClient(supabaseURL, serviceRoleKey);
}

// Ticket #227 : les confirmations email sont ON côté serveur — un compte
// non confirmé doit voir l'erreur + le renvoi, sans navigation.
test.describe('Email confirmation', () => {
  test('unconfirmed login shows the error and resends on demand', async ({ page }) => {
    requireWrites();
    const account = createAccount('unconfirmed');
    const admin = await adminClient();
    const { data, error: createError } = await admin.auth.admin.createUser({
      email: account.email,
      password: account.password,
      email_confirm: false,
    });
    if (createError) throw createError;

    try {
      await page.goto('/login');
      await page.getByLabel('Email').fill(account.email);
      await page.getByLabel('Mot de passe').fill(account.password);
      await page.getByRole('button', { name: 'Se connecter' }).click();

      await expect(page.getByText(/non confirm|not confirmed/i)).toBeVisible({ timeout: 15000 });
      await expect(page.getByTestId('login-resend-confirmation')).toBeVisible();
      await page.getByTestId('login-resend-confirmation').click();
      await expect(page.getByTestId('login-confirmation-resent')).toBeVisible({ timeout: 15000 });
      await expect(page).toHaveURL('/login');
    } finally {
      await admin.auth.admin.deleteUser(data.user.id);
    }
  });
});
