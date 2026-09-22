import {
  PRD_ACCOUNTS,
  PRD_FOYER_1_NAME,
  PRD_FOYER_2_NAME,
  PRD_SEED_STATE_FILENAME,
  assertFoyerTopology,
  foyerNameFor,
  isSessionStampCurrent,
  prdSessionPaths,
  resolvePrdSeedPassword,
  type FoyerMembership,
} from '../prd-accounts';

describe('prd-accounts', () => {
  it('declares exactly the three PRD v1.4 §comptes-de-test addresses', () => {
    expect(PRD_ACCOUNTS.map((account) => account.email)).toEqual([
      'e2e.household1.userA@e2e.grocerylist.test',
      'e2e.household1.userB@e2e.grocerylist.test',
      'e2e.household2.userA@e2e.grocerylist.test',
    ]);
  });

  it('covers sync (same foyer) and isolation (separate foyer) roles', () => {
    expect(PRD_ACCOUNTS.filter((account) => account.foyer === 1)).toHaveLength(2);
    expect(PRD_ACCOUNTS.filter((account) => account.foyer === 2)).toHaveLength(1);
  });

  it('exposes the seed-state filename under the ignored test-results dir', () => {
    expect(PRD_SEED_STATE_FILENAME).toBe('test-results/prd-seed.json');
  });

  it('prefers an explicit password override from the environment', () => {
    expect(
      resolvePrdSeedPassword({ E2E_PRD_PASSWORD: 'override-1' }, () => 'generated'),
    ).toBe('override-1');
  });

  it('generates a per-run password when no override is set', () => {
    expect(resolvePrdSeedPassword({}, () => 'generated')).toBe('generated');
  });

  it('rejects an explicit override that Supabase would refuse', () => {
    expect(() => resolvePrdSeedPassword({ E2E_PRD_PASSWORD: 'short' }, () => 'generated')).toThrow(
      'E2E_PRD_PASSWORD must be at least 8 characters.',
    );
  });

  it('names two distinct deterministic foyers', () => {
    expect(PRD_FOYER_1_NAME).toBe('Foyer test 1');
    expect(PRD_FOYER_2_NAME).toBe('Foyer test 2');
  });

  it('maps each role to its seeded foyer', () => {
    expect(foyerNameFor('household1.userA')).toBe(PRD_FOYER_1_NAME);
    expect(foyerNameFor('household1.userB')).toBe(PRD_FOYER_1_NAME);
    expect(foyerNameFor('household2.userA')).toBe(PRD_FOYER_2_NAME);
  });

  it('rejects an unknown role instead of probing the wrong foyer', () => {
    expect(() => foyerNameFor('household3.userA' as never)).toThrow('Unknown PRD seed role');
  });
});

describe('prd session reuse', () => {
  it('derives one state + stamp file per role under the ignored dir', () => {
    expect(prdSessionPaths('household1.userA')).toEqual({
      state: 'test-results/.auth/household1-userA.json',
      stamp: 'test-results/.auth/household1-userA.stamp.json',
    });
    expect(prdSessionPaths('household2.userA').state).toBe(
      'test-results/.auth/household2-userA.json',
    );
  });

  it('accepts a stamp carrying the current password and backend', () => {
    expect(
      isSessionStampCurrent(
        { password: 'run-secret', backend: 'http://127.0.0.1:54321' },
        { password: 'run-secret', backend: 'http://127.0.0.1:54321' },
      ),
    ).toBe(true);
  });

  it('rejects a stale, foreign-backend, malformed, or missing stamp', () => {
    const current = { password: 'run-secret', backend: 'http://127.0.0.1:54321' };
    expect(isSessionStampCurrent({ password: 'old-secret', backend: current.backend }, current)).toBe(
      false,
    );
    expect(
      isSessionStampCurrent({ password: 'run-secret', backend: 'http://other:54321' }, current),
    ).toBe(false);
    expect(isSessionStampCurrent({ password: 'run-secret' }, current)).toBe(false);
    expect(isSessionStampCurrent({ password: 42, backend: current.backend }, current)).toBe(false);
    expect(isSessionStampCurrent(null, current)).toBe(false);
    expect(isSessionStampCurrent('run-secret', current)).toBe(false);
    expect(isSessionStampCurrent(undefined, current)).toBe(false);
  });
});

describe('assertFoyerTopology', () => {
  const userIds = {
    'household1.userA': 'user-a',
    'household1.userB': 'user-b',
    'household2.userA': 'user-c',
  };
  const nominal: FoyerMembership[] = [
    { household_id: 'foyer-1', user_id: 'user-a', role: 'owner' },
    { household_id: 'foyer-1', user_id: 'user-b', role: 'member' },
    { household_id: 'foyer-2', user_id: 'user-c', role: 'owner' },
  ];

  it('accepts the PRD shared-plus-isolated topology', () => {
    expect(assertFoyerTopology(nominal, userIds)).toEqual({ foyer1: 'foyer-1', foyer2: 'foyer-2' });
  });

  it('rejects userB outside foyer 1', () => {
    const rows = nominal.map((row) =>
      row.user_id === 'user-b' ? { ...row, household_id: 'foyer-2' } : row,
    );
    expect(() => assertFoyerTopology(rows, userIds)).toThrow(
      'household1.userA and household1.userB in the same foyer',
    );
  });

  it('rejects a cross-foyer leak of the isolated account', () => {
    const rows: FoyerMembership[] = [
      ...nominal.filter((row) => row.user_id !== 'user-c'),
      { household_id: 'foyer-1', user_id: 'user-c', role: 'member' },
    ];
    expect(() => assertFoyerTopology(rows, userIds)).toThrow('isolated from foyer 1');
  });

  it('rejects a missing membership', () => {
    expect(() => assertFoyerTopology(nominal.slice(0, 2), userIds)).toThrow(
      'exactly one household per seed account',
    );
  });

  it('rejects userA without the owner role', () => {
    const rows = nominal.map((row) =>
      row.user_id === 'user-a' ? { ...row, role: 'member' } : row,
    );
    expect(() => assertFoyerTopology(rows, userIds)).toThrow('as foyer 1 owner');
  });
});
