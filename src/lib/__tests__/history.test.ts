import { fetchHouseholdHistory, logItemHistory } from '@/lib/history';

// ─── logItemHistory — 0 warning history_insert_failed sur succès ─────────────
// PRD v1.4 §4.7 : INSERT history autorisé aux membres de leur foyer (policy
// history_insert_member + grants §3 de la migration #108). Le client ne warn
// que si Supabase refuse l'INSERT ; 0 warning en e2e = RLS + grants OK.

type InsertPayload = {
  household_id: string;
  performed_by: string | null;
  action_type: string;
  item_name: string;
};

function makeInsertClient(options: {
  userId?: string | null;
  error?: { code?: string; message?: string } | null;
  onInsert?: (payload: InsertPayload) => void;
}) {
  const { userId = 'user-1', error = null, onInsert } = options;
  return {
    auth: {
      getUser: async () => ({ data: { user: userId ? { id: userId } : null } }),
    },
    from: (table: string) => {
      if (table !== 'history') throw new Error(`unexpected table ${table}`);
      return {
        insert: async (payload: InsertPayload) => {
          onInsert?.(payload);
          return { error };
        },
      };
    },
  } as never;
}

describe('logItemHistory — history_insert_failed', () => {
  let warnSpy: jest.SpyInstance;

  beforeEach(() => {
    warnSpy = jest.spyOn(console, 'warn').mockImplementation(() => undefined);
  });

  afterEach(() => {
    warnSpy.mockRestore();
  });

  it('inserts with household, actor, action and item name without warning on success', async () => {
    let seen: InsertPayload | undefined;
    const supabase = makeInsertClient({ onInsert: (payload) => { seen = payload; } });

    await logItemHistory('home-1', 'modification', 'Lait', supabase);

    expect(seen).toEqual({
      household_id: 'home-1',
      performed_by: 'user-1',
      action_type: 'modification',
      item_name: 'Lait',
    });
    expect(warnSpy).not.toHaveBeenCalledWith(
      'history_insert_failed',
      expect.anything(),
    );
  });

  it('falls back to performed_by null when no user is signed in', async () => {
    let seen: InsertPayload | undefined;
    const supabase = makeInsertClient({
      userId: null,
      onInsert: (payload) => { seen = payload; },
    });

    await logItemHistory('home-1', 'suppression', 'Pain', supabase);

    expect(seen).toMatchObject({ performed_by: null, action_type: 'suppression' });
    expect(warnSpy).not.toHaveBeenCalledWith(
      'history_insert_failed',
      expect.anything(),
    );
  });

  it('warns history_insert_failed with the Supabase code on RLS denial (42501)', async () => {
    const supabase = makeInsertClient({
      error: { code: '42501', message: 'permission denied for table history' },
    });

    await logItemHistory('home-1', 'modification', 'Lait', supabase);

    expect(warnSpy).toHaveBeenCalledWith('history_insert_failed', {
      area: 'history',
      code: '42501',
    });
  });

  it('warns with code unknown when Supabase returns an error without code', async () => {
    const supabase = makeInsertClient({ error: { message: 'boom' } });

    await logItemHistory('home-1', 'modification', 'Lait', supabase);

    expect(warnSpy).toHaveBeenCalledWith('history_insert_failed', {
      area: 'history',
      code: 'unknown',
    });
  });
});

// ─── fetchHouseholdHistory — contrat limit 20 / ordre desc ───────────────────
// PRD v1.4 §4.7 : 20 dernières modifs/suppressions uniquement. Le trigger
// AFTER INSERT (ADR 0005, migration #108 §1) garantit ≤20 lignes ; la lecture
// verrouille l'affichage : filtre foyer + tri performed_at desc + limit 20.

type HistoryRow = {
  id: string;
  household_id: string;
  action_type: 'modification' | 'suppression';
  item_name: string;
  performed_at: string;
  performed_by: string | null;
};

const row = (id: string, performedBy: string | null = 'user-1'): HistoryRow => ({
  id,
  household_id: 'home-1',
  action_type: 'modification',
  item_name: id,
  performed_at: `2026-09-15T12:00:${id.slice(-2)}Z`,
  performed_by: performedBy,
});

function makeFetchClient(options: {
  historyRows?: HistoryRow[] | null;
  historyError?: { message: string } | null;
  profileRows?: { id: string; first_name: string | null; last_name: string | null }[];
  profileError?: { message: string } | null;
  calls?: Record<string, unknown>;
}) {
  const {
    historyRows = [],
    historyError = null,
    profileRows = [],
    profileError = null,
    calls = {},
  } = options;
  return {
    client: {
      from: (table: string) => {
        if (table === 'history') {
          return {
            select: (cols: string) => {
              calls.historySelect = cols;
              return {
                eq: (col: string, value: string) => {
                  calls.historyEq = [col, value];
                  return {
                    order: (col2: string, opts: { ascending: boolean }) => {
                      calls.historyOrder = [col2, opts];
                      return {
                        limit: async (n: number) => {
                          calls.historyLimit = n;
                          return { data: historyRows, error: historyError };
                        },
                      };
                    },
                  };
                },
              };
            },
          };
        }
        if (table === 'profiles') {
          return {
            select: (cols: string) => {
              calls.profilesSelect = cols;
              return {
                in: async (col: string, ids: string[]) => {
                  calls.profilesIn = [col, ids];
                  return { data: profileRows, error: profileError };
                },
              };
            },
          };
        }
        throw new Error(`unexpected table ${table}`);
      },
    } as never,
    calls,
  };
}

