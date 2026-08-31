import { resolveE2EEnvironment } from '../../quality/e2e-environment';

export const e2eEnvironment = resolveE2EEnvironment(process.env);

export const writesDisabledReason =
  'Set E2E_ALLOW_WRITES=true against the local Supabase stack to run write E2E tests.';
export const fixtureRequiredReason =
  'This scenario creates isolated fixture data and requires E2E_ALLOW_WRITES=true with local Supabase.';
