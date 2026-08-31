const LOCAL_HOSTNAMES = new Set(['localhost', '127.0.0.1', '::1']);
const REMOTE_TEST_ENVIRONMENTS = new Set(['test', 'staging']);

export type E2EEnvironment = {
  baseURL: string;
  isLocal: boolean;
  writesAllowed: boolean;
};

type Environment = Readonly<Record<string, string | undefined>>;

export function resolveE2EEnvironment(env: Environment): E2EEnvironment {
  const baseURL = env.E2E_BASE_URL || 'http://127.0.0.1:3000';
  let url: URL;

  try {
    url = new URL(baseURL);
  } catch {
    throw new Error('E2E_BASE_URL must be an absolute http(s) URL.');
  }

  if (!['http:', 'https:'].includes(url.protocol)) {
    throw new Error('E2E_BASE_URL must use http or https.');
  }

  const isLocal = LOCAL_HOSTNAMES.has(url.hostname);
  if (!isLocal) {
    if (env.E2E_ALLOW_REMOTE !== 'true') {
      throw new Error('Remote E2E targets require E2E_ALLOW_REMOTE=true.');
    }
    if (!REMOTE_TEST_ENVIRONMENTS.has(env.E2E_TARGET_ENV || '')) {
      throw new Error('Remote E2E targets require E2E_TARGET_ENV=test or staging.');
    }
  }

  const writesAllowed = env.E2E_ALLOW_WRITES === 'true';
  if (writesAllowed && !isLocal) {
    throw new Error('E2E writes are only allowed against a local target.');
  }
  if (writesAllowed) {
    const appSupabaseURL = env.NEXT_PUBLIC_SUPABASE_URL;
    const cleanupSupabaseURL = env.E2E_SUPABASE_URL;
    if (!appSupabaseURL || !env.NEXT_PUBLIC_SUPABASE_ANON_KEY || !cleanupSupabaseURL || !env.E2E_SUPABASE_SERVICE_ROLE_KEY) {
      throw new Error('Writable E2E tests require local Supabase app and cleanup credentials.');
    }
    let appURL: URL;
    let cleanupURL: URL;
    try {
      appURL = new URL(appSupabaseURL);
      cleanupURL = new URL(cleanupSupabaseURL);
    } catch {
      throw new Error('Writable E2E tests require valid local Supabase URLs.');
    }
    if (!LOCAL_HOSTNAMES.has(appURL.hostname) || !LOCAL_HOSTNAMES.has(cleanupURL.hostname)) {
      throw new Error('Writable E2E tests require local Supabase URLs.');
    }
    if (appURL.origin !== cleanupURL.origin) {
      throw new Error('Writable E2E app and cleanup credentials must target the same local Supabase instance.');
    }
  }

  return { baseURL: url.origin, isLocal, writesAllowed };
}
