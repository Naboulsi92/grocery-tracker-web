import {
  PRD_ACCOUNTS,
  PRD_FOYER_1_NAME,
  PRD_FOYER_2_NAME,
  PRD_SEED_STATE_FILENAME,
  assertFoyerTopology,
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
