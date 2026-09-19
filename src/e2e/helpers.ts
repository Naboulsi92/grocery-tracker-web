import type { Locator, Page } from '@playwright/test';
import { expect } from './fixtures';

/**
 * Shared deletion helpers for the items page.
 *
 * Deadlock source (trace-proven, NOT animation instability): `handleDelete`
 * opens a SYNCHRONOUS native `confirm()` as the first statement of the click
 * handler (`src/app/items/page.tsx`). The old lazy order — `waitForEvent`
 * then `click()` then `accept()` — deadlocks because the modal opens mid-click
 * (CDP input round-trip), so `click()` never resolves and `accept()` is
 * unreachable. Eager `page.once('dialog', accept)` registered BEFORE the click
 * unblocks it, mirroring every passing delete site in the suite. Animation
 * draining is kept only as a pre-click stability nicety (harmless), and
 * row-detach/count assertions after each click remain the post-conditions.
 */
export async function waitForAnimationsToSettle(page: Page, timeout = 10000) {
  await expect
    .poll(
      () =>
        page.evaluate(
          () =>
            document.getAnimations().filter((animation) => animation.playState === 'running').length,
        ),
      { timeout },
    )
    .toBe(0);
}

async function acceptDeleteDialog(page: Page, deleteButton: Locator) {
  await expect(deleteButton).toBeVisible();
  await expect(deleteButton).toBeEnabled();
  await deleteButton.scrollIntoViewIfNeeded();
  await waitForAnimationsToSettle(page);
  page.once('dialog', (dialog) => void dialog.accept());
  await deleteButton.click();
}

/**
 * Deletes every `.item-row` on the items page, waiting for list quiescence
 * after each deletion: the deleted row must detach and the row count must
 * drop before the next click, and animations must drain before every click
 * (including the first, which lands inside the page-mount animation wave).
 */
export async function deleteAllItems(page: Page) {
  const rows = page.locator('.item-row');
  const emptyState = page.locator('.empty-state');
  await expect
    .poll(
      async () => ((await rows.count()) > 0 ? 'rows' : (await emptyState.count()) > 0 ? 'empty' : 'loading'),
      { timeout: 15000 },
    )
    .not.toBe('loading');

  let remaining = await rows.count();
  await waitForAnimationsToSettle(page);
  while (remaining > 0) {
    const rowTestId = await rows.first().getAttribute('data-testid');
    await acceptDeleteDialog(page, rows.first().getByTestId(/^btn-delete-item-/));
    if (rowTestId) {
      await expect(page.locator(`[data-testid="${rowTestId}"]`)).toHaveCount(0);
    }
    await expect(rows).toHaveCount(remaining - 1);
    await waitForAnimationsToSettle(page);
    remaining -= 1;
  }
}

/**
 * Deletes a single item row and waits for its detachment. Used for
 * mid-test deletions where the page settled long before the click.
 */
export async function deleteItemRow(page: Page, row: Locator) {
  const rowTestId = await row.getAttribute('data-testid');
  await acceptDeleteDialog(page, row.getByTestId(/^btn-delete-item-/));
  await waitForAnimationsToSettle(page);
  if (rowTestId) {
    await expect(page.locator(`[data-testid="${rowTestId}"]`)).toHaveCount(0);
  } else {
    await expect(row).toHaveCount(0);
  }
}
