import { mapAuthErrorToKey, AUTH_ERROR_KEYS } from '@/lib/authErrors';

describe('mapAuthErrorToKey (ticket #122)', () => {
  it('maps invalid credentials', () => {
    expect(mapAuthErrorToKey({ message: 'Invalid login credentials' })).toBe(
      AUTH_ERROR_KEYS.INVALID_CREDENTIALS,
    );
  });

  it('maps unconfirmed email', () => {
    expect(mapAuthErrorToKey({ message: 'Email not confirmed' })).toBe(
      AUTH_ERROR_KEYS.EMAIL_NOT_CONFIRMED,
    );
  });

  it('maps existing user', () => {
    expect(mapAuthErrorToKey({ message: 'User already registered' })).toBe(AUTH_ERROR_KEYS.USER_EXISTS);
    expect(mapAuthErrorToKey({ message: 'A user with this email has already been registered' })).toBe(
      AUTH_ERROR_KEYS.USER_EXISTS,
    );
  });

  it('maps weak passwords', () => {
    expect(mapAuthErrorToKey({ message: 'Password should be at least 6 characters' })).toBe(
      AUTH_ERROR_KEYS.WEAK_PASSWORD,
    );
  });

  it('maps connectivity failures', () => {
    expect(mapAuthErrorToKey({ message: 'Failed to fetch' })).toBe(AUTH_ERROR_KEYS.NETWORK);
  });

  it('falls back to unknown for null, empty and unrecognized shapes', () => {
    expect(mapAuthErrorToKey(null)).toBe(AUTH_ERROR_KEYS.UNKNOWN);
    expect(mapAuthErrorToKey({})).toBe(AUTH_ERROR_KEYS.UNKNOWN);
    expect(mapAuthErrorToKey({ message: 'Something entirely new' })).toBe(AUTH_ERROR_KEYS.UNKNOWN);
  });
});
