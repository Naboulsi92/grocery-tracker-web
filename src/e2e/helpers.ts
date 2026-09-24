import type { Locator, Page } from '@playwright/test';
import { expect } from './fixtures';

/**
 * Shared deletion helpers for the items page.
 *
 * Deletions go through the custom AccessibleDialog (ticket #119): no native
 * `confirm()` anymore. Clicking delete opens the dialog; the caller confirms
 * explicitly via its testid, then the row-detach/count assertions below are
 * the post-conditions.
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

/**
 * Reads a fresh invitation token via the members page (ticket #145).
 * Centralizes the two-context token fetch so multi-user tests stop
 * copy-pasting the goto/members/create/read sequence. Throws on an empty
 * token instead of letting callers join with ''' (fail-fast, never a
 * vacuous pass).
 */
export async function fetchInviteToken(page: Page): Promise<string> {
  await page.goto('/home');
  await page.getByRole('link', { name: /Membres/ }).click();
  await page.getByRole('button', { name: 'Créer une invitation' }).click();
  const token = await page.locator('.invite-code-text').textContent();
  if (!token) throw new Error('Invite token was empty.');
  return token;
}

/**
 * Bounded wait for an OPTIONAL UI signal (replaces fixed sleeps before
 * conditional assertions): resolves `true` the moment the
 * locator becomes visible, `false` after `timeout` with no signal. Callers
 * keep their branching untouched; the suite just stops sleeping blindly and
 * returns early when the signal lands.
 */
export async function didBecomeVisible(locator: Locator, timeout = 5000): Promise<boolean> {
  try {
    await expect(locator.first()).toBeVisible({ timeout });
    return true;
  } catch {
    return false;
  }
}

/**
 * Clicks a delete button, then confirms in the AccessibleDialog via its
 * confirm testid. Items and categories each expose their own confirm testid
 * (`item-delete-confirm` / `category-delete-confirm`).
 */
export async function confirmDeleteDialog(page: Page, deleteButton: Locator, confirmTestId: string) {
  await expect(deleteButton).toBeVisible();
  await expect(deleteButton).toBeEnabled();
  await deleteButton.scrollIntoViewIfNeeded();
  await waitForAnimationsToSettle(page);
  await deleteButton.click();
  const confirmButton = page.getByTestId(confirmTestId);
  await expect(confirmButton).toBeVisible({ timeout: 10000 });
  await confirmButton.click();
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
    await confirmDeleteDialog(page, rows.first().getByTestId(/^btn-delete-item-/), 'item-delete-confirm');
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
  await confirmDeleteDialog(page, row.getByTestId(/^btn-delete-item-/), 'item-delete-confirm');
  await waitForAnimationsToSettle(page);
  if (rowTestId) {
    await expect(page.locator(`[data-testid="${rowTestId}"]`)).toHaveCount(0);
  } else {
    await expect(row).toHaveCount(0);
  }
}
