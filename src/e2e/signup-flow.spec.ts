import { expect, signUp, test } from './fixtures';
import { e2eEnvironment, writesDisabledReason } from './environment';

test.describe('Signup Flow', () => {
  test('can sign up a new user', async ({ page, account }) => {
    test.skip(!e2eEnvironment.writesAllowed, writesDisabledReason);

    await signUp(page, account);
    await expect(page.getByRole('heading', { name: 'Votre foyer' })).toBeVisible();
    await expect(page.getByRole('heading', { name: 'Créer un nouveau foyer' })).toBeVisible();
    await expect(page.getByRole('heading', { name: 'Rejoindre un foyer existant' })).toBeVisible();
  });
});
