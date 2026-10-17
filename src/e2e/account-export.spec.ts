import * as fs from 'fs';
import { expect, test } from './fixtures';
import { PRD_FOYER_1_NAME } from '../../quality/prd-accounts';

/**
 * Export RGPD — #136 (PRD §4.11).
 *
 * Non-destructif : inscription + foyer + téléchargement depuis /account,
 * sans suppression (la suppression + grâce 7j sont couvertes en unitaire
 * src/lib/__tests__/account-export.test.ts : cas sans-foyer).
 */
test.describe('Account export RGPD (#136)', () => {
  test('downloads a JSON export with profile + household data', async ({
    authenticatedPage: page,
  }) => {
    // #237 : seeded session (export shape + seeded household name).
    const householdName = PRD_FOYER_1_NAME;

    await page.goto('/account');
    await expect(page.getByTestId('account-export-button')).toBeVisible();

    const downloadPromise = page.waitForEvent('download');
    await page.getByTestId('account-export-button').click();
    const download = await downloadPromise;

    const downloadPath = await download.path();
    expect(downloadPath).toBeTruthy();
    const exported = JSON.parse(fs.readFileSync(downloadPath as string, 'utf-8'));

    expect(exported.version).toBe(1);
    expect(typeof exported.profile?.id).toBe('string');
    expect(exported.household?.name).toBe(householdName);
    expect(Array.isArray(exported.household?.categories)).toBe(true);
    expect(Array.isArray(exported.household?.items)).toBe(true);
    expect(Array.isArray(exported.household?.history)).toBe(true);
    await expect(page.getByTestId('account-export-success')).toBeVisible();
  });
});
