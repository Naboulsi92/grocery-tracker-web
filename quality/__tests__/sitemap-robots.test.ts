import sitemap, { marketingRouteUrls } from '../../src/app/sitemap';
import robots from '../../src/app/robots';

describe('marketing sitemap (ticket #120)', () => {
  it('lists the 5 public routes with absolute URLs', () => {
    expect(marketingRouteUrls('https://example.com')).toEqual([
      'https://example.com',
      'https://example.com/about',
      'https://example.com/contact',
      'https://example.com/privacy',
      'https://example.com/terms',
    ]);
  });

  it('emits absolute entries from the configured site URL', () => {
    const entries = sitemap();
    expect(entries).toHaveLength(5);
    for (const entry of entries) {
      expect(entry.url).toMatch(/^https?:\/\//);
    }
  });
});

describe('robots (ticket #120)', () => {
  it('keeps the authenticated app shell out of crawlers', () => {
    const rules = robots().rules;
    const list = Array.isArray(rules) ? rules : [rules];
    const disallow: string[] = [];
    for (const rule of list) {
      if (typeof rule === 'string') continue;
      const value: unknown = rule.disallow;
      if (typeof value === 'string') {
        disallow.push(value);
      } else if (Array.isArray(value)) {
        for (const path of value) {
          if (typeof path === 'string') disallow.push(path);
        }
      }
    }
    expect(disallow).toEqual(
      expect.arrayContaining(['/home', '/items', '/categories', '/account', '/settings']),
    );
  });
});
