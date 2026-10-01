/**
 * Search Console ownership tag (issue #194).
 *
 * Google brand verification requires proving control of the homepage URL.
 * The `google-site-verification` meta tag must stay rendered on every page —
 * removing it lapses the Search Console verification and re-blocks branding.
 */
import { metadata } from '@/app/layout';

describe('Search Console site verification (#194)', () => {
  it('exposes the google-site-verification token in root metadata', () => {
    expect(metadata.verification?.google).toBe(
      'Sk6lQdMgaJfyQGVTz7aUN03Pi4fm-iZlgN0n2Zw-05I',
    );
  });
});
