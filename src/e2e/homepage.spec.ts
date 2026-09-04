import { expect, test } from './fixtures';
import { e2eEnvironment } from './environment';

test.describe('Homepage', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
  });

  test('loads successfully', async ({ page }) => {
    await expect(page).toHaveTitle(/Grocery List App/);
    await expect(page.getByRole('main')).toBeVisible();
  });

  test('all sections render', async ({ page }) => {
    await expect(page.locator('#hero')).toBeVisible();
    await expect(page.locator('#features')).toBeVisible();
    await expect(page.locator('#how-it-works')).toBeVisible();
    await expect(page.locator('#faq')).toBeVisible();
  });

  test('Hero section renders with expected content', async ({ page }) => {
    await expect(page.getByRole('heading', { level: 1 })).toContainText('Collaborative grocery lists');
    // Use data-testid to avoid strict mode violation: 'for households' appears twice in the DOM
    // (once in H1, once in the hero note below CTAs)
    await expect(page.getByTestId('hero-households-text')).toBeVisible();
    await expect(page.locator('#hero').getByRole('link', { name: 'Get Started', exact: true })).toBeVisible();
    await expect(page.getByRole('button', { name: /Learn More/ })).toBeVisible();
  });

  test('Features section renders', async ({ page }) => {
    const featuresSection = page.locator('#features');
    await expect(featuresSection).toBeVisible();
    await expect(featuresSection.getByRole('heading', { name: /Everything you need for shared shopping/i })).toBeVisible();
  });

  test('How It Works section renders', async ({ page }) => {
    const howItWorksSection = page.locator('#how-it-works');
    await expect(howItWorksSection).toBeVisible();
    await expect(howItWorksSection.getByRole('heading', { name: /How It Works/i })).toBeVisible();
  });

  test('FAQ section renders', async ({ page }) => {
    const faqSection = page.locator('#faq');
    await expect(faqSection).toBeVisible();
    await expect(faqSection.getByRole('heading', { name: /Frequently Asked Questions/i })).toBeVisible();
  });

  test('CTA section renders', async ({ page }) => {
    const ctaSection = page.locator('#cta');
    await expect(ctaSection).toBeVisible();
    await expect(ctaSection.getByText(/Ready to simplify your shopping/i)).toBeVisible();
  });

  test('navigation links work - Signup button in header', async ({ page }) => {
    await page.getByRole('link', { name: /Signup/i }).click();
    await page.waitForURL(/signup/);
    await expect(page).toHaveURL('/signup');
    const loadingText = page.getByText('Chargement...');
    if (await loadingText.isVisible()) {
      test.skip(true, 'No Supabase backend available - auth loading never completes');
    }
    await expect(page.getByRole('heading', { name: /Inscription/i })).toBeVisible();
  });

  test('navigation links work - Login button in header', async ({ page }) => {
    await page.goto('/');
    await page.getByRole('link', { name: /Login/i }).click();
    await expect(page).toHaveURL('/login');
    const loadingText = page.getByText('Chargement...');
    if (await loadingText.isVisible()) {
      test.skip(true, 'No Supabase backend available - auth loading never completes');
    }
    await expect(page.getByRole('heading', { name: /Connexion/i })).toBeVisible();
  });

  test('scroll to section functionality works - Learn More button', async ({ page }) => {
    const learnMoreButton = page.getByRole('button', { name: /Learn More/i });
    await learnMoreButton.click();
    
    const featuresSection = page.locator('#features');
    await expect(featuresSection).toBeVisible();
  });

  test('Get Started button navigates to signup', async ({ page }) => {
    const getStartedButton = page.locator('#hero').getByRole('link', { name: 'Get Started', exact: true });
    await getStartedButton.click();
    await expect(page).toHaveURL('/signup');
  });

  test('FAQ accordion interaction - expand and collapse', async ({ page }) => {
    const faqSection = page.locator('#faq');
    const firstQuestion = faqSection.getByRole('button').first();

    await firstQuestion.click({ force: true });
    await page.waitForTimeout(100);
    const firstAnswer = faqSection.getByText(/Yes! Our core features/i);
    await expect(firstAnswer).toBeVisible();
    
    await firstQuestion.click({ force: true });
    await page.waitForTimeout(100);
    await expect(firstAnswer).not.toBeVisible();
  });

  test('FAQ accordion - multiple items can be toggled', async ({ page }) => {
    const faqSection = page.locator('#faq');
    const questions = faqSection.getByRole('button');
    
    await questions.nth(0).click({ force: true });
    await page.waitForTimeout(100);
    await expect(questions.nth(0)).toHaveAttribute('aria-expanded', 'true');
    await expect(questions.nth(1)).toHaveAttribute('aria-expanded', 'false');
    
    await questions.nth(1).click({ force: true });
    await page.waitForTimeout(100);
    await expect(questions.nth(0)).toHaveAttribute('aria-expanded', 'false');
    await expect(questions.nth(1)).toHaveAttribute('aria-expanded', 'true');
    
    await questions.nth(0).click({ force: true });
    await page.waitForTimeout(100);
    await expect(questions.nth(0)).toHaveAttribute('aria-expanded', 'true');
    await expect(questions.nth(1)).toHaveAttribute('aria-expanded', 'false');
  });

  test.describe('Mobile responsiveness', () => {
    test('320px viewport - mobile landscape/small phones', async ({ page, browserName }) => {
      test.skip(browserName !== 'chromium', 'Viewport tests on Chromium only for consistency');
      
      await page.setViewportSize({ width: 320, height: 568 });
      
      await expect(page.locator('#hero')).toBeVisible();
      await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
      
      const mobileMenuButton = page.locator('button').filter({ hasText: '' }).first();
      await expect(mobileMenuButton).toBeVisible();
      
      await page.locator('#hero').getByRole('link', { name: 'Get Started', exact: true }).click();
      await expect(page).toHaveURL('/signup');
    });

    test('768px viewport - tablets', async ({ page, browserName }) => {
      test.skip(browserName !== 'chromium', 'Viewport tests on Chromium only for consistency');
      
      await page.setViewportSize({ width: 768, height: 1024 });
      
      await expect(page.locator('#hero')).toBeVisible();
      await expect(page.locator('#features')).toBeVisible();
      await expect(page.locator('#how-it-works')).toBeVisible();
      await expect(page.locator('#faq')).toBeVisible();
      
      await expect(page.getByRole('link', { name: /Signup/i })).toBeVisible();
      await expect(page.getByRole('link', { name: /Login/i })).toBeVisible();
    });

    test('1024px viewport - small laptops', async ({ page, browserName }) => {
      test.skip(browserName !== 'chromium', 'Viewport tests on Chromium only for consistency');
      
      await page.setViewportSize({ width: 1024, height: 768 });
      
      await expect(page.locator('#hero')).toBeVisible();
      await expect(page.locator('#features')).toBeVisible();
      await expect(page.locator('#how-it-works')).toBeVisible();
      await expect(page.locator('#faq')).toBeVisible();
      
      await expect(page.getByRole('link', { name: /Signup/i })).toBeVisible();
      await expect(page.getByRole('link', { name: /Login/i })).toBeVisible();
    });

    test('1440px viewport - large desktops', async ({ page, browserName }) => {
      test.skip(browserName !== 'chromium', 'Viewport tests on Chromium only for consistency');
      
      await page.setViewportSize({ width: 1440, height: 900 });
      
      await expect(page.locator('#hero')).toBeVisible();
      await expect(page.locator('#features')).toBeVisible();
      await expect(page.locator('#how-it-works')).toBeVisible();
      await expect(page.locator('#faq')).toBeVisible();
      
      const heroContent = page.locator('#hero');
      await expect(heroContent.getByRole('heading', { level: 1 })).toBeVisible();
    });
  });

  test.describe('Performance tests', () => {
    test.slow();

    test('Core Web Vitals - LCP < 2.5s', async ({ page }) => {
      const startTime = Date.now();
      
      await page.goto('/');
      await page.waitForLoadState('networkidle');
      
      const lcp = await page.evaluate(() => {
        return new Promise<number>((resolve) => {
          const observer = new PerformanceObserver((list) => {
            const entries = list.getEntries();
            const lastEntry = entries[entries.length - 1] as PerformanceResourceTiming;
            resolve(lastEntry.startTime);
          });
          
          observer.observe({ type: 'largest-contentful-paint', buffered: true });
          
          // Fallback: if LCP not observed within 100ms, use fallback calculation
          // 100ms is sufficient because page already reached networkIdle state
          setTimeout(() => {
            const entries = performance.getEntriesByType('largest-contentful-paint');
            if (entries.length > 0) {
              resolve((entries[entries.length - 1] as PerformanceEntry).startTime);
            } else {
              resolve(Date.now() - startTime);
            }
            observer.disconnect();
          }, 100);
        });
      });
      
      expect(lcp).toBeLessThan(2500);
    });

    test('Core Web Vitals - CLS < 0.1', async ({ page }) => {
      await page.goto('/');
      await page.waitForLoadState('networkidle');
      
      // Wait 1 second to allow any final layout shifts to settle
      // CLS measurement needs time to capture all shifts after networkIdle
      await new Promise((resolve) => setTimeout(resolve, 1000));
      
      const cls = await page.evaluate(() => {
        return new Promise<number>((resolve) => {
          let clsValue = 0;
          
          const observer = new PerformanceObserver((list) => {
            for (const entry of list.getEntries()) {
              const layoutEntry = entry as { value?: number; hadRecentInput?: boolean };
              if (!layoutEntry.hadRecentInput) {
                clsValue += layoutEntry.value || 0;
              }
            }
          });
          
          observer.observe({ type: 'layout-shift', buffered: true });
          
          setTimeout(() => {
            resolve(clsValue);
            observer.disconnect();
          }, 500);
        });
      });
      
      expect(cls).toBeLessThan(0.1);
    });

    test('font loading does not block rendering', async ({ page }) => {
      const fontLoadStart = Date.now();
      
      await page.goto('/');
      
      const mainContent = page.getByRole('main');
      await expect(mainContent).toBeVisible({ timeout: 5000 });
      
      const fontLoadTime = Date.now() - fontLoadStart;
      expect(fontLoadTime).toBeLessThan(3000);
    });

    test('page loads within acceptable time', async ({ page }) => {
      const loadStart = Date.now();
      
      await page.goto('/');
      await page.waitForLoadState('domcontentloaded');
      
      const loadTime = Date.now() - loadStart;
      expect(loadTime).toBeLessThan(3000);
    });

    test('Core Web Vitals - FID < 100ms', async ({ page }) => {
      await page.goto('/');
      await page.waitForLoadState('networkidle');

      const fid = await page.evaluate(() => {
        return new Promise<number>((resolve) => {
          let fidValue = 0;
          let resolved = false;

          const observer = new PerformanceObserver((list) => {
            const entries = list.getEntries();
            for (const entry of entries) {
              const paintEntry = entry as { processingStart?: number; startTime?: number; duration?: number };
              if (paintEntry.processingStart !== undefined && paintEntry.startTime !== undefined) {
                fidValue = paintEntry.processingStart - paintEntry.startTime;
                if (!resolved) {
                  resolved = true;
                  resolve(fidValue);
                }
              }
            }
          });

          observer.observe({ type: 'first-input', buffered: true });

          setTimeout(() => {
            if (!resolved) {
              const entries = performance.getEntriesByType('first-input');
              if (entries.length > 0) {
                const entry = entries[0] as { processingStart?: number; startTime?: number };
                fidValue = entry.processingStart! - entry.startTime!;
              }
              resolve(fidValue);
            }
            observer.disconnect();
          }, 500);
        });
      });

      expect(fid).toBeLessThan(100);
    });
  });
});
