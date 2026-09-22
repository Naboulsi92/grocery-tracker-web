import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '@/types/database';
import {
  ACCOUNT_EXPORT_VERSION,
  accountExportFilename,
  buildAccountExport,
  downloadAccountExport,
} from '@/lib/account-export';

interface StubResult {
  data?: unknown;
  error?: { message?: string; code?: string } | null;
}

// File d'attente : un résultat par appel terminal, dans l'ordre d'appel
// (maybeSingle ou await direct sur la chaîne).
function createExportFakeSupabase(queue: StubResult[]): SupabaseClient<Database> {
  const calls: { table: string; terminal: string }[] = [];
  const chain: Record<string, unknown> = {};
  const terminal = (name: string) => {
    const result = queue[calls.length] ?? { data: null, error: null };
    calls.push({ table: currentTable, terminal: name });
    return Promise.resolve({ data: result.data ?? null, error: result.error ?? null });
  };
  let currentTable = '';
  chain.select = () => chain;
  chain.eq = () => chain;
  chain.in = () => chain;
  chain.order = () => chain;
  chain.limit = () => chain;
  chain.maybeSingle = () => terminal('maybeSingle');
  chain.then = (resolve: (value: unknown) => unknown) => terminal('await').then(resolve);
  const fake = {
    from: (table: string) => {
      currentTable = table;
      return chain;
    },
    __calls: calls,
  };
  return fake as unknown as SupabaseClient<Database>;
}

const PROFILE = {
  id: 'user-1',
  first_name: 'Alex',
  last_name: 'Dupont',
  language: 'fr',
  notification_type: 'push',
  reminder_time: '08:00',
  deleted_at: null,
  created_at: '2026-01-01T00:00:00.000Z',
};

const MEMBERSHIP = { household_id: 'household-1', user_id: 'user-1', role: 'owner', joined_at: '2026-01-02T00:00:00.000Z' };

describe('buildAccountExport', () => {
  it('exports profile + household with members, categories, items and history', async () => {
    const supabase = createExportFakeSupabase([
      { data: PROFILE },
      { data: MEMBERSHIP },
      { data: { id: 'household-1', name: 'Foyer' } },
      { data: [MEMBERSHIP, { household_id: 'household-1', user_id: 'user-2', role: 'member', joined_at: '2026-01-03T00:00:00.000Z' }] },
      { data: [{ id: 'cat-1', name: 'Fruits', is_default: false, created_at: null }] },
      { data: [{ id: 'item-1', category_id: 'cat-1', name: 'Pommes', quantity: 4, unit: 'unite', low_stock_threshold: 2, created_at: null }] },
      { data: [{ id: 'h-1', action_type: 'modification', item_name: 'Pommes', performed_by: 'user-1', performed_at: '2026-02-01T00:00:00.000Z' }] },
      { data: [{ id: 'user-1', first_name: 'Alex', last_name: 'Dupont' }, { id: 'user-2', first_name: 'Camille', last_name: null }] },
    ]);

    const { data, error } = await buildAccountExport(supabase, 'user-1');

    expect(error).toBeNull();
    expect(data?.version).toBe(ACCOUNT_EXPORT_VERSION);
    expect(Date.parse(data?.exported_at ?? '')).not.toBeNaN();
    expect(data?.profile).toEqual(PROFILE);
    expect(data?.household?.name).toBe('Foyer');
    expect(data?.household?.membership).toEqual({ role: 'owner', joined_at: '2026-01-02T00:00:00.000Z' });
    expect(data?.household?.members).toEqual([
      { user_id: 'user-1', role: 'owner', joined_at: '2026-01-02T00:00:00.000Z', first_name: 'Alex', last_name: 'Dupont' },
      { user_id: 'user-2', role: 'member', joined_at: '2026-01-03T00:00:00.000Z', first_name: 'Camille', last_name: null },
    ]);
    expect(data?.household?.categories).toHaveLength(1);
    expect(data?.household?.items).toHaveLength(1);
    expect(data?.household?.history).toHaveLength(1);
  });

  it('exports profile only when houseless (grace period after leave)', async () => {
    const supabase = createExportFakeSupabase([{ data: { ...PROFILE, deleted_at: '2026-09-20T00:00:00.000Z' } }, { data: null }]);

    const { data, error } = await buildAccountExport(supabase, 'user-1');

    expect(error).toBeNull();
    expect(data?.profile?.deleted_at).toBe('2026-09-20T00:00:00.000Z');
    expect(data?.household).toBeNull();
  });

  it('maps a profile load failure to export_failed', async () => {
    const supabase = createExportFakeSupabase([{ data: null, error: { message: 'boom', code: '500' } }]);

    const { data, error } = await buildAccountExport(supabase, 'user-1');

    expect(data).toBeNull();
    expect(error).toBe('errors.account.export_failed');
  });

  it('maps a household load failure to export_failed', async () => {
    const supabase = createExportFakeSupabase([
      { data: PROFILE },
      { data: MEMBERSHIP },
      { data: null, error: { message: 'rls', code: '42501' } },
      { data: [] },
      { data: [] },
      { data: [] },
      { data: [] },
    ]);

    const { data, error } = await buildAccountExport(supabase, 'user-1');

    expect(data).toBeNull();
    expect(error).toBe('errors.account.export_failed');
  });
});

describe('accountExportFilename', () => {
  it('builds a timestamped json filename', () => {
    expect(accountExportFilename(new Date('2026-09-22T10:30:00.000Z'))).toBe('grocery-list-export-20260922-1030.json');
  });
});

describe('downloadAccountExport', () => {
  it('triggers a download of the JSON blob', () => {
    let captured: unknown;
    const createObjectURL = jest.fn((blob: unknown) => {
      captured = blob;
      return 'blob:fake';
    });
    const revokeObjectURL = jest.fn();
    Object.defineProperty(URL, 'createObjectURL', { value: createObjectURL, configurable: true });
    Object.defineProperty(URL, 'revokeObjectURL', { value: revokeObjectURL, configurable: true });
    const click = jest.spyOn(window.HTMLAnchorElement.prototype, 'click').mockImplementation(() => {});

    downloadAccountExport({
      exported_at: '2026-09-22T10:30:00.000Z',
      version: 1,
      profile: PROFILE,
      household: null,
    });

    expect(createObjectURL).toHaveBeenCalledTimes(1);
    expect((captured as Blob).type).toBe('application/json');
    expect(click).toHaveBeenCalledTimes(1);
    expect(revokeObjectURL).toHaveBeenCalledWith('blob:fake');
    click.mockRestore();
  });
});
