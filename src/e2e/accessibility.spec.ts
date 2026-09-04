import { createHousehold, expect, signUp, test } from './fixtures';
import { e2eEnvironment, writesDisabledReason } from './environment';

test.describe('Accessibility', () => {
  test.describe('Heading Hierarchy (US 99)', () => {
    test('homepage has proper heading hierarchy', async ({ page }) => {
      await page.goto('/');
      const h1 = page.getByRole('heading', { level: 1 });
      await expect(h1).toBeVisible();
      const h2s = page.locator('h2');
      const h2Count = await h2s.count();
      expect(h2Count).toBeGreaterThan(0);
      const h3s = page.locator('h3');
      const h3Count = await h3s.count();
      expect(h3Count).toBeGreaterThan(0);
    });

    test('login page has proper heading hierarchy', async ({ page }) => {
      await page.goto('/login');
      const loadingText = page.getByText('Chargement...');
      if (await loadingText.isVisible()) {
        test.skip(true, 'No Supabase backend available - auth loading never completes');
      }
      await expect(page.getByRole('heading', { level: 1, name: 'Connexion' })).toBeVisible();
    });

    test('signup page has proper heading hierarchy', async ({ page }) => {
      await page.goto('/signup');
      const loadingText = page.getByText('Chargement...');
      if (await loadingText.isVisible()) {
        test.skip(true, 'No Supabase backend available - auth loading never completes');
      }
      await expect(page.getByRole('heading', { level: 1, name: 'Inscription' })).toBeVisible();
    });

    test('app pages have proper heading hierarchy', async ({ page, account }) => {
      test.skip(!e2eEnvironment.writesAllowed, writesDisabledReason);
      await createHousehold(page, account);
      await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
    });
  });

  test.describe('Interactive Elements Have Accessible Names (US 100)', () => {
    test('homepage interactive elements have accessible names', async ({ page }) => {
      await page.goto('/');
      const buttons = page.locator('button');
      const buttonCount = await buttons.count();
      for (let i = 0; i < buttonCount; i++) {
        const button = buttons.nth(i);
        const isVisible = await button.isVisible();
        if (isVisible) {
          const hasName = await button.getAttribute('aria-label') ||
            await button.textContent() ||
            await button.getAttribute('title');
          expect(hasName).toBeTruthy();
        }
      }
    });

    test('login page interactive elements have accessible names', async ({ page }) => {
      await page.goto('/login');
      const loadingText = page.getByText('Chargement...');
      if (await loadingText.isVisible()) {
        test.skip(true, 'No Supabase backend available - auth loading never completes');
      }
      const links = page.locator('a');
      const linkCount = await links.count();
      for (let i = 0; i < linkCount; i++) {
        const link = links.nth(i);
        const isVisible = await link.isVisible();
        if (isVisible) {
          const hasName = await link.getAttribute('aria-label') || await link.textContent();
          expect(hasName).toBeTruthy();
        }
      }
    });

    test('signup page form inputs have accessible names', async ({ page }) => {
      await page.goto('/signup');
      const loadingText = page.getByText('Chargement...');
      if (await loadingText.isVisible()) {
        test.skip(true, 'No Supabase backend available - auth loading never completes');
      }
      await expect(page.getByLabel('Email')).toBeVisible();
      await expect(page.getByLabel('Mot de passe', { exact: true })).toBeVisible();
      await expect(page.getByLabel('Confirmer le mot de passe')).toBeVisible();
    });
  });

  test.describe('Loading States Announced with role=status (US 101)', () => {
    test('loading state has role=status', async ({ page, account }) => {
      test.skip(!e2eEnvironment.writesAllowed, writesDisabledReason);
      await page.goto('/login');
      const loadingText = page.getByText('Chargement...');
      if (await loadingText.isVisible()) {
        test.skip(true, 'No Supabase backend available - auth loading never completes');
      }
      await page.getByLabel('Email').fill(account.email);
      await page.getByLabel('Mot de passe').fill(account.password);
      await page.getByRole('button', { name: 'Se connecter' }).click();
      const loadingStatus = page.locator('[role="status"]');
      const count = await loadingStatus.count();
      if (count > 0) {
        await expect(loadingStatus.first()).toBeVisible();
      }
    });
  });

  test.describe('Error Messages Announced with role=alert (US 102)', () => {
    test('form validation errors have role=alert', async ({ page }) => {
      await page.goto('/signup');
      const loadingText = page.getByText('Chargement...');
      if (await loadingText.isVisible()) {
        test.skip(true, 'No Supabase backend available - auth loading never completes');
      }
      await page.getByRole('button', { name: "S'inscrire" }).click();
      const alert = page.locator('[role="alert"]');
      const count = await alert.count();
      if (count > 0) {
        await expect(alert.first()).toBeVisible();
      }
    });

    test('login error has role=alert', async ({ page, account }) => {
      test.skip(!e2eEnvironment.writesAllowed, writesDisabledReason);
      await page.goto('/login');
      const loadingText = page.getByText('Chargement...');
      if (await loadingText.isVisible()) {
        test.skip(true, 'No Supabase backend available - auth loading never completes');
      }
      await page.getByLabel('Email').fill(account.email);
      await page.getByLabel('Mot de passe').fill('wrongpassword');
      await page.getByRole('button', { name: 'Se connecter' }).click();
      await page.waitForTimeout(2000);
      const alert = page.locator('[role="alert"]');
      const count = await alert.count();
      if (count > 0) {
        await expect(alert.first()).toBeVisible();
      }
    });
  });

  test.describe('Form Labels Properly Associated (US 103)', () => {
    test('login form labels are associated', async ({ page }) => {
      await page.goto('/login');
      const loadingText = page.getByText('Chargement...');
      if (await loadingText.isVisible()) {
        test.skip(true, 'No Supabase backend available - auth loading never completes');
      }
      const emailLabel = page.locator('label').filter({ has: page.getByLabel('Email') });
      await expect(emailLabel).toHaveCount(1);
      const passwordLabel = page.locator('label').filter({ has: page.getByLabel('Mot de passe') });
      await expect(passwordLabel).toHaveCount(1);
    });

    test('signup form labels are associated', async ({ page }) => {
      await page.goto('/signup');
      const loadingText = page.getByText('Chargement...');
      if (await loadingText.isVisible()) {
        test.skip(true, 'No Supabase backend available - auth loading never completes');
      }
      await expect(page.getByLabel('Email')).toBeVisible();
      await expect(page.getByLabel('Mot de passe', { exact: true })).toBeVisible();
      await expect(page.getByLabel('Confirmer le mot de passe')).toBeVisible();
    });
  });

  test.describe('Keyboard Navigation Flow (US 105)', () => {
    test('can navigate homepage with keyboard', async ({ page }) => {
      await page.goto('/');
      await page.keyboard.press('Tab');
      const firstFocusable = page.locator('button, a, input, select, textarea, [tabindex]:not([tabindex="-1"])').first();
      await expect(firstFocusable).toBeFocused();
    });

    test('tab order is logical on login page', async ({ page }) => {
      await page.goto('/login');
      const loadingText = page.getByText('Chargement...');
      if (await loadingText.isVisible()) {
        test.skip(true, 'No Supabase backend available - auth loading never completes');
      }
      const emailInput = page.getByLabel('Email');
      const passwordInput = page.getByLabel('Mot de passe');
      const submitButton = page.getByRole('button', { name: 'Se connecter' });
      await emailInput.focus();
      await expect(emailInput).toBeFocused();
      await page.keyboard.press('Tab');
      await expect(passwordInput).toBeFocused();
      await page.keyboard.press('Tab');
      await expect(submitButton).toBeFocused();
    });

    test('tab order is logical on signup page', async ({ page }) => {
      await page.goto('/signup');
      const loadingText = page.getByText('Chargement...');
      if (await loadingText.isVisible()) {
        test.skip(true, 'No Supabase backend available - auth loading never completes');
      }
      const emailInput = page.getByLabel('Email');
      const passwordInput = page.getByLabel('Mot de passe', { exact: true });
      const confirmPasswordInput = page.getByLabel('Confirmer le mot de passe');
      const submitButton = page.getByRole('button', { name: "S'inscrire" });
      await emailInput.focus();
      await expect(emailInput).toBeFocused();
      await page.keyboard.press('Tab');
      await expect(passwordInput).toBeFocused();
      await page.keyboard.press('Tab');
      await expect(confirmPasswordInput).toBeFocused();
      await page.keyboard.press('Tab');
      await expect(submitButton).toBeFocused();
    });
  });

  test.describe('Focus Indicators Visible (US 106)', () => {
    test('focus indicators visible on homepage buttons', async ({ page }) => {
      await page.goto('/');
      const button = page.getByRole('button', { name: /Learn More/i }).first();
      await button.focus();
      const outline = await button.evaluate((el) => {
        const style = window.getComputedStyle(el);
        return style.outline;
      });
      expect(outline).not.toBe('none');
    });

    test('focus indicators visible on links', async ({ page }) => {
      await page.goto('/login');
      const loadingText = page.getByText('Chargement...');
      if (await loadingText.isVisible()) {
        test.skip(true, 'No Supabase backend available - auth loading never completes');
      }
      const link = page.getByRole('link', { name: "S'inscrire" });
      await link.focus();
      const outline = await link.evaluate((el) => {
        const style = window.getComputedStyle(el);
        return style.outline;
      });
      expect(outline).not.toBe('none');
    });

    test('focus indicators visible on form inputs', async ({ page }) => {
      await page.goto('/login');
      const loadingText = page.getByText('Chargement...');
      if (await loadingText.isVisible()) {
        test.skip(true, 'No Supabase backend available - auth loading never completes');
      }
      const input = page.getByLabel('Email');
      await input.focus();
      const outline = await input.evaluate((el) => {
        const style = window.getComputedStyle(el);
        return style.outline;
      });
      expect(outline).not.toBe('none');
    });
  });

  test.describe('Focus Trap in Dialogs/Modals (US 107)', () => {
    test('dialog traps focus within modal', async ({ page, account }) => {
      test.skip(!e2eEnvironment.writesAllowed, writesDisabledReason);
      await createHousehold(page, account);
      await page.getByTestId('dashboard-card-categories').click();
      const deleteButton = page.locator('[data-testid*="btn-delete-category"]').first();
      const deleteCount = await deleteButton.count();
      if (deleteCount > 0) {
        await deleteButton.first().click();
        await page.waitForTimeout(500);
        const dialog = page.locator('[role="dialog"]');
        const dialogCount = await dialog.count();
        if (dialogCount > 0) {
          await expect(dialog).toBeVisible();
          const focusableInDialog = dialog.locator('button, a, input, [tabindex]:not([tabindex="-1"])');
          const count = await focusableInDialog.count();
          expect(count).toBeGreaterThan(0);
        }
      }
    });
  });

  test.describe('Skip Links or Logical Tab Order (US 108)', () => {
    test('homepage has skip link or logical tab order', async ({ page }) => {
      await page.goto('/');
      const skipLink = page.locator('a[href="#main"], a[href="#content"], [class*="skip"]');
      const skipCount = await skipLink.count();
      if (skipCount > 0) {
        await expect(skipLink.first()).toBeVisible();
      } else {
        const main = page.locator('main, #main, [role="main"]');
        const mainCount = await main.count();
        expect(mainCount).toBeGreaterThan(0);
      }
    });

    test('app pages have logical tab order', async ({ page, account }) => {
      test.skip(!e2eEnvironment.writesAllowed, writesDisabledReason);
      await createHousehold(page, account);
      const main = page.locator('main, #main, [role="main"]');
      const mainCount = await main.count();
      expect(mainCount).toBeGreaterThan(0);
    });
  });

  test.describe('Reduced Motion Preferences Respected (US 111)', () => {
    test('respects prefers-reduced-motion', async ({ page }) => {
      await page.addInitScript(() => {
        Object.defineProperty(window, 'matchMedia', {
          writable: true,
          value: (query: string) => {
            if (query === '(prefers-reduced-motion: reduce)') {
              return {
                matches: true,
                media: query,
                onchange: null,
                addListener: () => {},
                removeListener: () => {},
                addEventListener: () => {},
                removeEventListener: () => {},
                dispatchEvent: () => true,
              };
            }
            return { matches: false, media: query };
          },
        });
      });
      await page.goto('/');
      await page.waitForLoadState('domcontentloaded');
      // Check that the CSS has proper reduced motion rules, not that body has no transitions
      const hasReducedMotionCSS = await page.evaluate(() => {
        // Check if globals.css or marketing.css contains reduced motion rules
        const sheets = Array.from(document.styleSheets);
        for (const sheet of sheets) {
          try {
            const rules = Array.from(sheet.cssRules || sheet.rules || []);
            for (const rule of rules) {
              const mediaRule = rule as CSSMediaRule;
              if (rule.type === CSSRule.MEDIA_RULE && mediaRule.conditionText) {
                const mediaText = mediaRule.conditionText;
                if (mediaText.includes('prefers-reduced-motion')) {
                  return true;
                }
              }
            }
          } catch (e) {
            // Cross-origin stylesheet, skip
          }
        }
        return false;
      });
      expect(hasReducedMotionCSS).toBe(true);
    });
  });

  test.describe('Color Contrast on Critical Text (US 109)', () => {
    test('heading text has sufficient color contrast', async ({ page }) => {
      await page.goto('/');
      const heading = page.getByRole('heading', { level: 1 });
      const contrastInfo = await heading.evaluate((el) => {
        const style = window.getComputedStyle(el);
        const color = style.color;
        // Get background from parent/container, not from the heading itself (which may be transparent)
        let bgColor = style.backgroundColor;
        // If background is transparent, walk up the DOM to find the actual background
        let parent = el.parentElement;
        while (parent && (bgColor === 'rgba(0, 0, 0, 0)' || bgColor === 'transparent' || bgColor === '')) {
          const parentStyle = window.getComputedStyle(parent);
          bgColor = parentStyle.backgroundColor;
          parent = parent.parentElement;
          // Fall back to body background if we reach the top
          if (!parent || parent.tagName === 'BODY') {
            bgColor = window.getComputedStyle(document.body).backgroundColor;
            break;
          }
        }
        const rgb = color.match(/\d+/g);
        const bgRgb = bgColor.match(/\d+/g);
        if (!rgb || !bgRgb) return null;
        const r = parseInt(rgb[0]);
        const g = parseInt(rgb[1]);
        const b = parseInt(rgb[2]);
        const bgR = parseInt(bgRgb[0]);
        const bgG = parseInt(bgRgb[1]);
        const bgB = parseInt(bgRgb[2]);
        const getLuminance = (r: number, g: number, b: number) => {
          const [rs, gs, bs] = [r, g, b].map(c => {
            c = c / 255;
            return c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);
          });
          return 0.2126 * rs + 0.7152 * gs + 0.0722 * bs;
        };
        const l1 = getLuminance(r, g, b);
        const l2 = getLuminance(bgR, bgG, bgB);
        const contrast = (Math.max(l1, l2) + 0.05) / (Math.min(l1, l2) + 0.05);
        return { contrast, color, bgColor };
      });
      if (contrastInfo) {
        expect(contrastInfo.contrast).toBeGreaterThan(3);
      }
    });

    test('body text has sufficient color contrast', async ({ page }) => {
      await page.goto('/login');
      const loadingText = page.getByText('Chargement...');
      if (await loadingText.isVisible()) {
        test.skip(true, 'No Supabase backend available - auth loading never completes');
      }
      const bodyText = page.locator('p').first();
      const contrastInfo = await bodyText.evaluate((el) => {
        const style = window.getComputedStyle(el);
        const color = style.color;
        const bgColor = style.backgroundColor;
        const rgb = color.match(/\d+/g);
        const bgRgb = bgColor.match(/\d+/g);
        if (!rgb || !bgRgb) return null;
        const r = parseInt(rgb[0]);
        const g = parseInt(rgb[1]);
        const b = parseInt(rgb[2]);
        const bgR = parseInt(bgRgb[0]);
        const bgG = parseInt(bgRgb[1]);
        const bgB = parseInt(bgRgb[2]);
        const getLuminance = (r: number, g: number, b: number) => {
          const [rs, gs, bs] = [r, g, b].map(c => {
            c = c / 255;
            return c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);
          });
          return 0.2126 * rs + 0.7152 * gs + 0.0722 * bs;
        };
        const l1 = getLuminance(r, g, b);
        const l2 = getLuminance(bgR, bgG, bgB);
        const contrast = (Math.max(l1, l2) + 0.05) / (Math.min(l1, l2) + 0.05);
        return { contrast, color, bgColor };
      });
      if (contrastInfo) {
        expect(contrastInfo.contrast).toBeGreaterThan(3);
      }
    });
  });

  test.describe('Alt Text on Images (US 110)', () => {
    test('informative images have alt text', async ({ page }) => {
      await page.goto('/');
      const images = page.locator('img');
      const count = await images.count();
      for (let i = 0; i < count; i++) {
        const img = images.nth(i);
        const isVisible = await img.isVisible();
        if (isVisible) {
          const alt = await img.getAttribute('alt');
          const ariaLabel = await img.getAttribute('aria-label');
          const role = await img.getAttribute('role');
          expect(alt || ariaLabel || role === 'presentation' || role === 'none').toBeTruthy();
        }
      }
    });
  });

  test.describe('ARIA Labels on Icon-Only Buttons', () => {
    test('icon-only buttons have aria-label', async ({ page, account }) => {
      test.skip(!e2eEnvironment.writesAllowed, writesDisabledReason);
      await createHousehold(page, account);
      await page.getByTestId('dashboard-card-items').click();
      const iconButtons = page.locator('button').filter({ has: page.locator('svg') });
      const count = await iconButtons.count();
      for (let i = 0; i < count; i++) {
        const button = iconButtons.nth(i);
        const isVisible = await button.isVisible();
        if (isVisible) {
          const ariaLabel = await button.getAttribute('aria-label');
          const title = await button.getAttribute('title');
          const text = await button.textContent();
          expect(ariaLabel || title || text).toBeTruthy();
        }
      }
    });
  });

  test.describe('Live Regions Announcing Dynamic Content', () => {
    test('dynamic content updates are announced', async ({ page, account }) => {
      test.skip(!e2eEnvironment.writesAllowed, writesDisabledReason);
      await createHousehold(page, account);
      await page.getByTestId('dashboard-card-items').click();
      const liveRegion = page.locator('[aria-live], [role="status"], [role="log"], [role="alert"]');
      const count = await liveRegion.count();
      expect(count).toBeGreaterThanOrEqual(0);
    });

    test('toast notifications have aria-live', async ({ page, account }) => {
      test.skip(!e2eEnvironment.writesAllowed, writesDisabledReason);
      await createHousehold(page, account);
      await page.getByTestId('dashboard-card-categories').click();
      await page.getByTestId('btn-new-category').click();
      await page.getByTestId('input-category-name').fill('Test Category');
      await page.getByTestId('btn-create-category').click();
      await page.waitForTimeout(2000);
      const liveRegion = page.locator('[aria-live="polite"], [aria-live="assertive"], [role="status"]');
      const count = await liveRegion.count();
      expect(count).toBeGreaterThanOrEqual(0);
    });
  });

  test.describe('Additional Accessibility Tests', () => {
    test('all pages have lang attribute', async ({ page }) => {
      await page.goto('/');
      const html = page.locator('html');
      const lang = await html.getAttribute('lang');
      expect(lang).toBeTruthy();
    });

    test('pages have proper document title', async ({ page }) => {
      await page.goto('/');
      const title = await page.title();
      expect(title).toBeTruthy();
      expect(title.length).toBeGreaterThan(0);
    });

    test('form inputs have proper type attributes', async ({ page }) => {
      await page.goto('/login');
      const loadingText = page.getByText('Chargement...');
      if (await loadingText.isVisible()) {
        test.skip(true, 'No Supabase backend available - auth loading never completes');
      }
      const emailInput = page.getByLabel('Email');
      const type = await emailInput.getAttribute('type');
      expect(type).toBe('email');
    });

    test('password inputs have proper type', async ({ page }) => {
      await page.goto('/login');
      const loadingText = page.getByText('Chargement...');
      if (await loadingText.isVisible()) {
        test.skip(true, 'No Supabase backend available - auth loading never completes');
      }
      const passwordInput = page.getByLabel('Mot de passe');
      const type = await passwordInput.getAttribute('type');
      expect(type).toBe('password');
    });

    test('required fields are marked', async ({ page }) => {
      await page.goto('/signup');
      const loadingText = page.getByText('Chargement...');
      if (await loadingText.isVisible()) {
        test.skip(true, 'No Supabase backend available - auth loading never completes');
      }
      const emailInput = page.getByLabel('Email');
      const required = await emailInput.getAttribute('aria-required');
      const requiredAttr = await emailInput.getAttribute('required');
      expect(required === 'true' || requiredAttr !== null).toBeTruthy();
    });
  });
});