describe('fetchHouseholdHistory — cap 20 côté lecture', () => {
  it('queries one household ordered by performed_at desc limited to 20', async () => {
    const { client, calls } = makeFetchClient({ historyRows: [] });

    await fetchHouseholdHistory('home-1', client);

    expect(calls.historyEq).toEqual(['household_id', 'home-1']);
    expect(calls.historyOrder).toEqual(['performed_at', { ascending: false }]);
    expect(calls.historyLimit).toBe(20);
    expect(calls.historySelect).toContain('performed_at');
    expect(calls.historySelect).toContain('performed_by');
  });

  it('resolves actor names from matching profiles', async () => {
    const { client } = makeFetchClient({
      historyRows: [row('entry-01', 'user-1')],
      profileRows: [{ id: 'user-1', first_name: 'Camille', last_name: null }],
    });

    const entries = await fetchHouseholdHistory('home-1', client);

    expect(entries).toEqual([expect.objectContaining({ id: 'entry-01', actorName: 'Camille' })]);
  });

  it('skips the profiles query when no entry has an actor', async () => {
    const { client, calls } = makeFetchClient({ historyRows: [row('entry-01', null)] });

    const entries = await fetchHouseholdHistory('home-1', client);

    expect(calls.profilesIn).toBeUndefined();
    expect(entries).toEqual([expect.objectContaining({ actorName: 'Un membre' })]);
  });

  it('propagates history read errors to the caller', async () => {
    const { client } = makeFetchClient({
      historyRows: null,
      historyError: { message: 'denied' },
    });

    await expect(fetchHouseholdHistory('home-1', client)).rejects.toEqual({ message: 'denied' });
  });
});

// ─── Rotation 21e → 20 — miroir JS du trigger AFTER INSERT ───────────────────
// Réf DB (ne pas toucher ici) : migration #108 §1 cap_history() +
// history_cap_trigger AFTER INSERT (fix LIMIT 19 → 20 + tiebreak id desc,
// ADR 0005). Le modèle ci-dessous verrouille le contrat testé en P1-10 :
// la 21e action supprime la plus ancienne du foyer, jamais une des 20 plus
// récentes ; ordre déterministe même à performed_at égal (rafales).

type DatedEntry = { id: string; performed_at: string };

function keepNewest20(entries: DatedEntry[]): DatedEntry[] {
  return [...entries]
    .sort((a, b) =>
      b.performed_at === a.performed_at
        ? b.id.localeCompare(a.id)
        : +new Date(b.performed_at) - +new Date(a.performed_at),
    )
    .slice(0, 20);
}

const dated = (index: number): DatedEntry => ({
  id: `entry-${String(index).padStart(2, '0')}`,
  performed_at: `2026-09-15T12:${String(index).padStart(2, '0')}:00Z`,
});

describe('history rotation 21st → 20 (trigger AFTER INSERT contract)', () => {
  it('evicts only the oldest entry when a 21st action lands', () => {
    const before = Array.from({ length: 20 }, (_, i) => dated(i + 1));
    const after = keepNewest20([...before, dated(21)]);

    expect(after).toHaveLength(20);
    expect(after.map(({ id }) => id)).not.toContain('entry-01');
    expect(after.map(({ id }) => id)).toContain('entry-21');
    expect(after.map(({ id }) => id)).toContain('entry-02');
  });

  it('keeps all 20 entries when at most 20 exist', () => {
    const entries = Array.from({ length: 20 }, (_, i) => dated(i + 1));

    expect(keepNewest20(entries)).toHaveLength(20);
  });

  it('orders deterministically by id desc when performed_at ties (burst inserts)', () => {
    const tied: DatedEntry[] = [
      { id: 'entry-b', performed_at: '2026-09-15T12:00:00Z' },
      { id: 'entry-a', performed_at: '2026-09-15T12:00:00Z' },
      { id: 'entry-c', performed_at: '2026-09-15T12:00:00Z' },
    ];

    expect(keepNewest20(tied).map(({ id }) => id)).toEqual(['entry-c', 'entry-b', 'entry-a']);
  });

  it('stays capped at 20 under concurrent double-insert (21 + 22)', () => {
    const base = Array.from({ length: 20 }, (_, i) => dated(i + 1));
    const after = keepNewest20([...base, dated(21), dated(22)]);

    expect(after).toHaveLength(20);
    expect(after.map(({ id }) => id)).toContain('entry-22');
    expect(after.map(({ id }) => id)).not.toContain('entry-01');
    expect(after.map(({ id }) => id)).not.toContain('entry-02');
  });
});
