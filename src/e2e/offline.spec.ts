import { randomUUID } from 'node:crypto';
import { requireWrites, createHousehold, expect, test } from './fixtures';

function pendingQueueCount(page: import('@playwright/test').Page) {
  // Read the IndexedDB store the queue persists to (offlineQueue.ts). The app
  // does not open the DB unless an action is enqueued, so an absent store means
  // zero pending writes.
  return page.evaluate(
    () =>
      new Promise<number>((resolve) => {
        const request = indexedDB.open('grocery-offline-queue');
        request.onsuccess = () => {
          const db = request.result;
          if (!db.objectStoreNames.contains('actions')) {
            db.close();
            resolve(0);
            return;
          }
          const countRequest = db.transaction('actions', 'readonly').objectStore('actions').count();
          countRequest.onsuccess = () => {
            db.close();
            resolve(countRequest.result);
          };
          countRequest.onerror = () => {
            db.close();
            resolve(-1);
          };
        };
        request.onerror = () => resolve(-1);
      }),
  );
}

test.describe('Offline read-only mode (PRD §8 #11)', () => {
  test('items page: consultation kept, every action blocked, nothing queued', async ({ page, account }) => {
    requireWrites();
    await createHousehold(page, account);

    const itemName = `Article hors-ligne ${randomUUID().slice(0, 8)}`;
    await page.getByTestId('dashboard-card-items').click();
    await page.getByTestId('btn-new-item').click();
    await page.getByTestId('input-item-name').fill(itemName);
    await page.getByTestId('btn-create-item').click();
    await expect(page.getByText(itemName)).toBeVisible({ timeout: 10000 });

    // Cut the simulated network after the inventory is loaded.
    await page.context().setOffline(true);

    // Read-only banner shows the "Hors connexion — lecture seule" state.
    await expect(page.getByTestId('offline-banner')).toBeVisible();

    // Consultation stays possible: the already-loaded inventory is still rendered.
    const itemRow = page.locator('.item-row').filter({ hasText: itemName });
    await expect(itemRow).toBeVisible();
    await expect(page.getByTestId('btn-new-item')).toBeDisabled();

    // Every action is blocked: +/− quantity, edit, delete.
    await expect(itemRow.getByRole('button', { name: /Augmenter la quantité/ })).toBeDisabled();
    await expect(itemRow.getByRole('button', { name: /Réduire la quantité/ })).toBeDisabled();
    await expect(itemRow.getByRole('button', { name: /Modifier l'article/ })).toBeDisabled();
    await expect(itemRow.getByTestId(/^btn-delete-item-/)).toBeDisabled();

    // No write was queued: queue UI hidden and the pending store is empty.
    await expect(page.getByTestId('syncing-indicator')).toHaveCount(0);
    await expect(page.getByTestId('queue-pending-count')).toHaveCount(0);
    await expect(await pendingQueueCount(page)).toBe(0);
  });

  test('to-buy page: list still consultable, quantity confirmation blocked', async ({ page, account }) => {
    requireWrites();
    await createHousehold(page, account);

    const itemName = `Article à acheter ${randomUUID().slice(0, 8)}`;
    await page.getByTestId('dashboard-card-items').click();
    await page.getByTestId('btn-new-item').click();
    await page.getByTestId('input-item-name').fill(itemName);
    await page.getByRole('spinbutton', { name: 'Quantité', exact: true }).fill('1');
    await page.getByRole('spinbutton', { name: 'Seuil stock bas', exact: true }).fill('5');
    await page.getByTestId('btn-create-item').click();
    await expect(page.getByText(itemName)).toBeVisible({ timeout: 10000 });

    await page.goto('/to-buy');
    const itemRow = page.getByTestId(`tobuy-item-row-${itemName.toLowerCase()}`);
    await expect(itemRow).toBeVisible();
    const qtyInput = itemRow.getByTestId('tobuy-quantity-input');
    await qtyInput.fill('3');
    await expect(itemRow.getByTestId('tobuy-check-button')).toBeEnabled();

    await page.context().setOffline(true);

    await expect(page.getByTestId('offline-banner')).toBeVisible();
    // Consultation stays possible: the loaded to-buy item is still rendered.
    await expect(itemRow).toBeVisible();
    await expect(qtyInput).toBeDisabled();
    await expect(itemRow.getByTestId('tobuy-check-button')).toBeDisabled();

    await expect(page.getByTestId('syncing-indicator')).toHaveCount(0);
    await expect(await pendingQueueCount(page)).toBe(0);
  });

  test('items page: offline banner shows the exact read-only text', async ({ page, account }) => {
    requireWrites();
    await createHousehold(page, account);

    const itemName = `Article bandeau ${randomUUID().slice(0, 8)}`;
    await page.getByTestId('dashboard-card-items').click();
    await page.getByTestId('btn-new-item').click();
    await page.getByTestId('input-item-name').fill(itemName);
    await page.getByTestId('btn-create-item').click();
    await expect(page.getByText(itemName)).toBeVisible({ timeout: 10000 });

    await page.context().setOffline(true);

    // Exact banner text (fr/common.json offline.banner) — PRD §4.12 lecture seule.
    await expect(page.getByTestId('offline-banner')).toHaveText('Hors connexion — lecture seule');

    // Consultation stays possible while every action is blocked.
    const itemRow = page.locator('.item-row').filter({ hasText: itemName });
    await expect(itemRow).toBeVisible();
    await expect(page.getByTestId('btn-new-item')).toBeDisabled();
    await expect(await pendingQueueCount(page)).toBe(0);

    await page.context().setOffline(false);
    await expect(page.getByTestId('offline-banner')).toHaveCount(0);
  });

  test('micro-coupure in-flight: queued in IndexedDB, survives reload, replayed after reconnexion sans reload (PRD §4.12 + §5)', async ({
    page,
    account,
  }) => {
    requireWrites();
    await createHousehold(page, account);

    const itemName = `Article resync ${randomUUID().slice(0, 8)}`;
    await page.getByTestId('dashboard-card-items').click();
    await page.getByTestId('btn-new-item').click();
    await page.getByTestId('input-item-name').fill(itemName);
    await page.getByTestId('btn-create-item').click();
    await expect(page.getByText(itemName)).toBeVisible({ timeout: 10000 });

    const itemRow = page.locator('.item-row').filter({ hasText: itemName });
    await expect(itemRow.locator('.qty-value')).toContainText('1', { timeout: 10000 });

    // Simulate a micro-coupure hitting an in-flight write: abort only the
    // quantity RPC so page loads/reads keep working. supabase-js surfaces the
    // aborted fetch as a connectivity error (status 0) and itemOperations
    // parks the action in the IndexedDB queue (PRD §4.12).
    const rpcPattern = '**/rest/v1/rpc/adjust_item_quantity**';
    await page.route(rpcPattern, (route) => route.abort('failed'));

    await itemRow.getByRole('button', { name: /Augmenter la quantité/ }).click();

    // Enfilée IndexedDB.
    await expect.poll(() => pendingQueueCount(page), { timeout: 15000 }).toBe(1);

    // Survit au refresh: reload while the RPC is still aborted (reads are
    // unaffected). The queue processor retries in background with backoff
    // (unit-covered in offlineQueue.test.ts) but the pending action stays.
    await page.reload();
    await expect(page.getByText(itemName)).toBeVisible({ timeout: 15000 });
    await expect.poll(() => pendingQueueCount(page), { timeout: 15000 }).toBe(1);

    // Restore the network for the replay.
    await page.unroute(rpcPattern);

    // Prolonged cut → read-only mode, then reconnexion.
    const urlBeforeResync = page.url();
    await page.context().setOffline(true);
    await expect(page.getByTestId('offline-banner')).toHaveText('Hors connexion — lecture seule');

    await page.context().setOffline(false);
    await expect(page.getByTestId('offline-banner')).toHaveCount(0);

    // File vidée puis resync background sans reload page (§5 reload intégral
    // via realtime/fetch, pas de rattrapage flux seul) : la quantité rejouée
    // apparaît et l'URL est inchangée (aucun reload déclenché).
    await expect.poll(() => pendingQueueCount(page), { timeout: 20000 }).toBe(0);
    await expect(itemRow.locator('.qty-value')).toContainText('2', { timeout: 20000 });
    expect(page.url()).toBe(urlBeforeResync);
  });
});
