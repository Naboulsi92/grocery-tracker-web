import { resolveE2EEnvironment } from '../e2e-environment';

describe('resolveE2EEnvironment', () => {
  it('defaults to a local target with writes disabled', () => {
    expect(resolveE2EEnvironment({})).toEqual({
      baseURL: 'http://127.0.0.1:3000',
      isLocal: true,
      writesAllowed: false,
    });
  });

  it('rejects a remote target unless it is explicitly enabled', () => {
    expect(() => resolveE2EEnvironment({ E2E_BASE_URL: 'https://example.test' })).toThrow(
      'Remote E2E targets require E2E_ALLOW_REMOTE=true.',
    );
  });

  it('rejects a remote production environment even when remote access is enabled', () => {
    expect(() =>
      resolveE2EEnvironment({
        E2E_ALLOW_REMOTE: 'true',
        E2E_BASE_URL: 'https://example.test',
        E2E_TARGET_ENV: 'production',
      }),
    ).toThrow('Remote E2E targets require E2E_TARGET_ENV=test or staging.');
  });

  it('allows writes only when explicitly requested on a local target', () => {
    expect(
      resolveE2EEnvironment({
        E2E_ALLOW_WRITES: 'true',
        E2E_BASE_URL: 'http://localhost:3000/path',
        E2E_SUPABASE_URL: 'http://127.0.0.1:54321',
        E2E_SUPABASE_SERVICE_ROLE_KEY: 'local-service-role-key',
        NEXT_PUBLIC_SUPABASE_URL: 'http://127.0.0.1:54321',
        NEXT_PUBLIC_SUPABASE_ANON_KEY: 'local-anon-key',
      }),
    ).toEqual({
      baseURL: 'http://localhost:3000',
      isLocal: true,
      writesAllowed: true,
    });
  });

  it('rejects writes against a remote test target', () => {
    expect(() =>
      resolveE2EEnvironment({
        E2E_ALLOW_REMOTE: 'true',
        E2E_ALLOW_WRITES: 'true',
        E2E_BASE_URL: 'https://staging.example.test',
        E2E_TARGET_ENV: 'staging',
      }),
    ).toThrow('E2E writes are only allowed against a local target.');
  });

  it('rejects writes without local Supabase credentials', () => {
    expect(() => resolveE2EEnvironment({ E2E_ALLOW_WRITES: 'true' })).toThrow(
      'Writable E2E tests require local Supabase app and cleanup credentials.',
    );
    expect(() => resolveE2EEnvironment({
      E2E_ALLOW_WRITES: 'true',
      E2E_SUPABASE_SERVICE_ROLE_KEY: 'local-service-role-key',
      E2E_SUPABASE_URL: 'https://example.supabase.co',
      NEXT_PUBLIC_SUPABASE_URL: 'https://example.supabase.co',
      NEXT_PUBLIC_SUPABASE_ANON_KEY: 'remote-anon-key',
    })).toThrow('Writable E2E tests require local Supabase URLs.');
  });

  it('rejects different local Supabase app and cleanup targets', () => {
    expect(() => resolveE2EEnvironment({
      E2E_ALLOW_WRITES: 'true',
      E2E_SUPABASE_SERVICE_ROLE_KEY: 'local-service-role-key',
      E2E_SUPABASE_URL: 'http://127.0.0.1:54321',
      NEXT_PUBLIC_SUPABASE_URL: 'http://127.0.0.1:54323',
      NEXT_PUBLIC_SUPABASE_ANON_KEY: 'local-anon-key',
    })).toThrow('Writable E2E app and cleanup credentials must target the same local Supabase instance.');
  });

  it('rejects malformed and non-http targets', () => {
    expect(() => resolveE2EEnvironment({ E2E_BASE_URL: 'not a url' })).toThrow(
      'E2E_BASE_URL must be an absolute http(s) URL.',
    );
    expect(() => resolveE2EEnvironment({ E2E_BASE_URL: 'file:///tmp/app' })).toThrow(
      'E2E_BASE_URL must use http or https.',
    );
  });
});
