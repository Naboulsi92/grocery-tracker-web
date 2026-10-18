import { hasDuplicateCustomName, upsertCategoryById, type Category } from '@/lib/categories';

const category = (id: string, name: string, isDefault = false): Category => ({
  id,
  name,
  is_default: isDefault,
  household_id: 'home-1',
  created_at: null,
});

describe('hasDuplicateCustomName', () => {
  it('returns false on empty or blank names', () => {
    const categories = [category('c1', 'Épicerie')];
    expect(hasDuplicateCustomName(categories, '', null)).toBe(false);
    expect(hasDuplicateCustomName(categories, '   ', null)).toBe(false);
  });

  it('matches an existing custom category case-insensitively', () => {
    const categories = [category('c1', 'Épicerie'), category('d1', 'Légumes', true)];
    expect(hasDuplicateCustomName(categories, 'épicerie', null)).toBe(true);
    expect(hasDuplicateCustomName(categories, 'ÉPICERIE', null)).toBe(true);
    expect(hasDuplicateCustomName(categories, 'ÉPICERIE ', null)).toBe(true);
    expect(hasDuplicateCustomName(categories, 'Légumes', null)).toBe(false);
  });

  it('ignores default categories when checking duplicates', () => {
    const categories = [category('d1', 'Légumes', true)];
    expect(hasDuplicateCustomName(categories, 'légumes', null)).toBe(false);
  });

  it('ignores the category currently being edited', () => {
    const categories = [category('c1', 'Épicerie')];
    expect(hasDuplicateCustomName(categories, 'épicerie', 'c1')).toBe(false);
    expect(hasDuplicateCustomName(categories, 'épicerie', 'other-id')).toBe(true);
  });
});

describe('upsertCategoryById', () => {
  it('appends when the id is absent', () => {
    const row = category('c-rt', 'Catégorie rt');
    const next = upsertCategoryById([], row);
    expect(next).toEqual([row]);
  });

  it('replaces instead of duplicating an already-present id', () => {
    const row = category('c-rt', 'Catégorie rt');
    const current = [category('c1', 'Fruits', true), row];
    const next = upsertCategoryById(current, { ...row, name: 'Catégorie rt renommée' });
    expect(next).toHaveLength(2);
    expect(next.filter((entry) => entry.id === 'c-rt')).toEqual([
      { ...row, name: 'Catégorie rt renommée' },
    ]);
  });

  it('keeps a single row when the realtime echo lands before the POST response (ticket #243)', () => {
    const row = category('c-rt', 'Catégorie rt');
    // 1) the channel echo arrives first: the id is absent, the upsert appends.
    const afterEcho = upsertCategoryById([], row);
    // 2) the POST continuation appends afterwards: same id, must NOT push twice.
    const afterOptimisticAppend = upsertCategoryById(afterEcho, row);
    expect(afterEcho).toHaveLength(1);
    expect(afterOptimisticAppend).toHaveLength(1);
  });
});