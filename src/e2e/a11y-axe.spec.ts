import AxeBuilder from '@axe-core/playwright';
import { test, expect } from './fixtures';
import { waitForAnimationsToSettle } from './helpers';

/**
 * axe-core gates (ticket #119, WCAG 2.1 AA): zero violations with the
 * wcag2a + wcag2aa tag sets. Public pages run without a session;
 * authenticated pages reuse the shared seed session (fail-fast without a
 * seeded backend, never a silent skip).
 */
test.describe('axe-core WCAG 2.1 AA', () => {
  for (const route of ['/', '/login', '/signup']) {
    test(`0 violations on ${route}`, async ({ page }) => {
      await page.goto(route);
      await page.waitForLoadState('domcontentloaded');
      await expect(page.getByRole('heading', { level: 1 }).first()).toBeVisible({ timeout: 15000 });
      // Stable rendering: entrance animations depress measured contrast.
      await waitForAnimationsToSettle(page);
      const results = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa']).analyze();
      expect(results.violations).toEqual([]);
    });
  }

  for (const route of [
    '/home',
    '/items',
    '/categories',
    '/to-buy',
    '/members',
    '/settings/notifications',
  ]) {
    test(`0 violations on ${route}`, async ({ authenticatedPage: page }) => {
      await page.goto(route);
      await expect(page.getByRole('heading', { level: 1 }).first()).toBeVisible({ timeout: 15000 });
      // Stable rendering: entrance animations depress measured contrast.
      await waitForAnimationsToSettle(page);
      const results = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa']).analyze();
      expect(results.violations).toEqual([]);
    });
  }
});
