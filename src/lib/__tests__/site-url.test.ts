import { resolveSiteUrl } from '@/lib/site-url';

describe('resolveSiteUrl', () => {
  it('prefers NEXT_PUBLIC_SITE_URL when set', () => {
    expect(
      resolveSiteUrl({ NEXT_PUBLIC_SITE_URL: 'https://preview-123.vercel.app' }),
    ).toBe('https://preview-123.vercel.app');
  });

  it('strips trailing slashes from the explicit URL', () => {
    expect(
      resolveSiteUrl({ NEXT_PUBLIC_SITE_URL: 'https://example.com///' }),
    ).toBe('https://example.com');
  });

  it('throws fail-fast on an invalid explicit URL', () => {
    expect(() => resolveSiteUrl({ NEXT_PUBLIC_SITE_URL: 'not-a-url' })).toThrow(
      /NEXT_PUBLIC_SITE_URL/,
    );
    expect(() => resolveSiteUrl({ NEXT_PUBLIC_SITE_URL: 'ftp://example.com' })).toThrow(
      /NEXT_PUBLIC_SITE_URL/,
    );
  });

  it('falls back to VERCEL_URL with an https protocol prefix', () => {
    expect(resolveSiteUrl({ VERCEL_URL: 'my-app.vercel.app' })).toBe(
      'https://my-app.vercel.app',
    );
  });

  it('prefers the explicit URL over VERCEL_URL', () => {
    expect(
      resolveSiteUrl({
        NEXT_PUBLIC_SITE_URL: 'https://prod.example.com',
        VERCEL_URL: 'preview-123.vercel.app',
      }),
    ).toBe('https://prod.example.com');
  });

  it('falls back to localhost when nothing is set', () => {
    expect(resolveSiteUrl({})).toBe('http://localhost:3000');
  });
});
