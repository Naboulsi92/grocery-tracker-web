import { PRD_FOYER_1_NAME, PRD_FOYER_2_NAME } from '../../quality/prd-accounts';
import { test, expect } from './fixtures';

/**
 * PRD §comptes-de-test: the three dedicated addresses must be usable for
 * automated tests. Global-setup reseeds them (writable lane only) with
 * their foyers — household1.userA + household1.userB share foyer 1,
 * household2.userA owns isolated foyer 2. Each case consumes the shared
 * `authenticatedPage` fixture (UI login once per role per run, then
 * `storageState` reuse) and proves it lands on /home with its seeded
 * household loaded. Requiring the fixture is fail-fast: without a seeded
 * backend these tests error instead of skipping silently.
 */
test.describe('PRD seed accounts', () => {
  const cases = [
    { role: 'household1.userA', foyer: PRD_FOYER_1_NAME },
    { role: 'household1.userB', foyer: PRD_FOYER_1_NAME },
    { role: 'household2.userA', foyer: PRD_FOYER_2_NAME },
  ] as const;
  for (const { role, foyer } of cases) {
    test.describe(role, () => {
      test.use({ accountRole: role });
      test(`can log in and sees ${foyer}`, async ({ authenticatedPage }) => {
        // Authenticated users stay on /home (never bounced back to /login).
        await expect(authenticatedPage).toHaveURL('/home');
        await expect(authenticatedPage.getByTestId('header-household-name')).toHaveText(foyer);
      });
    });
  }
});
