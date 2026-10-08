import { TextEncoder as NodeTextEncoder } from 'node:util';
import { webcrypto as NodeCrypto } from 'node:crypto';
import { isPasswordBreached } from '@/lib/passwordBreach';

// Uses REAL WebCrypto digests (l'ambient jsdom n'est pas fiable ici) :
// préfixes/suffixes attendus dérivés au runtime, aucune empreinte
// transcrite à la main.
async function sha1Hex(input: string): Promise<string> {
  const digest = await NodeCrypto.subtle.digest('SHA-1', new NodeTextEncoder().encode(input));
  return Array.from(new Uint8Array(digest))
    .map((byte) => byte.toString(16).padStart(2, '0'))
    .join('')
    .toUpperCase();
}

describe('isPasswordBreached (HIBP k-anonymity)', () => {
  const realCrypto = globalThis.crypto;
  const realFetch = globalThis.fetch;
  const realTextEncoder = (globalThis as Record<string, unknown>).TextEncoder;
  const fetchMock = jest.fn();

  beforeEach(() => {
    jest.clearAllMocks();
    // WebCrypto explicite de Node (l'ambient jsdom n'est pas fiable ;
    // dans les navigateurs réels, crypto.subtle existe toujours).
    // jsdom n'expose pas TextEncoder non plus : injecté depuis Node.
    Object.defineProperty(globalThis, 'crypto', {
      configurable: true,
      value: { subtle: NodeCrypto.subtle },
    });
    Object.defineProperty(globalThis, 'TextEncoder', { configurable: true, value: NodeTextEncoder });
    globalThis.fetch = fetchMock;
  });

  afterEach(() => {
    Object.defineProperty(globalThis, 'crypto', { configurable: true, value: realCrypto });
    if (realTextEncoder === undefined) {
      delete (globalThis as Record<string, unknown>).TextEncoder;
    } else {
      Object.defineProperty(globalThis, 'TextEncoder', { configurable: true, value: realTextEncoder });
    }
    globalThis.fetch = realFetch;
  });

  it('reports breached when the suffix appears in the range response', async () => {
    const hash = await sha1Hex('candidate-password');
    fetchMock.mockResolvedValue({
      ok: true,
      text: async () => `0018A45C4D1DEF81644B54AB7F969B88D:1\r\n${hash.slice(5)}:46658894\r\n`,
    });

    await expect(await isPasswordBreached('candidate-password')).toBe(true);
    // Only the 5-char prefix leaves the browser — never the password.
    expect(fetchMock).toHaveBeenCalledWith(
      `https://api.pwnedpasswords.com/range/${hash.slice(0, 5)}`,
      expect.objectContaining({ headers: { 'Add-Padding': 'true' } }),
    );
    expect(String(fetchMock.mock.calls[0][0])).not.toContain('candidate-password');
  });

  it('reports clean when the suffix is absent', async () => {
    fetchMock.mockResolvedValue({
      ok: true,
      text: async () => '0018A45C4D1DEF81644B54AB7F969B88D:1\r\n',
    });

    await expect(await isPasswordBreached('candidate-password')).toBe(false);
  });

  it('fails open on a non-200 response', async () => {
    fetchMock.mockResolvedValue({ ok: false, text: async () => '' });

    await expect(await isPasswordBreached('candidate-password')).toBe(false);
  });

  it('fails open when the network throws (offline-first)', async () => {
    fetchMock.mockRejectedValue(new TypeError('Failed to fetch'));

    await expect(await isPasswordBreached('candidate-password')).toBe(false);
  });

  it('fails open without WebCrypto and never calls the API', async () => {
    Object.defineProperty(globalThis, 'crypto', { configurable: true, value: undefined });

    await expect(await isPasswordBreached('candidate-password')).toBe(false);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('short-circuits empty passwords without hashing', async () => {
    await expect(await isPasswordBreached('')).toBe(false);
    expect(fetchMock).not.toHaveBeenCalled();
  });
});
