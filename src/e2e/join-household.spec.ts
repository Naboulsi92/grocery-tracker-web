import { randomUUID } from 'node:crypto';
import { requireWrites, createAccount, createHousehold, expect, signUp, test } from './fixtures';

test.describe('Join Household Flow', () => {
  test.describe('Create Household', () => {
    test('US 1: new user can create their first household after signup', async ({ page, account }) => {
      requireWrites();
      await signUp(page, account);
      await expect(page).toHaveURL('/join-household');
      await expect(page.getByRole('heading', { name: 'Votre foyer' })).toBeVisible();
      
      const householdName = `Foyer création ${randomUUID().slice(0, 8)}`;
      await page.getByLabel('Nom du foyer').fill(householdName);
      await page.getByRole('button', { name: 'Créer mon foyer' }).click();
      await page.waitForURL('/home', { timeout: 20000 });
      await expect(page.getByTestId('header-household-name')).toHaveText(householdName);
    });

    test('US 6: user can choose a custom name for their household', async ({ page, account }) => {
      requireWrites();
      await signUp(page, account);
      
      const customHouseholdName = `Mon Foyer Personnalisé ${randomUUID().slice(0, 8)}`;
      await page.getByLabel('Nom du foyer').fill(customHouseholdName);
      await page.getByRole('button', { name: 'Créer mon foyer' }).click();
      await page.waitForURL('/home', { timeout: 20000 });
      await expect(page.getByTestId('header-household-name')).toHaveText(customHouseholdName);
    });

    test('US 7: user can use the default suggested household name', async ({ page, account }) => {
      requireWrites();
      await signUp(page, account);
      
      await page.getByRole('button', { name: 'Créer mon foyer' }).click();
      await page.waitForURL('/home', { timeout: 20000 });
      await expect(page.getByTestId('header-household-name')).toHaveText('Mon Foyer');
    });

    test('US 8: user sees loading indicators while household is being created', async ({ page, account }) => {
      requireWrites();
      await signUp(page, account);
      
      const householdName = `Foyer loading ${randomUUID().slice(0, 8)}`;
      await page.getByLabel('Nom du foyer').fill(householdName);
      await page.getByRole('button', { name: 'Créer mon foyer' }).click();
      
      await page.waitForURL('/home', { timeout: 20000 });
      await expect(page.getByTestId('header-household-name')).toHaveText(householdName);
    });

    test('US 10: user can see the household name before confirming creation', async ({ page, account }) => {
      requireWrites();
      await signUp(page, account);
      
      const previewName = `Foyer prévisualisation ${randomUUID().slice(0, 8)}`;
      await page.getByLabel('Nom du foyer').fill(previewName);
      
      const input = page.getByLabel('Nom du foyer');
      await expect(input).toHaveValue(previewName);
      
      await page.getByRole('button', { name: 'Créer mon foyer' }).click();
      await page.waitForURL('/home', { timeout: 20000 });
      await expect(page.getByTestId('header-household-name')).toHaveText(previewName);
    });
  });

  test.describe('Join Household with Invitation', () => {
    test('US 2: user can join an existing household with an invitation code', async ({ page, account, browser }) => {
      requireWrites();
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
      } finally {
        await memberContext.close();
      }
    });

    test('US 22: invite link survives the signup detour with the code prefilled (ticket #58)', async ({ page, account, browser }) => {
      requireWrites();
      await createHousehold(page, account);

      await page.getByRole('link', { name: /Membres/ }).click();
      await page.getByRole('button', { name: 'Créer une invitation' }).click();
      const token = await page.locator('.invite-code-text').textContent();

      const inviteeContext = await browser.newContext();
      const inviteePage = await inviteeContext.newPage();
      const inviteeAccount = createAccount('e2e-invite-link');
      try {
        // Anonymous invitee opens the shared link: bounced to login with ?next=.
        await inviteePage.goto(`/join-household?code=${encodeURIComponent(token!)}`);
        await inviteePage.waitForURL(/\/login\?next=.*join-household/, { timeout: 15000 });

        // No account yet: through to signup, ?next= preserved.
        await inviteePage.getByRole('link', { name: "S'inscrire" }).click();
        await inviteePage.waitForURL(/\/signup\?next=.*join-household/, { timeout: 15000 });

        await inviteePage.getByLabel('Email').fill(inviteeAccount.email);
        await inviteePage.getByLabel('Mot de passe', { exact: true }).fill(inviteeAccount.password);
        await inviteePage.getByLabel('Confirmer le mot de passe').fill(inviteeAccount.password);
        await inviteePage.getByRole('button', { name: "S'inscrire" }).click();

        // Back on the invitation with the code prefilled — no transcription.
        await inviteePage.waitForURL(/\/join-household\?code=/, { timeout: 20000 });
        await expect(inviteePage.getByTestId('invite-token-input')).toHaveValue(token!);

        // Names + single-action join lands on the dashboard.
        await inviteePage.getByTestId('onboarding-first-name-input').fill(inviteeAccount.firstName);
        await inviteePage.getByTestId('onboarding-last-name-input').fill(inviteeAccount.lastName);
        await inviteePage.getByRole('button', { name: 'Rejoindre le foyer' }).click();
        await inviteePage.waitForURL('/home', { timeout: 20000 });
      } finally {
        await inviteeContext.close();
      }
    });

    test('US 9: user sees loading indicators while joining a household', async ({ page, account, browser }) => {
      requireWrites();
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
        await memberPage.getByRole('button', { name: 'Rejoindre le foyer' }).click();
        
        await memberPage.waitForURL('/home', { timeout: 20000 });
      } finally {
        await memberContext.close();
      }
    });

    test('US 5: user is redirected to the dashboard after successfully joining a household', async ({ page, account, browser }) => {
      requireWrites();
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
        await expect(memberPage.getByRole('heading', { name: 'Tableau de bord' })).toBeVisible();
      } finally {
        await memberContext.close();
      }
    });

    test('US 15: user sees clear success feedback after joining a household', async ({ page, account, browser }) => {
      requireWrites();
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
        await expect(memberPage.getByTestId('header-household-name')).toHaveText(householdName);
        await expect(memberPage.getByRole('link', { name: /Membres/ })).toBeVisible();
      } finally {
        await memberContext.close();
      }
    });
  });

  test.describe('Error Handling', () => {
    test('US 3: user sees clear error messages when the invitation is invalid', async ({ page, account }) => {
      requireWrites();
      await signUp(page, account);
      
      await page.getByLabel(/Code d'invitation complet/).fill('invalid-token-that-does-not-exist');
      await page.getByRole('button', { name: 'Rejoindre le foyer' }).click();
      
      await expect(page.locator('.auth-error')).toContainText('invalide');
      await expect(page.getByRole('button', { name: 'Rejoindre le foyer' })).toBeEnabled();
    });

    test('US 11: user understands when an invitation has expired', async ({ page, account }) => {
      requireWrites();
      await signUp(page, account);
      
      await page.getByLabel(/Code d'invitation complet/).fill('expired-token-format');
      await page.getByRole('button', { name: 'Rejoindre le foyer' }).click();
      
      const alert = page.locator('.auth-error');
      await expect(alert).toBeVisible();
      await expect(alert).toContainText(/invalide|expirée|révoquée|utilisée/i);
    });

    test('US 4: user can retry after a failed join attempt', async ({ page, account }) => {
      requireWrites();
      await signUp(page, account);
      
      await page.getByLabel(/Code d'invitation complet/).fill('wrong-token-1');
      await page.getByRole('button', { name: 'Rejoindre le foyer' }).click();
      await expect(page.locator('.auth-error')).toBeVisible();
      
      await page.getByLabel(/Code d'invitation complet/).fill('wrong-token-2');
      await page.getByRole('button', { name: 'Rejoindre le foyer' }).click();
      await expect(page.locator('.auth-error')).toBeVisible();
      
      await expect(page.getByRole('button', { name: 'Rejoindre le foyer' })).toBeEnabled();
    });

    test('US 13: user sees validation errors for empty invitation codes', async ({ page, account }) => {
      requireWrites();
      await signUp(page, account);
      
      const joinButton = page.getByRole('button', { name: 'Rejoindre le foyer' });
      await joinButton.click();
      
      const tokenInput = page.getByLabel(/Code d'invitation complet/);
      await expect(tokenInput).toBeFocused();
      await expect(tokenInput).toHaveAttribute('required');
    });

    test('US 16: user can join household with whitespace in invitation token', async ({ page, account, browser }) => {
      requireWrites();
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
      } finally {
        await memberContext.close();
      }
    });
  });

  test.describe('Navigation and UX', () => {
    test('US 14: user can navigate back to cancel the join process', async ({ page, account }) => {
      requireWrites();
      await signUp(page, account);
      await expect(page).toHaveURL('/join-household');
      
      await page.getByRole('link', { name: /Retour/i }).click();
      await expect(page).toHaveURL('/');
    });

    test('shows both create and join options on the page', async ({ page, account }) => {
      requireWrites();
      await signUp(page, account);
      
      await expect(page.getByText('Créer un nouveau foyer')).toBeVisible();
      await expect(page.getByText('Rejoindre un foyer existant')).toBeVisible();
      await expect(page.getByRole('button', { name: 'Créer mon foyer' })).toBeVisible();
      await expect(page.getByRole('button', { name: 'Rejoindre le foyer' })).toBeVisible();
    });

    test('US 17: keyboard navigation through join household flow', async ({ page, account }) => {
      requireWrites();
      await signUp(page, account);

      // signUp leaves focus on the last-name field it just filled and Chromium
      // keeps that tab anchor even across blur(), so the count of Tabs to the
      // invitation field is not fixed. Walk the header controls and the forms
      // with Tab until the invitation token input receives focus.
      const tokenInput = page.getByLabel(/Code d'invitation complet/);
      await expect(async () => {
        await page.keyboard.press('Tab');
        await expect(tokenInput).toBeFocused({ timeout: 250 });
      }).toPass({ timeout: 10000 });
      await expect(tokenInput).toBeFocused();
      
      await page.keyboard.press('Tab');
      await expect(page.getByRole('button', { name: 'Rejoindre le foyer' })).toBeFocused();
      
      await page.keyboard.press('Shift+Tab');
      await expect(page.getByLabel(/Code d'invitation complet/)).toBeFocused();
      
      await page.keyboard.type('invalid-token');
      await page.keyboard.press('Enter');
      await expect(page.locator('.auth-error')).toBeVisible();
      await expect(page.locator('.auth-error')).toContainText('invalide');
      
      await page.getByRole('link', { name: /Retour/i }).focus();
      await page.keyboard.press('Enter');
      await expect(page).toHaveURL('/');
    });
  });
});
