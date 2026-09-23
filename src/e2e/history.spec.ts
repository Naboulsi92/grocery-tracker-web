import { randomUUID } from 'node:crypto';
import { test, expect } from './fixtures';

/**
 * Ticket #105: member history write path through RLS. The P1-10 rotation
 * test seeds via the admin client (bypasses RLS); this test proves an
 * authenticated member's own actions land in history (the path that warned
 * 42501 in CI logs). Uses the seeded foyer 1 account with UUID names, so it
 * never collides with other tests sharing the seed.
 */
test.describe('Member history writes (#105)', () => {
  test.use({ accountRole: 'household1.userA' });

  test('deleting an item records a suppression entry visible in /history', async ({
    authenticatedPage,
  }) => {
    const itemName = `Article hist ${randomUUID()}`;
    await authenticatedPage.getByTestId('dashboard-card-items').click();
    await authenticatedPage.getByTestId('btn-new-item').click();
    await authenticatedPage.getByTestId('input-item-name').fill(itemName);
    await authenticatedPage.getByTestId('btn-create-item').click();
    await expect(authenticatedPage.getByText(itemName)).toBeVisible({ timeout: 10000 });

    await authenticatedPage
      .locator('.item-row')
      .filter({ hasText: itemName })
      .getByTestId(/^btn-delete-item-/)
      .click();
    await authenticatedPage.getByTestId('item-delete-confirm').click();
    await expect(authenticatedPage.getByText(itemName)).toHaveCount(0);

    await authenticatedPage.goto('/history');
    await expect(
      authenticatedPage
        .locator('[data-testid^="history-entry-"]')
        .filter({ hasText: itemName })
        .first(),
    ).toBeVisible({ timeout: 15000 });
  });
});
