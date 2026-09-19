import { hasDuplicateCustomName, type Category } from '@/lib/categories';

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