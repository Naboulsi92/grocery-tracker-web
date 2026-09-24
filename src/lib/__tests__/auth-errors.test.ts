import { mapAuthErrorToKey, AUTH_ERROR_KEYS } from '@/lib/authErrors';

describe('mapAuthErrorToKey (ticket #122)', () => {
  it('maps invalid credentials', () => {
    expect(mapAuthErrorToKey({ message: 'Invalid login credentials' })).toBe(
      AUTH_ERROR_KEYS.INVALID_CREDENTIALS_KEY,
    );
  });

  it('maps unconfirmed email', () => {
    expect(mapAuthErrorToKey({ message: 'Email not confirmed' })).toBe(
      AUTH_ERROR_KEYS.EMAIL_NOT_CONFIRMED_KEY,
    );
  });

  it('maps existing user', () => {
    expect(mapAuthErrorToKey({ message: 'User already registered' })).toBe(AUTH_ERROR_KEYS.USER_EXISTS_KEY);
    expect(mapAuthErrorToKey({ message: 'A user with this email has already been registered' })).toBe(
      AUTH_ERROR_KEYS.USER_EXISTS_KEY,
    );
  });

  it('maps weak passwords', () => {
    expect(mapAuthErrorToKey({ message: 'Password should be at least 6 characters' })).toBe(
      AUTH_ERROR_KEYS.WEAK_PASSWORD_KEY,
    );
  });

  it('maps connectivity failures', () => {
    expect(mapAuthErrorToKey({ message: 'Failed to fetch' })).toBe(AUTH_ERROR_KEYS.NETWORK_KEY);
  });

  it('falls back to unknown for null, empty and unrecognized shapes', () => {
    expect(mapAuthErrorToKey(null)).toBe(AUTH_ERROR_KEYS.UNKNOWN_KEY);
    expect(mapAuthErrorToKey({})).toBe(AUTH_ERROR_KEYS.UNKNOWN_KEY);
    expect(mapAuthErrorToKey({ message: 'Something entirely new' })).toBe(AUTH_ERROR_KEYS.UNKNOWN_KEY);
  });
});
