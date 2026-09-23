import { expect, requireWrites, signUp, test } from './fixtures';

test.describe('Signup Flow', () => {
  test('can sign up a new user', async ({ page, account }) => {
    // PRD §8 exception: the one real-signup journey (never a seed account).
    // Fail-fast without a writable backend — never a silent skip.
    requireWrites();

    await signUp(page, account);
    await expect(page.getByRole('heading', { name: 'Votre foyer' })).toBeVisible();
    await expect(page.getByRole('heading', { name: 'Créer un nouveau foyer' })).toBeVisible();
    await expect(page.getByRole('heading', { name: 'Rejoindre un foyer existant' })).toBeVisible();
  });
});
