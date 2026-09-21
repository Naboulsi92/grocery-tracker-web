import { createAccount, createHousehold, expect, signUp, test } from './fixtures';
import {
  e2eEnvironment,
  fixtureRequiredReason,
  writesDisabledReason,
} from './environment';

const LEAVE_HINT =
  "Vous perdrez l'accès à l'inventaire. L'autre membre garde toutes les données.";

/**
 * Compte/foyer lifecycle — #110 P1-9 (PRD §4.8, §4.9, §5).
 *
 * - Quit: exact dialog wording + Confirmer/Annuler, 0 inventory reads after
 *   departure, other member keeps everything indefinitely.
 * - Account deletion UI states the 7-day restore window (soft-delete +
 *   reconnect-cancel + cron purge are pinned at unit level in
 *   src/__tests__/lifecycle.test.ts and by the CI database security contract).
 * - 0-member cascade (custom/items/history purged, templates + defaults
 *   intact) is pinned at unit level — no destructive DB write here.
 */
test.describe('Household lifecycle P1-9 (#110)', () => {
  test('quit dialog shows the exact PRD wording with Confirmer/Annuler', async ({
    page,
    account,
  }) => {
    test.skip(!e2eEnvironment.writesAllowed, writesDisabledReason);
    await createHousehold(page, account);

    await page.goto('/household');
    // The leave section states the same exact warning as the dialog (shared key).
    await expect(page.getByText(LEAVE_HINT, { exact: true }).first()).toBeVisible();
    await page.getByTestId('leave-household-button').click();

    const dialog = page.getByRole('dialog');
    await expect(dialog).toBeVisible();
    await expect(dialog.getByText('Quitter le foyer ?', { exact: true })).toBeVisible();
    await expect(dialog.getByText(LEAVE_HINT, { exact: true })).toBeVisible();
    await expect(dialog.getByRole('button', { name: 'Confirmer' })).toBeVisible();
    await expect(dialog.getByRole('button', { name: 'Annuler' })).toBeVisible();

    // Cancelling dismisses the dialog without leaving.
    await dialog.getByRole('button', { name: 'Annuler' }).click();
    await expect(dialog).not.toBeVisible();
    await expect(page.getByTestId('leave-household-button')).toBeVisible();
  });

  test('leaver loses inventory access after confirming (0 reads)', async ({
    page,
    account,
  }) => {
    test.skip(!e2eEnvironment.writesAllowed, fixtureRequiredReason);
    const householdName = await createHousehold(page, account);

    await page.goto('/household');
    await page.getByTestId('leave-household-button').click();
    await page.getByTestId('leave-household-confirm').click();

    // Post-leave screen: no inventory access.
    await expect(page.getByText('Vous avez quitté le foyer')).toBeVisible();
    await expect(page.getByText("Vous n'avez plus accès à l'inventaire.")).toBeVisible();

    // The former household is no longer readable.
    await page.goto('/home');
    await expect(page.getByRole('heading', { level: 1, name: householdName })).not.toBeVisible();
  });

  test('other member keeps all data after a departure', async ({
    page,
    account,
    browser,
  }) => {
    test.skip(!e2eEnvironment.writesAllowed, fixtureRequiredReason);
    const householdName = await createHousehold(page, account);

    await page.getByRole('link', { name: /Membres/ }).click();
    await page.getByRole('button', { name: 'Créer une invitation' }).click();
    const token = page.locator('.invite-code-text');
    await expect(token).not.toBeEmpty();
    const invitationToken = await token.textContent();

    const memberContext = await browser.newContext();
    const memberPage = await memberContext.newPage();
    const memberAccount = createAccount('e2e-member');
    try {
      await signUp(memberPage, memberAccount);
      await memberPage.getByLabel(/Code d.invitation complet/).fill(invitationToken!);
      await memberPage.getByRole('button', { name: 'Rejoindre le foyer' }).click();
      await memberPage.waitForURL('/home', { timeout: 20000 });
      await expect(
        memberPage.getByRole('heading', { level: 1, name: householdName }),
      ).toBeVisible();

      // First member leaves.
      await page.goto('/household');
      await page.getByTestId('leave-household-button').click();
      await page.getByTestId('leave-household-confirm').click();
      await expect(page.getByText('Vous avez quitté le foyer')).toBeVisible();

      // The remaining member keeps the household indefinitely.
      await memberPage.goto('/home');
      await expect(
        memberPage.getByRole('heading', { level: 1, name: householdName }),
      ).toBeVisible();
      await memberPage.goto('/members');
      await expect(memberPage.getByRole('heading', { name: 'Membres du foyer (1)' })).toBeVisible();
    } finally {
      await memberContext.close();
    }
  });

  test('account deletion dialog states the 7-day restore window', async ({
    page,
    account,
  }) => {
    test.skip(!e2eEnvironment.writesAllowed, writesDisabledReason);
    await createHousehold(page, account);

    await page.goto('/account');
    await expect(page.getByText(/pendant 7 jours, après quoi vos données seront définitivement effacées/)).toBeVisible();

    await page.getByTestId('account-delete-button').click();
    const dialog = page.getByRole('dialog');
    await expect(dialog).toBeVisible();
    await expect(dialog.getByText('Supprimer votre compte ?', { exact: true })).toBeVisible();
    await expect(
      dialog.getByText(
        'Vous pourrez réactiver votre compte en vous reconnectant dans les 7 jours. Passé ce délai, vos données seront supprimées définitivement.',
        { exact: true },
      ),
    ).toBeVisible();
    await expect(dialog.getByText(/réactiver votre compte/)).toBeVisible();
    await expect(dialog.getByText(/7 jours/)).toBeVisible();
    await expect(dialog.getByRole('button', { name: 'Supprimer' })).toBeVisible();
    await expect(dialog.getByRole('button', { name: 'Annuler' })).toBeVisible();

    // Restore/purge timing is pinned at unit level; never confirm here.
    await dialog.getByRole('button', { name: 'Annuler' }).click();
    await expect(dialog).not.toBeVisible();
  });
});
