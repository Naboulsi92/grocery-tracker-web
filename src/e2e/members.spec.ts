import { randomUUID } from 'node:crypto';
import { createAccount, createHousehold, expect, signUp, test } from './fixtures';
import {
  e2eEnvironment,
  fixtureRequiredReason,
  writesDisabledReason,
} from './environment';

test.describe('Members Page', () => {
  test('displays member count in heading', async ({ page, account }) => {
    test.skip(!e2eEnvironment.writesAllowed, fixtureRequiredReason);
    const householdName = await createHousehold(page, account);

    await page.getByRole('link', { name: /Membres/ }).click();
    await expect(page).toHaveURL('/members');
    await expect(page.getByRole('heading', { name: /Membres du foyer/ })).toBeVisible();
    await expect(page.getByRole('heading', { name: 'Membres du foyer (1)' })).toBeVisible();
  });

  test('owner can create invitation', async ({ page, account }) => {
    test.skip(!e2eEnvironment.writesAllowed, writesDisabledReason);
    await createHousehold(page, account);

    await page.getByRole('link', { name: /Membres/ }).click();
    await expect(page).toHaveURL('/members');

    const createInvitation = page.getByRole('button', { name: 'Créer une invitation' });
    await expect(createInvitation).toBeVisible();
    await createInvitation.click();

    const token = page.locator('.invite-code-text');
    await expect(token).not.toBeEmpty();
    const invitationToken = await token.textContent();
    expect(invitationToken).toBeDefined();
    expect(invitationToken!.length).toBeGreaterThan(0);
  });

  test('owner can copy invitation token to clipboard', async ({ page, account }) => {
    test.skip(!e2eEnvironment.writesAllowed, writesDisabledReason);
    await createHousehold(page, account);

    await page.getByRole('link', { name: /Membres/ }).click();
    await page.getByRole('button', { name: 'Créer une invitation' }).click();

    const token = page.locator('.invite-code-text');
    await expect(token).not.toBeEmpty();
    const invitationToken = await token.textContent();

    // The token is also exposed as a read-only field holding exactly the value
    // a clipboard write places in the system paste buffer.
    const tokenField = page.getByTestId('invite-code-token');
    await expect(tokenField).toHaveValue(invitationToken ?? '');

    // Headless Chromium cannot focus the document to touch the OS clipboard, so
    // intercept writeText and capture what the copy button hands over.
    await page.evaluate(() => {
      navigator.clipboard.writeText = async (text: string) => {
        (window as Window & { __copiedText?: string }).__copiedText = text;
      };
    });

    const copyButton = page.getByRole('button', { name: 'Copier' });
    await expect(copyButton).toBeVisible();
    await copyButton.click();

    await expect(page.getByRole('button', { name: 'Copié !' })).toBeVisible();
    const copiedText = await page.evaluate(
      () => (window as Window & { __copiedText?: string }).__copiedText,
    );
    expect(copiedText).toBe(invitationToken);
  });

  test('owner can revoke invitation token', async ({ page, account }) => {
    test.skip(!e2eEnvironment.writesAllowed, writesDisabledReason);
    await createHousehold(page, account);

    await page.getByRole('link', { name: /Membres/ }).click();
    await page.getByRole('button', { name: 'Créer une invitation' }).click();

    const token = page.locator('.invite-code-text');
    await expect(token).toBeVisible();

    const revokeButton = page.getByRole('button', { name: 'Révoquer' });
    await expect(revokeButton).toBeVisible();
    await revokeButton.click();

    await expect(page.getByRole('button', { name: 'Créer une invitation' })).toBeVisible();
    await expect(token).not.toBeVisible();
  });

  test('displays invitation expiration', async ({ page, account }) => {
    test.skip(!e2eEnvironment.writesAllowed, writesDisabledReason);
    await createHousehold(page, account);

    await page.getByRole('link', { name: /Membres/ }).click();
    await page.getByRole('button', { name: 'Créer une invitation' }).click();

    const expirationText = page.getByText(/Expire le/);
    await expect(expirationText).toBeVisible();
    const expirationDate = await expirationText.textContent();
    expect(expirationDate).toMatch(/Expire le \d{1,2}\/\d{1,2}\/\d{4}/);
  });

  test('member can reach the invite section (equal rights, no owner-only gate)', async ({ page, account, browser }) => {
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

      await memberPage.getByRole('link', { name: /Membres/ }).click();
      await expect(memberPage).toHaveURL('/members');

      await expect(memberPage.getByRole('heading', { name: 'Membres du foyer (2)' })).toBeVisible();

      // Equal rights: every member reaches the invite section — the owner-only gate is gone.
      const ownerOnlyMessage = memberPage.getByText('Seul le propriétaire du foyer peut inviter de nouveaux membres.');
      await expect(ownerOnlyMessage).not.toBeVisible();

      // At 2/2 the invite section renders in its full state (no create button for anyone).
      await expect(memberPage.getByRole('heading', { name: 'Invitation' })).toBeVisible();
      await expect(memberPage.getByTestId('household-full-message')).toBeVisible();
    } finally {
      await memberContext.close();
    }
  });

  test('displays member role (owner vs member)', async ({ page, account, browser }) => {
    test.skip(!e2eEnvironment.writesAllowed, fixtureRequiredReason);
    const householdName = await createHousehold(page, account);

    await page.getByRole('link', { name: /Membres/ }).click();
    await page.getByRole('button', { name: 'Créer une invitation' }).click();
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
      const ownerLabel = page.locator('.member-joined').filter({ hasText: 'Propriétaire' });
      await expect(ownerLabel).toBeVisible();

      const memberLabel = page.locator('.member-joined').filter({ hasText: 'Membre' });
      await expect(memberLabel).toBeVisible();

      await memberPage.goto('/members');
      await expect(memberPage.locator('.member-joined').filter({ hasText: 'Propriétaire' })).toBeVisible();
      await expect(memberPage.locator('.member-joined').filter({ hasText: 'Membre' })).toBeVisible();
    } finally {
      await memberContext.close();
    }
  });

  test('visual confirmation when invited user joins', async ({ page, account, browser }) => {
    test.skip(!e2eEnvironment.writesAllowed, fixtureRequiredReason);
    const householdName = await createHousehold(page, account);

    await page.getByRole('link', { name: /Membres/ }).click();
    await expect(page.getByRole('heading', { name: 'Membres du foyer (1)' })).toBeVisible();

    await page.getByRole('button', { name: 'Créer une invitation' }).click();
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
    test.skip(!e2eEnvironment.writesAllowed, fixtureRequiredReason);
    const householdName = await createHousehold(page, account);

    await page.getByRole('link', { name: /Membres/ }).click();
    await expect(page.getByRole('heading', { name: 'Membres du foyer (1)' })).toBeVisible();

    await page.getByRole('button', { name: 'Créer une invitation' }).click();
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

  test('owner can create new invitation after previous is revoked', async ({ page, account }) => {
    test.skip(!e2eEnvironment.writesAllowed, writesDisabledReason);
    await createHousehold(page, account);

    await page.getByRole('link', { name: /Membres/ }).click();

    await page.getByRole('button', { name: 'Créer une invitation' }).click();
    const firstToken = page.locator('.invite-code-text');
    await expect(firstToken).toBeVisible();
    const firstInvitationToken = await firstToken.textContent();

    await page.getByRole('button', { name: 'Révoquer' }).click();
    await expect(page.getByRole('button', { name: 'Créer une invitation' })).toBeVisible();

    await page.getByRole('button', { name: 'Créer une invitation' }).click();
    const secondToken = page.locator('.invite-code-text');
    await expect(secondToken).toBeVisible();
    const secondInvitationToken = await secondToken.textContent();

    expect(firstInvitationToken).not.toBe(secondInvitationToken);
  });
});