import { randomUUID } from 'node:crypto';
import { createAccount, createHousehold, expect, signUp, test } from './fixtures';
import {
  e2eEnvironment,
  fixtureRequiredReason,
  writesDisabledReason,
} from './environment';

test.describe('Join Household Flow', () => {
  test.describe('Create Household', () => {
    test('US 1: new user can create their first household after signup', async ({ page, account }) => {
      test.skip(!e2eEnvironment.writesAllowed, fixtureRequiredReason);
      await signUp(page, account);
      await expect(page).toHaveURL('/join-household');
      await expect(page.getByRole('heading', { name: 'Votre foyer' })).toBeVisible();
      
      const householdName = `Foyer création ${randomUUID()}`;
      await page.getByLabel('Nom du foyer').fill(householdName);
      await page.getByRole('button', { name: 'Créer mon foyer' }).click();
      await page.waitForURL('/home', { timeout: 20000 });
      await expect(page.getByRole('heading', { level: 1, name: householdName })).toBeVisible();
    });

    test('US 6: user can choose a custom name for their household', async ({ page, account }) => {
      test.skip(!e2eEnvironment.writesAllowed, writesDisabledReason);
      await signUp(page, account);
      
      const customHouseholdName = `Mon Foyer Personnalisé ${randomUUID()}`;
      await page.getByLabel('Nom du foyer').fill(customHouseholdName);
      await page.getByRole('button', { name: 'Créer mon foyer' }).click();
      await page.waitForURL('/home', { timeout: 20000 });
      await expect(page.getByRole('heading', { level: 1, name: customHouseholdName })).toBeVisible();
    });

    test('US 7: user can use the default suggested household name', async ({ page, account }) => {
      test.skip(!e2eEnvironment.writesAllowed, writesDisabledReason);
      await signUp(page, account);
      
      await page.getByRole('button', { name: 'Créer mon foyer' }).click();
      await page.waitForURL('/home', { timeout: 20000 });
      await expect(page.getByRole('heading', { level: 1, name: 'Mon Foyer' })).toBeVisible();
    });

    test('US 8: user sees loading indicators while household is being created', async ({ page, account }) => {
      test.skip(!e2eEnvironment.writesAllowed, writesDisabledReason);
      await signUp(page, account);
      
      const householdName = `Foyer loading ${randomUUID()}`;
      await page.getByLabel('Nom du foyer').fill(householdName);
      const createButton = page.getByRole('button', { name: 'Créer mon foyer' });
      await createButton.click();
      
      await expect(createButton).toHaveText('Création...');
      await expect(createButton).toBeDisabled();
      
      await page.waitForURL('/home', { timeout: 20000 });
      await expect(createButton).toBeEnabled();
    });

    test('US 10: user can see the household name before confirming creation', async ({ page, account }) => {
      test.skip(!e2eEnvironment.writesAllowed, writesDisabledReason);
      await signUp(page, account);
      
      const previewName = `Foyer prévisualisation ${randomUUID()}`;
      await page.getByLabel('Nom du foyer').fill(previewName);
      
      const input = page.getByLabel('Nom du foyer');
      await expect(input).toHaveValue(previewName);
      
      await page.getByRole('button', { name: 'Créer mon foyer' }).click();
      await page.waitForURL('/home', { timeout: 20000 });
      await expect(page.getByRole('heading', { level: 1, name: previewName })).toBeVisible();
    });
  });

  test.describe('Join Household with Invitation', () => {
    test('US 2: user can join an existing household with an invitation code', async ({ page, account, browser }) => {
      test.skip(!e2eEnvironment.writesAllowed, fixtureRequiredReason);
      const householdName = await createHousehold(page, account);
      
      await page.getByRole('link', { name: /Membres/ }).click();
      await page.getByRole('button', { name: 'Créer une invitation' }).click();
      const token = await page.locator('.invite-code-text').textContent();
      
      const memberContext = await browser.newContext();
      const memberPage = await memberContext.newPage();
      const memberAccount = createAccount('e2e-joiner');
      try {
        await signUp(memberPage, memberAccount);
        await memberPage.getByLabel(/Code d'invitation complet/).fill(token!);
        await memberPage.getByRole('button', { name: 'Rejoindre le foyer' }).click();
        await memberPage.waitForURL('/home', { timeout: 20000 });
        await expect(memberPage.getByRole('heading', { level: 1, name: householdName })).toBeVisible();
      } finally {
        await memberContext.close();
      }
    });

    test('US 9: user sees loading indicators while joining a household', async ({ page, account, browser }) => {
      test.skip(!e2eEnvironment.writesAllowed, writesDisabledReason);
      await createHousehold(page, account);
      
      await page.getByRole('link', { name: /Membres/ }).click();
      await page.getByRole('button', { name: 'Créer une invitation' }).click();
      const token = await page.locator('.invite-code-text').textContent();
      
      const memberContext = await browser.newContext();
      const memberPage = await memberContext.newPage();
      const memberAccount = createAccount('e2e-joiner-loading');
      try {
        await signUp(memberPage, memberAccount);
        await memberPage.getByLabel(/Code d'invitation complet/).fill(token!);
        const joinButton = memberPage.getByRole('button', { name: 'Rejoindre le foyer' });
        await joinButton.click();
        
        await expect(joinButton).toHaveText('Connexion...');
        await expect(joinButton).toBeDisabled();
        
        await memberPage.waitForURL('/home', { timeout: 20000 });
        await expect(joinButton).toBeEnabled();
      } finally {
        await memberContext.close();
      }
    });

    test('US 5: user is redirected to the dashboard after successfully joining a household', async ({ page, account, browser }) => {
      test.skip(!e2eEnvironment.writesAllowed, fixtureRequiredReason);
      await createHousehold(page, account);
      
      await page.getByRole('link', { name: /Membres/ }).click();
      await page.getByRole('button', { name: 'Créer une invitation' }).click();
      const token = await page.locator('.invite-code-text').textContent();
      
      const memberContext = await browser.newContext();
      const memberPage = await memberContext.newPage();
      const memberAccount = createAccount('e2e-redirect');
      try {
        await signUp(memberPage, memberAccount);
        await memberPage.getByLabel(/Code d'invitation complet/).fill(token!);
        await memberPage.getByRole('button', { name: 'Rejoindre le foyer' }).click();
        await memberPage.waitForURL('/home', { timeout: 20000 });
        await expect(memberPage).toHaveURL('/home');
        await expect(memberPage.getByRole('heading', { name: 'Tableau de bord' })).toBeVisible();
      } finally {
        await memberContext.close();
      }
    });

    test('US 15: user sees clear success feedback after joining a household', async ({ page, account, browser }) => {
      test.skip(!e2eEnvironment.writesAllowed, writesDisabledReason);
      const householdName = await createHousehold(page, account);
      
      await page.getByRole('link', { name: /Membres/ }).click();
      await page.getByRole('button', { name: 'Créer une invitation' }).click();
      const token = await page.locator('.invite-code-text').textContent();
      
      const memberContext = await browser.newContext();
      const memberPage = await memberContext.newPage();
      const memberAccount = createAccount('e2e-success');
      try {
        await signUp(memberPage, memberAccount);
        await memberPage.getByLabel(/Code d'invitation complet/).fill(token!);
        await memberPage.getByRole('button', { name: 'Rejoindre le foyer' }).click();
        await memberPage.waitForURL('/home', { timeout: 20000 });
        
        await expect(memberPage.getByRole('heading', { level: 1, name: householdName })).toBeVisible();
        await expect(memberPage.getByRole('link', { name: /Membres/ })).toBeVisible();
      } finally {
        await memberContext.close();
      }
    });
  });

  test.describe('Error Handling', () => {
    test('US 3: user sees clear error messages when the invitation is invalid', async ({ page, account }) => {
      test.skip(!e2eEnvironment.writesAllowed, writesDisabledReason);
      await signUp(page, account);
      
      await page.getByLabel(/Code d'invitation complet/).fill('invalid-token-that-does-not-exist');
      await page.getByRole('button', { name: 'Rejoindre le foyer' }).click();
      
      await expect(page.getByRole('alert')).toContainText('invalide');
      await expect(page.getByRole('button', { name: 'Rejoindre le foyer' })).toBeEnabled();
    });

    test('US 11: user understands when an invitation has expired', async ({ page, account }) => {
      test.skip(!e2eEnvironment.writesAllowed, writesDisabledReason);
      await signUp(page, account);
      
      await page.getByLabel(/Code d'invitation complet/).fill('expired-token-format');
      await page.getByRole('button', { name: 'Rejoindre le foyer' }).click();
      
      const alert = await page.getByRole('alert');
      await expect(alert).toBeVisible();
      await expect(alert).toContainText(/invalide|expirée|révoquée|utilisée/i);
    });

    test('US 4: user can retry after a failed join attempt', async ({ page, account }) => {
      test.skip(!e2eEnvironment.writesAllowed, writesDisabledReason);
      await signUp(page, account);
      
      await page.getByLabel(/Code d'invitation complet/).fill('wrong-token-1');
      await page.getByRole('button', { name: 'Rejoindre le foyer' }).click();
      await expect(page.getByRole('alert')).toBeVisible();
      
      await page.getByLabel(/Code d'invitation complet/).fill('wrong-token-2');
      await page.getByRole('button', { name: 'Rejoindre le foyer' }).click();
      await expect(page.getByRole('alert')).toBeVisible();
      
      await expect(page.getByRole('button', { name: 'Rejoindre le foyer' })).toBeEnabled();
    });

    test('US 13: user sees validation errors for empty invitation codes', async ({ page, account }) => {
      test.skip(!e2eEnvironment.writesAllowed, writesDisabledReason);
      await signUp(page, account);
      
      const joinButton = page.getByRole('button', { name: 'Rejoindre le foyer' });
      await joinButton.click();
      
      const tokenInput = page.getByLabel(/Code d'invitation complet/);
      await expect(tokenInput).toBeFocused();
      await expect(tokenInput).toHaveAttribute('required');
    });

    test('handles whitespace in invitation token', async ({ page, account, browser }) => {
      test.skip(!e2eEnvironment.writesAllowed, writesDisabledReason);
      await createHousehold(page, account);
      
      await page.getByRole('link', { name: /Membres/ }).click();
      await page.getByRole('button', { name: 'Créer une invitation' }).click();
      const token = await page.locator('.invite-code-text').textContent();
      
      const memberContext = await browser.newContext();
      const memberPage = await memberContext.newPage();
      const memberAccount = createAccount('e2e-whitespace');
      try {
        await signUp(memberPage, memberAccount);
        await memberPage.getByLabel(/Code d'invitation complet/).fill(`  ${token}  `);
        await memberPage.getByRole('button', { name: 'Rejoindre le foyer' }).click();
        await memberPage.waitForURL('/home', { timeout: 20000 });
        await expect(memberPage).toHaveURL('/home');
      } finally {
        await memberContext.close();
      }
    });
  });

  test.describe('Navigation and UX', () => {
    test('US 14: user can navigate back to cancel the join process', async ({ page, account }) => {
      test.skip(!e2eEnvironment.writesAllowed, writesDisabledReason);
      await signUp(page, account);
      await expect(page).toHaveURL('/join-household');
      
      await page.getByRole('link', { name: /Retour/i }).click();
      await expect(page).toHaveURL('/home');
    });

    test('shows both create and join options on the page', async ({ page, account }) => {
      test.skip(!e2eEnvironment.writesAllowed, writesDisabledReason);
      await signUp(page, account);
      
      await expect(page.getByText('Créer un nouveau foyer')).toBeVisible();
      await expect(page.getByText('Rejoindre un foyer existant')).toBeVisible();
      await expect(page.getByRole('button', { name: 'Créer mon foyer' })).toBeVisible();
      await expect(page.getByRole('button', { name: 'Rejoindre le foyer' })).toBeVisible();
    });
  });
});
