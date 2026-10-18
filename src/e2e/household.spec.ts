import type { Page } from '@playwright/test';
import { requireWrites, createAccount, createHousehold, ensureAuthenticatedPage, expect, signUp, test } from './fixtures';

// Fusion Membres → Foyer : l'écran /household couvre le nom du foyer, les
// membres, l'invitation (générer / régénérer via dialogue de confirmation /
// révoquer depuis la vue pending) et le départ. /members redirige vers
// /household (voir le dernier test).
async function gotoHousehold(page: Page) {
  await page.getByTestId('dashboard-card-household').click();
  await expect(page).toHaveURL('/household');
}

test.describe('Household Page', () => {
  test.describe('Member count (foyer 2, 1/2)', () => {
    // Foyer 2 est seedé 1/2 (household2.userA seul) : le compteur "(1)" est
    // lisible sans créer de foyer.
    test.use({ accountRole: 'household2.userA' });
    test('displays member count in heading', async ({ authenticatedPage: page }) => {
      // #237 : seeded session (foyer 2 seedé 1/2, lecture seule du compteur).
      await gotoHousehold(page);
      await expect(page.getByRole('heading', { name: /Membres du foyer/ })).toBeVisible();
      await expect(page.getByRole('heading', { name: 'Membres du foyer (1)' })).toBeVisible();
    });
  });

  test('owner can create invitation', async ({ page, account }) => {
    requireWrites();
    await createHousehold(page, account);

    await gotoHousehold(page);

    const createInvitation = page.getByRole('button', { name: 'Générer un code' });
    await expect(createInvitation).toBeVisible();
    await createInvitation.click();

    const token = page.locator('.invite-code-text');
    await expect(token).not.toBeEmpty();
    const invitationToken = await token.textContent();
    expect(invitationToken).toBeDefined();
    expect(invitationToken!.length).toBeGreaterThan(0);
  });

  test('owner can copy invitation token to clipboard', async ({ page, account }) => {
    requireWrites();
    await createHousehold(page, account);

    await gotoHousehold(page);
    await page.getByRole('button', { name: 'Générer un code' }).click();

    const token = page.locator('.invite-code-text');
    await expect(token).not.toBeEmpty();
    const invitationToken = await token.textContent();

    // Headless Chromium cannot focus the document to touch the OS clipboard, so
    // intercept writeText and capture what the copy button hands over.
    await page.evaluate(() => {
      navigator.clipboard.writeText = async (text: string) => {
        (window as Window & { __copiedText?: string }).__copiedText = text;
      };
    });

    // Two copy buttons share the 'Copier' prefix (token + link): target
    // the token one precisely by testid.
    const copyButton = page.getByTestId('invite-code-copy-button');
    await expect(copyButton).toBeVisible();
    await copyButton.click();

    await expect(page.getByRole('button', { name: 'Copié !' })).toBeVisible();
    const copiedText = await page.evaluate(
      () => (window as Window & { __copiedText?: string }).__copiedText,
    );
    expect(copiedText).toBe(invitationToken);
  });

  test('owner can regenerate the invitation (revoke + create)', async ({ page, account }) => {
    requireWrites();
    await createHousehold(page, account);

    await gotoHousehold(page);
    await page.getByRole('button', { name: 'Générer un code' }).click();

    const token = page.locator('.invite-code-text');
    await expect(token).toBeVisible();
    const firstToken = await token.textContent();

    await page.getByRole('button', { name: 'Régénérer' }).click();
    await expect(page.getByTestId('invite-regenerate-dialog')).toBeVisible();
    await page.getByTestId('invite-code-regenerate-confirm').click();

    // Le dialogue ne se ferme qu'une fois revoke + create terminés
    // (setShowRegenConfirm(false) est après les deux RPC) : attendre sa
    // disparition prouve la fin de l'aller-retour. Sans ça, toBeVisible passe
    // sur l'ancien token encore affiché et la comparaison lit une valeur périmée.
    await expect(page.getByTestId('invite-regenerate-dialog')).toHaveCount(0);

    const secondToken = page.locator('.invite-code-text');
    await expect(secondToken).toBeVisible();
    expect(await secondToken.textContent()).not.toBe(firstToken);
  });

  test('regeneration requires confirmation (cancel keeps the token)', async ({ page, account }) => {
    requireWrites();
    await createHousehold(page, account);

    await gotoHousehold(page);
    await page.getByRole('button', { name: 'Générer un code' }).click();

    const token = page.locator('.invite-code-text');
    await expect(token).toBeVisible();
    const firstToken = await token.textContent();

    await page.getByRole('button', { name: 'Régénérer' }).click();
    await expect(page.getByTestId('invite-regenerate-dialog')).toBeVisible();
    await page.getByTestId('invite-regenerate-cancel-button').click();

    await expect(page.locator('.invite-code-text')).toHaveText(firstToken!);
  });

  test('displays invitation expiration', async ({ page, account }) => {
    requireWrites();
    await createHousehold(page, account);

    await gotoHousehold(page);
    await page.getByRole('button', { name: 'Générer un code' }).click();

    const expirationText = page.getByText(/Expire le/);
    await expect(expirationText).toBeVisible();
    const expirationDate = await expirationText.textContent();
    expect(expirationDate).toMatch(/Expire le \d{1,2}\/\d{1,2}\/\d{4}/);
  });

  test.describe('Invite section (foyer 1, 2/2)', () => {
    // Foyer 1 est seedé 2/2 (owner + membre) : le second membre (userB) voit
    // la section invitation dans son état "plein" sans générer de code.
    test.use({ accountRole: 'household1.userB' });
    test('member can reach the invite section (equal rights, no owner-only gate)', async ({ authenticatedPage: page }) => {
      // #237 : seeded session (foyer 1 seedé 2/2, userB = second membre).
      await gotoHousehold(page);

      await expect(page.getByRole('heading', { name: 'Membres du foyer (2)' })).toBeVisible();

      // Equal rights: every member reaches the invite section — the owner-only gate is gone.
      const ownerOnlyMessage = page.getByText('Seul le propriétaire du foyer peut inviter de nouveaux membres.');
      await expect(ownerOnlyMessage).not.toBeVisible();

      // At 2/2 the invite section renders in its full state (no create button for anyone).
      await expect(page.getByRole('heading', { name: 'Invitation' })).toBeVisible();
      await expect(page.getByTestId('household-full-message')).toBeVisible();
    });
  });

  test('displays member role (owner vs member)', async ({ authenticatedPage: page, browser }) => {
    // #237 : seeded session (foyer 1 seedé 2/2, owner + membre).
    await gotoHousehold(page);

    // Second membre seedé du même foyer (foyer 1 déjà 2/2, pas de join).
    const memberPage = await ensureAuthenticatedPage(browser, 'household1.userB');
    try {
      await page.reload();
      const ownerLabel = page.locator('.member-joined').filter({ hasText: 'Propriétaire' });
      await expect(ownerLabel).toBeVisible();

      const memberLabel = page.locator('.member-joined').filter({ hasText: 'Membre' });
      await expect(memberLabel).toBeVisible();

      await memberPage.goto('/household');
      await expect(memberPage.locator('.member-joined').filter({ hasText: 'Propriétaire' })).toBeVisible();
      await expect(memberPage.locator('.member-joined').filter({ hasText: 'Membre' })).toBeVisible();
    } finally {
      await memberPage.context().close();
    }
  });

  test('visual confirmation when invited user joins', async ({ page, account, browser }) => {
    requireWrites();
    const householdName = await createHousehold(page, account);

    await gotoHousehold(page);
    await expect(page.getByRole('heading', { name: 'Membres du foyer (1)' })).toBeVisible();

    await page.getByRole('button', { name: 'Générer un code' }).click();
    const token = page.locator('.invite-code-text');
    const invitationToken = await token.textContent();

    const memberContext = await browser.newContext();
    const memberPage = await memberContext.newPage();
    const memberAccount = createAccount('e2e-member');
    try {
      await signUp(memberPage, memberAccount);
      await memberPage.getByLabel(/Code d.invitation complet/).fill(invitationToken!);
      await memberPage.getByRole('button', { name: 'Rejoindre le foyer' }).click();
      await memberPage.waitForURL('/home', { timeout: 20000 });

      await page.reload();
      await expect(page.getByRole('heading', { name: 'Membres du foyer (2)' })).toBeVisible();

      const memberItems = page.locator('.member-item');
      await expect(memberItems).toHaveCount(2);
    } finally {
      await memberContext.close();
    }
  });

  test('real-time updates when members join', async ({ page, account, browser }) => {
    requireWrites();
    const householdName = await createHousehold(page, account);

    await gotoHousehold(page);
    await expect(page.getByRole('heading', { name: 'Membres du foyer (1)' })).toBeVisible();

    await page.getByRole('button', { name: 'Générer un code' }).click();
    const token = page.locator('.invite-code-text');
    const invitationToken = await token.textContent();

    const memberContext = await browser.newContext();
    const memberPage = await memberContext.newPage();
    const memberAccount = createAccount('e2e-member');
    try {
      await signUp(memberPage, memberAccount);
      await memberPage.getByLabel(/Code d.invitation complet/).fill(invitationToken!);
      await memberPage.getByRole('button', { name: 'Rejoindre le foyer' }).click();
      await memberPage.waitForURL('/home', { timeout: 20000 });

      await page.reload();
      await expect(page.getByRole('heading', { name: 'Membres du foyer (2)' })).toBeVisible();
    } finally {
      await memberContext.close();
    }
  });

  test('creation shows a full link and a shown-once notice (ticket #57)', async ({ page, account }) => {
    requireWrites();
    await createHousehold(page, account);

    await gotoHousehold(page);
    await page.getByRole('button', { name: 'Générer un code' }).click();

    const token = page.locator('.invite-code-text');
    await expect(token).not.toBeEmpty();
    const invitationToken = await token.textContent();

    const link = page.getByTestId('invite-link');
    await expect(link).not.toBeEmpty();
    const linkText = await link.textContent();
    expect(linkText).toContain('/join-household?code=');
    expect(linkText).toContain(encodeURIComponent(invitationToken!));

    await expect(page.getByTestId('invite-shown-once')).toBeVisible();
  });

  test('reload shows the pending invitation without the token (ticket #57)', async ({ page, account }) => {
    requireWrites();
    await createHousehold(page, account);

    await gotoHousehold(page);
    await page.getByRole('button', { name: 'Générer un code' }).click();
    await expect(page.locator('.invite-code-text')).not.toBeEmpty();

    await page.reload();

    // Pending view: metadata only, the token is never re-displayed.
    await expect(page.getByTestId('invite-pending-display')).toBeVisible();
    await expect(page.getByTestId('invite-pending-note')).toBeVisible();
    await expect(page.locator('.invite-code-text')).toHaveCount(0);

    // Revocation from the pending view returns to the create affordance.
    await page.getByRole('button', { name: 'Révoquer' }).click();
    await expect(page.getByRole('button', { name: 'Générer un code' })).toBeVisible();
  });

  test('accepted invitation shows an accepted note after reload (ticket #57)', async ({ page, account, browser }) => {
    requireWrites();
    await createHousehold(page, account);

    await gotoHousehold(page);
    await page.getByRole('button', { name: 'Générer un code' }).click();
    const invitationToken = await page.locator('.invite-code-text').textContent();

    const memberContext = await browser.newContext();
    const memberPage = await memberContext.newPage();
    try {
      await signUp(memberPage, createAccount('e2e-member'));
      await memberPage.getByLabel(/Code d.invitation complet/).fill(invitationToken!);
      await memberPage.getByRole('button', { name: 'Rejoindre le foyer' }).click();
      await memberPage.waitForURL('/home', { timeout: 20000 });
    } finally {
      await memberContext.close();
    }

    await page.reload();
    await expect(page.getByTestId('invite-accepted-note')).toBeVisible();
    await expect(page.locator('.invite-code-text')).toHaveCount(0);
  });

  test.describe('Members redirect (foyer 2, 1/2)', () => {
    // Foyer 2 est seedé 1/2 : la redirection /members → /household et le
    // compteur "(1)" sont lisibles sans créer de foyer.
    test.use({ accountRole: 'household2.userA' });
    test('/members redirects to /household (fusion Membres → Foyer)', async ({ authenticatedPage: page }) => {
      // #237 : seeded session (foyer 2 seedé 1/2, navigation + lecture seule).
      await page.goto('/members');
      await expect(page).toHaveURL('/household');
      await expect(page.getByRole('heading', { name: 'Membres du foyer (1)' })).toBeVisible();
    });
  });
});
