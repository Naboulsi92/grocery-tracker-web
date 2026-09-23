import { randomUUID } from 'node:crypto';
import type { Page } from '@playwright/test';
import { requireWrites, createAccount, createHousehold, expect, signUp, test } from './fixtures';
import {
  PWA_INSTALLED_KEY,
  PWA_SNOOZED_AT_KEY,
  PWA_VISITS_KEY,
} from '../lib/pwa-banner';

const VIEWPORTS = {
  mobile: { width: 320, height: 568 },
  tablet: { width: 768, height: 1024 },
  smallLaptop: { width: 1024, height: 768 },
  largeDesktop: { width: 1440, height: 900 },
};

test.describe('Mobile Responsiveness', () => {
  test.describe('320px viewport - mobile landscape/small phones', () => {
    test('homepage renders correctly', async ({ page, browserName }) => {
      test.skip(browserName !== 'chromium', 'Viewport tests on Chromium only');
      await page.setViewportSize(VIEWPORTS.mobile);
      await page.goto('/');
      await expect(page.locator('#hero')).toBeVisible();
      await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
    });

    test('dashboard cards stack vertically on mobile', async ({ page, browserName }) => {
      test.skip(browserName !== 'chromium', 'Viewport tests on Chromium only');
      requireWrites();
      await page.setViewportSize(VIEWPORTS.mobile);
      const account = createAccount();
      await createHousehold(page, account);

      const cards = page.locator('[data-testid^="dashboard-card-"]');
      await expect(cards).toHaveCount(8);

      const firstCard = cards.first();
      const secondCard = cards.nth(1);
      const firstBox = await firstCard.boundingBox();
      const secondBox = await secondCard.boundingBox();

      expect(firstBox).not.toBeNull();
      expect(secondBox).not.toBeNull();
      expect(firstBox!.y).toBeLessThan(secondBox!.y);
    });

    test('touch targets are minimum 44px on mobile', async ({ page, browserName }) => {
      test.skip(browserName !== 'chromium', 'Viewport tests on Chromium only');
      requireWrites();
      await page.setViewportSize(VIEWPORTS.mobile);
      const account = createAccount();
      await createHousehold(page, account);

      const primaryTargets = page.locator('a[data-testid^="dashboard-card-"]');
      const count = await primaryTargets.count();

      let allTargetsValid = true;
      for (let i = 0; i < Math.min(count, 20); i++) {
        const element = primaryTargets.nth(i);
        const box = await element.boundingBox();
        if (box && (box.width < 44 || box.height < 44)) {
          const isVisible = await element.isVisible();
          if (isVisible) {
            allTargetsValid = false;
          }
        }
      }
      expect(allTargetsValid).toBe(true);
    });

    test('back button is tappable on mobile', async ({ page, browserName }) => {
      test.skip(browserName !== 'chromium', 'Viewport tests on Chromium only');
      requireWrites();
      await page.setViewportSize(VIEWPORTS.mobile);
      const account = createAccount();
      await createHousehold(page, account);

      await page.getByTestId('dashboard-card-items').click();
      await expect(page).toHaveURL('/items');

      const backButton = page.getByTestId('back-link');
      await expect(backButton).toBeVisible();
      const backBox = await backButton.boundingBox();
      expect(backBox).not.toBeNull();
      expect(backBox!.height).toBeGreaterThanOrEqual(44);

      await backButton.click();
      await expect(page).toHaveURL('/home');
    });

    test('forms are usable on mobile', async ({ page, browserName }) => {
      test.skip(browserName !== 'chromium', 'Viewport tests on Chromium only');
      requireWrites();
      await page.setViewportSize(VIEWPORTS.mobile);
      const account = createAccount();
      await createHousehold(page, account);

      await page.getByTestId('dashboard-card-items').click();
      await page.getByTestId('btn-new-item').click();

      const form = page.locator('form');
      await expect(form).toBeVisible();

      const input = page.getByTestId('input-item-name');
      await expect(input).toBeVisible();
      const inputBox = await input.boundingBox();
      expect(inputBox).not.toBeNull();
      expect(inputBox!.height).toBeGreaterThanOrEqual(44);

      const submitButton = page.getByTestId('btn-create-item');
      await expect(submitButton).toBeVisible();
      const buttonBox = await submitButton.boundingBox();
      expect(buttonBox).not.toBeNull();
      expect(buttonBox!.height).toBeGreaterThanOrEqual(44);
    });

    test('lists scroll properly on mobile', async ({ page, browserName }) => {
      test.skip(browserName !== 'chromium', 'Viewport tests on Chromium only');
      requireWrites();
      await page.setViewportSize(VIEWPORTS.mobile);
      const account = createAccount();
      await createHousehold(page, account);

      for (let i = 0; i < 10; i++) {
        const itemName = `Article test ${randomUUID()}`;
        await page.getByTestId('dashboard-card-items').click();
        await page.getByTestId('btn-new-item').click();
        await page.getByTestId('input-item-name').fill(itemName);
        await page.getByTestId('btn-create-item').click();
        await expect(page.getByText(itemName)).toBeVisible({ timeout: 10000 });
        await page.getByTestId('back-link').click();
      }

      await page.getByTestId('dashboard-card-items').click();
      const listContainer = page.locator('main');
      const containerBox = await listContainer.boundingBox();
      expect(containerBox).not.toBeNull();

      await page.mouse.wheel(0, 500);

      // Web-first: rows settle after scroll instead of a fixed sleep.
      const items = page.locator('.item-row');
      await expect.poll(async () => items.count(), { timeout: 8000 }).toBeGreaterThan(0);
    });

    test('modals/dialogs are usable on mobile', async ({ page, browserName }) => {
      test.skip(browserName !== 'chromium', 'Viewport tests on Chromium only');
      requireWrites();
      await page.setViewportSize(VIEWPORTS.mobile);
      const account = createAccount();
      await createHousehold(page, account);

      await page.getByTestId('dashboard-card-categories').click();
      await page.getByTestId('btn-new-category').click();

      // Exclude the Next.js dev error overlay (`data-nextjs-dialog`): it is a
      // hidden `[role="dialog"]` present in `next dev` (exposed by the CSP
      // `unsafe-eval` breakage) and is not an app modal. App modals use
      // `.modal-overlay` / `.modal-content`.
      const modal = page.locator('.modal-overlay, .modal-content, [role="dialog"]:not([data-nextjs-dialog])');
      if (await modal.count() > 0) {
        await expect(modal.first()).toBeVisible();
        const modalBox = await modal.first().boundingBox();
        expect(modalBox).not.toBeNull();
        expect(modalBox!.width).toBeLessThanOrEqual(VIEWPORTS.mobile.width);
      }

      const form = page.locator('form');
      await expect(form).toBeVisible();
      const input = page.getByTestId('input-category-name');
      await expect(input).toBeVisible();
      await input.fill('Test Category');
      await page.getByTestId('btn-create-category').click();
    });

    test('navigation works on mobile viewport', async ({ page, browserName }) => {
      test.skip(browserName !== 'chromium', 'Viewport tests on Chromium only');
      requireWrites();
      await page.setViewportSize(VIEWPORTS.mobile);
      const account = createAccount();
      await createHousehold(page, account);

      await page.getByTestId('dashboard-card-categories').click();
      await expect(page).toHaveURL('/categories');
      await expect(page.getByRole('heading', { name: 'Catégories', exact: true })).toBeVisible();

      await page.getByTestId('back-link').click();
      await expect(page).toHaveURL('/home');

      await page.getByTestId('dashboard-card-items').click();
      await expect(page).toHaveURL('/items');
      await expect(page.getByRole('heading', { name: 'Articles' })).toBeVisible();

      await page.getByTestId('back-link').click();
      await expect(page).toHaveURL('/home');

      await page.getByTestId('dashboard-card-to-buy').click();
      await expect(page).toHaveURL('/to-buy');
      await expect(page.getByRole('heading', { name: 'À acheter' })).toBeVisible();
    });
  });

  test.describe('768px viewport - tablets', () => {
    test('homepage renders correctly', async ({ page, browserName }) => {
      test.skip(browserName !== 'chromium', 'Viewport tests on Chromium only');
      await page.setViewportSize(VIEWPORTS.tablet);
      await page.goto('/');
      await expect(page.locator('#hero')).toBeVisible();
      await expect(page.locator('#features')).toBeVisible();
      await expect(page.locator('#how-it-works')).toBeVisible();
      await expect(page.locator('#faq')).toBeVisible();
    });

    test('dashboard cards layout on tablet', async ({ page, browserName }) => {
      test.skip(browserName !== 'chromium', 'Viewport tests on Chromium only');
      requireWrites();
      await page.setViewportSize(VIEWPORTS.tablet);
      const account = createAccount();
      await createHousehold(page, account);

      const cards = page.locator('[data-testid^="dashboard-card-"]');
      await expect(cards).toHaveCount(8);
    });

    test('navigation works on tablet viewport', async ({ page, browserName }) => {
      test.skip(browserName !== 'chromium', 'Viewport tests on Chromium only');
      requireWrites();
      await page.setViewportSize(VIEWPORTS.tablet);
      const account = createAccount();
      await createHousehold(page, account);

      await page.getByTestId('dashboard-card-members').click();
      await expect(page).toHaveURL('/members');
      await expect(page.getByRole('heading', { name: /Membres/ })).toBeVisible();
    });

    test('forms are usable on tablet', async ({ page, browserName }) => {
      test.skip(browserName !== 'chromium', 'Viewport tests on Chromium only');
      requireWrites();
      await page.setViewportSize(VIEWPORTS.tablet);
      const account = createAccount();
      await createHousehold(page, account);

      await page.getByTestId('dashboard-card-categories').click();
      await page.getByTestId('btn-new-category').click();

      const input = page.getByTestId('input-category-name');
      await expect(input).toBeVisible();
      const inputBox = await input.boundingBox();
      expect(inputBox).not.toBeNull();
      expect(inputBox!.height).toBeGreaterThanOrEqual(44);
    });
  });

  test.describe('1024px viewport - small laptops', () => {
    test('homepage renders correctly', async ({ page, browserName }) => {
      test.skip(browserName !== 'chromium', 'Viewport tests on Chromium only');
      await page.setViewportSize(VIEWPORTS.smallLaptop);
      await page.goto('/');
      await expect(page.locator('#hero')).toBeVisible();
      await expect(page.locator('#features')).toBeVisible();
      await expect(page.locator('#how-it-works')).toBeVisible();
      await expect(page.locator('#faq')).toBeVisible();
    });

    test('dashboard cards layout on small laptop', async ({ page, browserName }) => {
      test.skip(browserName !== 'chromium', 'Viewport tests on Chromium only');
      requireWrites();
      await page.setViewportSize(VIEWPORTS.smallLaptop);
      const account = createAccount();
      await createHousehold(page, account);

      const cards = page.locator('[data-testid^="dashboard-card-"]');
      await expect(cards).toHaveCount(8);
    });

    test('navigation works on small laptop viewport', async ({ page, browserName }) => {
      test.skip(browserName !== 'chromium', 'Viewport tests on Chromium only');
      requireWrites();
      await page.setViewportSize(VIEWPORTS.smallLaptop);
      const account = createAccount();
      await createHousehold(page, account);

      await page.getByTestId('dashboard-card-items').click();
      await expect(page).toHaveURL('/items');
      await page.getByTestId('back-link').click();
      await expect(page).toHaveURL('/home');
    });
  });

  test.describe('1440px viewport - large desktops', () => {
    test('homepage renders correctly', async ({ page, browserName }) => {
      test.skip(browserName !== 'chromium', 'Viewport tests on Chromium only');
      await page.setViewportSize(VIEWPORTS.largeDesktop);
      await page.goto('/');
      await expect(page.locator('#hero')).toBeVisible();
      await expect(page.locator('#features')).toBeVisible();
      await expect(page.locator('#how-it-works')).toBeVisible();
      await expect(page.locator('#faq')).toBeVisible();
    });

    test('dashboard cards layout on large desktop', async ({ page, browserName }) => {
      test.skip(browserName !== 'chromium', 'Viewport tests on Chromium only');
      requireWrites();
      await page.setViewportSize(VIEWPORTS.largeDesktop);
      const account = createAccount();
      await createHousehold(page, account);

      const cards = page.locator('[data-testid^="dashboard-card-"]');
      await expect(cards).toHaveCount(8);
    });

    test('navigation works on large desktop viewport', async ({ page, browserName }) => {
      test.skip(browserName !== 'chromium', 'Viewport tests on Chromium only');
      requireWrites();
      await page.setViewportSize(VIEWPORTS.largeDesktop);
      const account = createAccount();
      await createHousehold(page, account);

      await page.getByTestId('dashboard-card-to-buy').click();
      await expect(page).toHaveURL('/to-buy');
      await page.getByTestId('back-link').click();
      await expect(page).toHaveURL('/home');
    });
  });

  // Ticket #113 (PRD §4.13) : le bandeau vit sur la page marketing publique,
  // donc ces tests tournent sans backend (pas de gate writesAllowed).
  test.describe('PWA install banner (P1-14, #113)', () => {
    // Recharge puis arme le bandeau : on attend que l'effet de montage ait
    // tourné (compteur de visites incrémenté => listeners beforeinstallprompt
    // attachés) AVANT de dispatcher l'événement, sinon la course avec
    // l'hydratation rend le test flaky.
    async function reloadAndArm(page: Page) {
      const before = Number(
        await page.evaluate((key) => localStorage.getItem(key) ?? 0, PWA_VISITS_KEY),
      );
      await page.reload();
      await page.waitForFunction(
        ([key, previous]) => Number(localStorage.getItem(key) ?? 0) > previous,
        [PWA_VISITS_KEY, before] as const,
      );
      await page.evaluate(() => window.dispatchEvent(new Event('beforeinstallprompt')));
    }

    async function installableVisit(page: Page, visits: number) {
      await page.goto('/');
      await page.evaluate(([key, v]) => {
        localStorage.setItem(key, String(v));
      }, [PWA_VISITS_KEY, visits] as const);
      await reloadAndArm(page);
    }

    test('appears on the 2nd visit', async ({ page, browserName }) => {
      test.skip(browserName !== 'chromium', 'PWA banner tests on Chromium only');
      await installableVisit(page, 1);
      await expect(page.getByTestId('pwa-install-banner')).toBeVisible();
      await expect(page.getByTestId('pwa-install-banner')).toContainText("Installez l'application");
    });

    test('dismiss snoozes until 2 further visits, then reappears', async ({ page, browserName }) => {
      test.skip(browserName !== 'chromium', 'PWA banner tests on Chromium only');
      // Seed high so the banner shows regardless of dev double-mount.
      await installableVisit(page, 10);
      await expect(page.getByTestId('pwa-install-banner')).toBeVisible();

      await page.getByTestId('pwa-install-dismiss').click();
      await expect(page.getByTestId('pwa-install-banner')).toHaveCount(0);
      const snoozedAt = Number(
        await page.evaluate((key) => localStorage.getItem(key), PWA_SNOOZED_AT_KEY),
      );
      expect(snoozedAt).toBeGreaterThan(0);

      // Rewind inside the snooze window: still hidden after reload.
      await page.evaluate(([key, s]) => {
        localStorage.setItem(key, String(s - 10));
      }, [PWA_VISITS_KEY, snoozedAt] as const);
      await reloadAndArm(page);
      await expect(page.getByTestId('pwa-install-banner')).toHaveCount(0);

      // Fast-forward past the window: visible again.
      await page.evaluate(([key, s]) => {
        localStorage.setItem(key, String(s + 10));
      }, [PWA_VISITS_KEY, snoozedAt] as const);
      await reloadAndArm(page);
      await expect(page.getByTestId('pwa-install-banner')).toBeVisible();
    });

    test('stays hidden once installed', async ({ page, browserName }) => {
      test.skip(browserName !== 'chromium', 'PWA banner tests on Chromium only');
      await installableVisit(page, 1);
      await expect(page.getByTestId('pwa-install-banner')).toBeVisible();

      await page.evaluate(() => window.dispatchEvent(new Event('appinstalled')));
      await expect(page.getByTestId('pwa-install-banner')).toHaveCount(0);
      expect(await page.evaluate((key) => localStorage.getItem(key), PWA_INSTALLED_KEY)).toBe('1');

      await reloadAndArm(page);
      await expect(page.getByTestId('pwa-install-banner')).toHaveCount(0);
    });
  });

});
