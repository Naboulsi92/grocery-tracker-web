import { randomUUID } from 'node:crypto';
import { createAccount, createHousehold, expect, signUp, test } from './fixtures';
import {
  e2eEnvironment,
  fixtureRequiredReason,
  writesDisabledReason,
} from './environment';

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
      test.skip(!e2eEnvironment.writesAllowed, fixtureRequiredReason);
      await page.setViewportSize(VIEWPORTS.mobile);
      const account = createAccount();
      await createHousehold(page, account);

      const cards = page.locator('[data-testid^="dashboard-card-"]');
      await expect(cards).toHaveCount(4);

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
      test.skip(!e2eEnvironment.writesAllowed, fixtureRequiredReason);
      await page.setViewportSize(VIEWPORTS.mobile);
      const account = createAccount();
      await createHousehold(page, account);

      const clickableElements = page.locator('button, a[href], [role="button"]');
      const count = await clickableElements.count();

      let allTargetsValid = true;
      for (let i = 0; i < Math.min(count, 20); i++) {
        const element = clickableElements.nth(i);
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
      test.skip(!e2eEnvironment.writesAllowed, fixtureRequiredReason);
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
      test.skip(!e2eEnvironment.writesAllowed, writesDisabledReason);
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
      test.skip(!e2eEnvironment.writesAllowed, writesDisabledReason);
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
      await page.waitForTimeout(500);

      const items = page.locator('.item-row');
      const itemCount = await items.count();
      expect(itemCount).toBeGreaterThan(0);
    });

    test('modals/dialogs are usable on mobile', async ({ page, browserName }) => {
      test.skip(browserName !== 'chromium', 'Viewport tests on Chromium only');
      test.skip(!e2eEnvironment.writesAllowed, writesDisabledReason);
      await page.setViewportSize(VIEWPORTS.mobile);
      const account = createAccount();
      await createHousehold(page, account);

      await page.getByTestId('dashboard-card-categories').click();
      await page.getByTestId('btn-new-category').click();

      const modal = page.locator('[role="dialog"], .modal, [class*="modal"]');
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
      test.skip(!e2eEnvironment.writesAllowed, fixtureRequiredReason);
      await page.setViewportSize(VIEWPORTS.mobile);
      const account = createAccount();
      await createHousehold(page, account);

      await page.getByTestId('dashboard-card-categories').click();
      await expect(page).toHaveURL('/categories');
      await expect(page.getByRole('heading', { name: 'Catégories' })).toBeVisible();

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
      test.skip(!e2eEnvironment.writesAllowed, fixtureRequiredReason);
      await page.setViewportSize(VIEWPORTS.tablet);
      const account = createAccount();
      await createHousehold(page, account);

      const cards = page.locator('[data-testid^="dashboard-card-"]');
      await expect(cards).toHaveCount(4);
    });

    test('navigation works on tablet viewport', async ({ page, browserName }) => {
      test.skip(browserName !== 'chromium', 'Viewport tests on Chromium only');
      test.skip(!e2eEnvironment.writesAllowed, fixtureRequiredReason);
      await page.setViewportSize(VIEWPORTS.tablet);
      const account = createAccount();
      await createHousehold(page, account);

      await page.getByTestId('dashboard-card-members').click();
      await expect(page).toHaveURL('/members');
      await expect(page.getByRole('heading', { name: /Membres/ })).toBeVisible();
    });

    test('forms are usable on tablet', async ({ page, browserName }) => {
      test.skip(browserName !== 'chromium', 'Viewport tests on Chromium only');
      test.skip(!e2eEnvironment.writesAllowed, writesDisabledReason);
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
      test.skip(!e2eEnvironment.writesAllowed, fixtureRequiredReason);
      await page.setViewportSize(VIEWPORTS.smallLaptop);
      const account = createAccount();
      await createHousehold(page, account);

      const cards = page.locator('[data-testid^="dashboard-card-"]');
      await expect(cards).toHaveCount(4);
    });

    test('navigation works on small laptop viewport', async ({ page, browserName }) => {
      test.skip(browserName !== 'chromium', 'Viewport tests on Chromium only');
      test.skip(!e2eEnvironment.writesAllowed, fixtureRequiredReason);
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
      test.skip(!e2eEnvironment.writesAllowed, fixtureRequiredReason);
      await page.setViewportSize(VIEWPORTS.largeDesktop);
      const account = createAccount();
      await createHousehold(page, account);

      const cards = page.locator('[data-testid^="dashboard-card-"]');
      await expect(cards).toHaveCount(4);
    });

    test('navigation works on large desktop viewport', async ({ page, browserName }) => {
      test.skip(browserName !== 'chromium', 'Viewport tests on Chromium only');
      test.skip(!e2eEnvironment.writesAllowed, fixtureRequiredReason);
      await page.setViewportSize(VIEWPORTS.largeDesktop);
      const account = createAccount();
      await createHousehold(page, account);

      await page.getByTestId('dashboard-card-to-buy').click();
      await expect(page).toHaveURL('/to-buy');
      await page.getByTestId('back-link').click();
      await expect(page).toHaveURL('/home');
    });
  });
});