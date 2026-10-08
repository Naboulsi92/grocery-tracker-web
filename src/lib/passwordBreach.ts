/**
 * Client-side HaveIBeenPwned check (k-anonymity).
 *
 * The hosted project has no server-side leaked-password protection (Pro-gated
 * dashboard toggle), so account flows check here before creating or rotating
 * a password. Only the first 5 SHA-1 hex chars leave the browser — the
 * password itself (and its full hash) never does. The `Add-Padding` header
 * asks the API to pad short responses.
 *
 * Fail-open by design (offline-first app): no crypto, no network, or a
 * non-200 response returns `false` so account creation keeps working. Never
 * logs the password or its hash.
 */
export async function isPasswordBreached(password: string): Promise<boolean> {
  try {
    if (!password) return false;
    const subtle = globalThis.crypto?.subtle;
    if (!subtle) return false;
    const digest = await subtle.digest('SHA-1', new TextEncoder().encode(password));
    const hash = Array.from(new Uint8Array(digest))
      .map((byte) => byte.toString(16).padStart(2, '0'))
      .join('')
      .toUpperCase();
    const response = await fetch(`https://api.pwnedpasswords.com/range/${hash.slice(0, 5)}`, {
      headers: { 'Add-Padding': 'true' },
    });
    if (!response.ok) return false;
    const suffix = hash.slice(5);
    const body = await response.text();
    return body.split('\n').some((line) => line.split(':')[0]?.trim().toUpperCase() === suffix);
  } catch {
    console.warn('client_operation_failed', { area: 'passwordBreach', action: 'check' });
    return false;
  }
}
