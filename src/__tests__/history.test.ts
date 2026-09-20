import { formatRelativeTime, joinHistoryActors } from '@/lib/history';
import type { Database } from '@/types/database';

type HistoryRow = Database['public']['Tables']['history']['Row'];
type ProfileName = Pick<Database['public']['Tables']['profiles']['Row'], 'id' | 'first_name' | 'last_name'>;

const baseHistoryRow: HistoryRow = {
  id: 'history-1',
  household_id: 'home-1',
  performed_by: null,
  action_type: 'modification',
  item_name: 'Lait',
  performed_at: '2026-09-15T12:00:00Z',
};

describe('formatRelativeTime', () => {
  const NOW = new Date('2026-09-15T12:05:00Z');

  it('returns "à l\'instant" under one minute', () => {
    expect(formatRelativeTime('2026-09-15T12:04:30Z', 'fr', NOW)).toBe("à l'instant");
  });

  it('returns minutes for up to one hour', () => {
    expect(formatRelativeTime('2026-09-15T11:30:00Z', 'fr', NOW)).toBe('il y a 35 min');
  });

  it('returns hours for up to one day', () => {
    expect(formatRelativeTime('2026-09-15T08:05:00Z', 'fr', NOW)).toBe('il y a 4 h');
  });

  it('returns "hier" for one day ago', () => {
    expect(formatRelativeTime('2026-09-14T12:05:00Z', 'fr', NOW)).toBe('hier');
  });

  it('returns days beyond one day', () => {
    expect(formatRelativeTime('2026-09-13T12:05:00Z', 'fr', NOW)).toBe('il y a 2 j');
  });

  it('treats future timestamps as "à l\'instant"', () => {
    expect(formatRelativeTime('2026-09-15T12:06:00Z', 'fr', NOW)).toBe("à l'instant");
  });
});

describe('joinHistoryActors', () => {
  it('resolves actor names from matching profiles', () => {
    const entries: HistoryRow[] = [{ ...baseHistoryRow, id: 'entry-1', performed_by: 'user-1' }];
    const profiles: ProfileName[] = [{ id: 'user-1', first_name: 'Camille', last_name: '' }];

    expect(joinHistoryActors(entries, profiles)).toEqual([
      { ...entries[0], actorName: 'Camille' },
    ]);
  });

  it('combines and trims first and last name', () => {
    const entries: HistoryRow[] = [{ ...baseHistoryRow, id: 'entry-1', performed_by: 'user-1' }];
    const profiles: ProfileName[] = [{ id: 'user-1', first_name: ' Camille ', last_name: ' Lemaire ' }];

    expect(joinHistoryActors(entries, profiles)).toEqual([
      { ...entries[0], actorName: 'Camille Lemaire' },
    ]);
  });

  it('falls back to "Un membre" when performed_by is null', () => {
    const entries: HistoryRow[] = [{ ...baseHistoryRow, id: 'entry-1', performed_by: null }];

    expect(joinHistoryActors(entries, [])).toEqual([
      { ...entries[0], actorName: 'Un membre' },
    ]);
  });

  it('falls back to "Un membre" when the profile is missing', () => {
    const entries: HistoryRow[] = [{ ...baseHistoryRow, id: 'entry-1', performed_by: 'user-missing' }];

    expect(joinHistoryActors(entries, [])).toEqual([
      { ...entries[0], actorName: 'Un membre' },
    ]);
  });
});

describe('history rotation display — 20 dernières uniquement (PRD §4.7 / ADR 0005)', () => {
  type DatedEntry = { id: string; performed_at: string };

  const dated = (index: number): DatedEntry => ({
    id: `entry-${String(index).padStart(2, '0')}`,
    performed_at: `2026-09-15T12:${String(index).padStart(2, '0')}:00Z`,
  });

  const keepNewest20 = (entries: DatedEntry[]): DatedEntry[] =>
    [...entries]
      .sort((a, b) =>
        b.performed_at === a.performed_at
          ? b.id.localeCompare(a.id)
          : +new Date(b.performed_at) - +new Date(a.performed_at),
      )
      .slice(0, 20);

  it('shows at most 20 entries even after a 21st action (P1-10)', () => {
    const entries = Array.from({ length: 21 }, (_, i) => dated(i + 1));

    const visible = keepNewest20(entries);

    expect(visible).toHaveLength(20);
    expect(visible.map(({ id }) => id)).not.toContain('entry-01');
    expect(visible.map(({ id }) => id)).toContain('entry-21');
  });

  it('keeps display order newest-first (performed_at desc)', () => {
    const entries = [dated(3), dated(1), dated(2)];

    expect(keepNewest20(entries).map(({ id }) => id)).toEqual(['entry-03', 'entry-02', 'entry-01']);
  });

  it('joins actor names on the capped 20 without losing entries', () => {
    const entries: HistoryRow[] = Array.from({ length: 21 }, (_, i) => ({
      ...baseHistoryRow,
      id: `entry-${String(i + 1).padStart(2, '0')}`,
      performed_by: 'user-1',
    }));
    const profiles: ProfileName[] = [{ id: 'user-1', first_name: 'Camille', last_name: '' }];

    const capped = entries.slice(-20);
    const joined = joinHistoryActors(capped, profiles);

    expect(joined).toHaveLength(20);
    expect(joined[0]).toMatchObject({ actorName: 'Camille' });
    expect(joined.map(({ id }) => id)).not.toContain('entry-01');
  });
});