import { PRD_FOYER_1_NAME, PRD_FOYER_2_NAME } from '../../quality/prd-accounts';
import { test, expect } from './fixtures';

/**
 * PRD §comptes-de-test: the three dedicated addresses must be usable for
 * automated tests. Global-setup reseeds them (writable lane only) with
 * their foyers — household1.userA + household1.userB share foyer 1,
 * household2.userA owns isolated foyer 2 — so each login lands on /home
 * with its seeded household already loaded. No shared foyer is mutated,
 * so the three logins stay interference-free in parallel workers.
 */
test.describe('PRD seed accounts', () => {
  const cases = [
    { role: 'household1.userA', foyer: PRD_FOYER_1_NAME },
    { role: 'household1.userB', foyer: PRD_FOYER_1_NAME },
    { role: 'household2.userA', foyer: PRD_FOYER_2_NAME },
  ] as const;
  for (const { role, foyer } of cases) {
    test(`${role} can log in and sees ${foyer}`, async ({ page, prdAccounts }) => {
      const account = prdAccounts.find((candidate) => candidate.role === role);
      expect(account).toBeDefined();

      await page.goto('/login');
      await expect(page.getByRole('heading', { name: 'Connexion' })).toBeVisible();

      await page.getByLabel('Email').fill(account!.email);
      await page.getByLabel('Mot de passe').fill(account!.password);
      await page.getByRole('button', { name: 'Se connecter' }).click();

      // Authenticated users leave /login for /home (never back to /login).
      await expect(page).toHaveURL('/home', { timeout: 20000 });
      await expect(page.getByRole('heading', { level: 1, name: foyer })).toBeVisible();
    });
  }
});
