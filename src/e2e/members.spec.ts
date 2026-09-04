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

    const copyButton = page.getByRole('button', { name: 'Copier' });
    await expect(copyButton).toBeVisible();
    await copyButton.click();

    await expect(page.getByRole('button', { name: 'Copié !' })).toBeVisible();

    const clipboardText = await page.evaluate(() => navigator.clipboard.readText());
    expect(clipboardText).toBe(invitationToken);
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

  test('non-owner cannot see create invitation button', async ({ page, account, browser }) => {
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

      const createInvitationButton = memberPage.getByRole('button', { name: 'Créer une invitation' });
      await expect(createInvitationButton).not.toBeVisible();

      const nonOwnerMessage = memberPage.getByText('Seul le propriétaire du foyer peut inviter de nouveaux membres.');
      await expect(nonOwnerMessage).toBeVisible();
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

      await page.getByRole('link', { name: /Membres/ }).click();
      const ownerLabel = page.getByText('Propriétaire');
      await expect(ownerLabel).toBeVisible();

      const memberLabel = page.getByText('Membre');
      await expect(memberLabel).toBeVisible();

      await memberPage.getByRole('link', { name: /Membres/ }).click();
      await expect(memberPage.getByText('Propriétaire')).toBeVisible();
      await expect(memberPage.getByText('Membre')).toBeVisible();
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

      await page.getByRole('link', { name: /Membres/ }).click();
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
      await page.getByRole('link', { name: /Membres/ }).click();
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