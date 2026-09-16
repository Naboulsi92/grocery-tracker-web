import { formatRelativeTime, joinHistoryActors } from '@/lib/history';
import type { Database } from '@/types/database';

type HistoryRow = Database['public']['Tables']['history']['Row'];
type ProfileName = Pick<Database['public']['Tables']['profiles']['Row'], 'id' | 'display_name'>;

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
  it('resolves display names from matching profiles', () => {
    const entries: HistoryRow[] = [{ ...baseHistoryRow, id: 'entry-1', performed_by: 'user-1' }];
    const profiles: ProfileName[] = [{ id: 'user-1', display_name: 'Camille' }];

    expect(joinHistoryActors(entries, profiles)).toEqual([
      { ...entries[0], actorDisplayName: 'Camille' },
    ]);
  });

  it('trims display names', () => {
    const entries: HistoryRow[] = [{ ...baseHistoryRow, id: 'entry-1', performed_by: 'user-1' }];
    const profiles: ProfileName[] = [{ id: 'user-1', display_name: ' Camille ' }];

    expect(joinHistoryActors(entries, profiles)).toEqual([
      { ...entries[0], actorDisplayName: 'Camille' },
    ]);
  });

  it('falls back to "Un membre" when performed_by is null', () => {
    const entries: HistoryRow[] = [{ ...baseHistoryRow, id: 'entry-1', performed_by: null }];

    expect(joinHistoryActors(entries, [])).toEqual([
      { ...entries[0], actorDisplayName: 'Un membre' },
    ]);
  });

  it('falls back to "Un membre" when the profile is missing', () => {
    const entries: HistoryRow[] = [{ ...baseHistoryRow, id: 'entry-1', performed_by: 'user-missing' }];

    expect(joinHistoryActors(entries, [])).toEqual([
      { ...entries[0], actorDisplayName: 'Un membre' },
    ]);
  });
});