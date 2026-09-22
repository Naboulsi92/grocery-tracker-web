/**
 * PRD v1.4 § "Comptes de test" — three dedicated addresses reserved
 * exclusively for automated tests (RFC 2606 `.test`, never routable).
 *
 * - household 1 (userA + userB): same foyer → realtime sync / rights equality.
 * - household 2 (userA): isolated foyer → RLS / cross-foyer leak checks.
 *
 * Passwords NEVER live in the repo (`scan:secrets` forbids literals):
 * `E2E_PRD_PASSWORD` overrides, otherwise the global setup generates one
 * per run and shares it with workers via `test-results/prd-seed.json`
 * (gitignored + scanner-ignored).
 */
export type PrdAccountRole = 'household1.userA' | 'household1.userB' | 'household2.userA';

export type PrdAccount = {
  role: PrdAccountRole;
  email: string;
  firstName: string;
  lastName: string;
  foyer: 1 | 2;
};

export const PRD_ACCOUNTS: readonly PrdAccount[] = [
  {
    role: 'household1.userA',
    email: 'e2e.household1.userA@e2e.grocerylist.test',
    firstName: 'Karim',
    lastName: 'PRD',
    foyer: 1,
  },
  {
    role: 'household1.userB',
    email: 'e2e.household1.userB@e2e.grocerylist.test',
    firstName: 'Sarah',
    lastName: 'PRD',
    foyer: 1,
  },
  {
    role: 'household2.userA',
    email: 'e2e.household2.userA@e2e.grocerylist.test',
    firstName: 'Nadia',
    lastName: 'PRD',
    foyer: 2,
  },
];

/** Deterministic household names created by global-setup (ASCII on purpose). */
export const PRD_FOYER_1_NAME = 'Foyer test 1';
export const PRD_FOYER_2_NAME = 'Foyer test 2';

/** File (repo-root relative) where global-setup publishes the run password. */
export const PRD_SEED_STATE_FILENAME = 'test-results/prd-seed.json';

/**
 * Directory (repo-root relative, under the ignored `test-results/`) holding
 * reused Playwright login sessions, one per seed role. Forward slashes on
 * purpose: consumed by both node:fs and Playwright on every OS.
 */
export const PRD_SESSION_DIR = 'test-results/.auth';

export type PrdSessionStamp = {
  password: string;
  /** Backend the session was minted against: same password on another backend must re-login. */
  backend: string;
};

export function prdSessionPaths(role: PrdAccountRole): { state: string; stamp: string } {
  const slug = role.replace('.', '-');
  return {
    state: `${PRD_SESSION_DIR}/${slug}.json`,
    stamp: `${PRD_SESSION_DIR}/${slug}.stamp.json`,
  };
}

/**
 * A saved session is reusable only when stamped with the current password
 * AND backend. Throws on an unknown role so a future fourth account fails
 * fast instead of silently probing the wrong foyer.
 */
export function isSessionStampCurrent(stamp: unknown, expected: PrdSessionStamp): boolean {
  if (typeof stamp !== 'object' || stamp === null) return false;
  const { password, backend } = stamp as { password?: unknown; backend?: unknown };
  return password === expected.password && backend === expected.backend;
}

/** Seeded foyer each role belongs to (single-sourced from PRD_ACCOUNTS). */
export function foyerNameFor(role: PrdAccountRole): string {
  const account = PRD_ACCOUNTS.find((candidate) => candidate.role === role);
  if (!account) throw new Error(`Unknown PRD seed role: ${role}.`);
  return account.foyer === 2 ? PRD_FOYER_2_NAME : PRD_FOYER_1_NAME;
}

export const PRD_SEED_PASSWORD_ENV_VAR = 'E2E_PRD_PASSWORD';

export const PRD_SEED_PASSWORD_MIN_LENGTH = 8;

export type FoyerMembership = {
  household_id: string;
  user_id: string;
  role: string;
};

export type FoyerTopology = {
  foyer1: string;
  foyer2: string;
};

/**
 * Pure check of the PRD §comptes-de-test topology over `household_members`
 * rows: household1.userA (owner) + household1.userB share foyer 1,
 * household2.userA is alone in foyer 2. Throws on any deviation so
 * global-setup fails fast instead of letting cross-foyer leaks poison P0.
 */
export function assertFoyerTopology(
  memberships: readonly FoyerMembership[],
  userIds: Record<PrdAccountRole, string>,
): FoyerTopology {
  const householdsOf = (userId: string): string[] => [
    ...new Set(
      memberships.filter((m) => m.user_id === userId).map((m) => m.household_id),
    ),
  ];
  const foyer1A = householdsOf(userIds['household1.userA']);
  const foyer1B = householdsOf(userIds['household1.userB']);
  const foyer2 = householdsOf(userIds['household2.userA']);
  if (foyer1A.length !== 1 || foyer1B.length !== 1 || foyer2.length !== 1) {
    throw new Error('PRD seed topology requires exactly one household per seed account.');
  }
  const [foyer1] = foyer1A;
  if (foyer1B[0] !== foyer1) {
    throw new Error('PRD seed topology requires household1.userA and household1.userB in the same foyer.');
  }
  if (foyer2[0] === foyer1) {
    throw new Error('PRD seed topology requires household2.userA isolated from foyer 1.');
  }
  const roleOf = (userId: string): string | undefined =>
    memberships.find((m) => m.user_id === userId && m.household_id === foyer1)?.role;
  if (roleOf(userIds['household1.userA']) !== 'owner') {
    throw new Error('PRD seed topology requires household1.userA as foyer 1 owner.');
  }
  return { foyer1, foyer2: foyer2[0] };
}

type Env = Readonly<Record<string, string | undefined>>;

/**
 * Resolve the password for PRD seed accounts: explicit env override first,
 * otherwise a per-run generated value (workers read it from the seed file).
 * Throws on an explicit but too-short override instead of letting Supabase
 * reject it mid-setup with a cryptic error.
 */
export function resolvePrdSeedPassword(env: Env, generate: () => string): string {
  const override = env[PRD_SEED_PASSWORD_ENV_VAR]?.trim();
  if (override) {
    if (override.length < PRD_SEED_PASSWORD_MIN_LENGTH) {
      throw new Error(
        `${PRD_SEED_PASSWORD_ENV_VAR} must be at least ${PRD_SEED_PASSWORD_MIN_LENGTH} characters.`,
      );
    }
    return override;
  }
  return generate();
}
