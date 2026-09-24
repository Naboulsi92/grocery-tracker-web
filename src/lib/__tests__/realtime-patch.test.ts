import type { RealtimePatch } from '@/hooks/useHouseholdRealtime';
import type { Category, InventoryItem, Item } from '@/lib/inventory';
import {
  applyCategoryPatch,
  applyItemPatch,
  applyToBuyPatch,
  clearEmbeddedCategory,
  refreshEmbeddedCategories,
} from '@/lib/realtimePatch';

const fruits: Category = {
  id: 'c1',
  household_id: 'h1',
  name: 'Fruits',
  is_default: false,
  created_at: '2026-01-01T00:00:00Z',
};

const lait: Item = {
  id: 'i1',
  household_id: 'h1',
  category_id: 'c1',
  name: 'Lait',
  quantity: 1,
  unit: 'unite',
  low_stock_threshold: 2,
  already_notified: false,
  template_id: null,
  created_at: '2026-01-01T00:00:00Z',
  updated_at: '2026-09-24T10:00:00Z',
  last_modified_at: null,
  last_modified_by: null,
};

function joined(item: Item = lait): InventoryItem[] {
  return [{ ...item, category: fruits }];
}

function patch(overrides: Partial<RealtimePatch>): RealtimePatch {
  return {
    table: 'items',
    event: 'INSERT',
    newRecord: null,
    oldRecord: null,
    ...overrides,
  };
}

describe('applyItemPatch', () => {
  it('inserts a joined row keeping name sort', () => {
    const pain: Item = { ...lait, id: 'i2', name: 'Abricot', quantity: 5 };
    const next = applyItemPatch(
      joined(),
      [fruits],
      patch({ newRecord: pain as unknown as Record<string, unknown> })
    );
    expect(next.map((item) => item.name)).toEqual(['Abricot', 'Lait']);
    expect(next[0]?.category?.name).toBe('Fruits');
  });

  it('ignores a stale UPDATE echo (LWW on updated_at)', () => {
    const stale: Item = { ...lait, quantity: 99, updated_at: '2026-09-24T09:00:00Z' };
    const next = applyItemPatch(
      joined(),
      [fruits],
      patch({
        event: 'UPDATE',
        newRecord: stale as unknown as Record<string, unknown>,
      })
    );
    expect(next[0]?.quantity).toBe(1);
  });

  it('applies a newer UPDATE echo', () => {
    const fresh: Item = { ...lait, quantity: 7, updated_at: '2026-09-24T11:00:00Z' };
    const next = applyItemPatch(
      joined(),
      [fruits],
      patch({
        event: 'UPDATE',
        newRecord: fresh as unknown as Record<string, unknown>,
      })
    );
    expect(next[0]?.quantity).toBe(7);
  });

  it('deletes by old id and ignores unknown ids', () => {
    const deleted = applyItemPatch(
      joined(),
      [fruits],
      patch({ event: 'DELETE', oldRecord: { id: 'i1' } })
    );
    expect(deleted).toEqual([]);
    const untouched = applyItemPatch(
      joined(),
      [fruits],
      patch({ event: 'DELETE', oldRecord: { id: 'nope' } })
    );
    expect(untouched).toHaveLength(1);
  });

  it('ignores patches for other tables', () => {
    const current = joined();
    expect(applyItemPatch(current, [fruits], patch({ table: 'categories' }))).toBe(current);
  });
});

describe('applyCategoryPatch', () => {
  it('upserts by id and deletes by old id', () => {
    const renamed: Category = { ...fruits, name: 'Légumes' };
    const updated = applyCategoryPatch(
      [fruits],
      patch({
        table: 'categories',
        event: 'UPDATE',
        newRecord: renamed as unknown as Record<string, unknown>,
      })
    );
    expect(updated[0]?.name).toBe('Légumes');

    const removed = applyCategoryPatch(
      updated,
      patch({ table: 'categories', event: 'DELETE', oldRecord: { id: 'c1' } })
    );
    expect(removed).toEqual([]);
  });
});

describe('refreshEmbeddedCategories', () => {
  it('refreshes only rows of the patched category', () => {
    const other: InventoryItem = {
      ...lait,
      id: 'i2',
      category_id: 'c2',
      category: { ...fruits, id: 'c2', name: 'Sec' },
    };
    const next = refreshEmbeddedCategories([...joined(), other], {
      ...fruits,
      name: 'Frais',
    });
    expect(next[0]?.category?.name).toBe('Frais');
    expect(next[1]?.category?.name).toBe('Sec');
  });
});

describe('clearEmbeddedCategory', () => {
  it('drops the ghost category object of a deleted category', () => {
    const next = clearEmbeddedCategory(joined(), 'c1');
    expect(next[0]?.category).toBeUndefined();
    expect(next[0]?.category_id).toBe('c1');
  });
});

describe('applyToBuyPatch', () => {
  it('drops a row that leaves low-stock unless checked', () => {
    const stocked: Item = { ...lait, quantity: 10, updated_at: '2026-09-24T11:00:00Z' };
    const asPatch = patch({
      event: 'UPDATE',
      newRecord: stocked as unknown as Record<string, unknown>,
    });
    expect(applyToBuyPatch(joined(), [fruits], asPatch, () => false)).toEqual([]);
    const kept = applyToBuyPatch(joined(), [fruits], asPatch, (id) => id === 'i1');
    expect(kept[0]?.quantity).toBe(10);
  });

  it('admits a new low-stock row and rejects a stocked one', () => {
    const pain: Item = { ...lait, id: 'i2', name: 'Abricot', quantity: 1 };
    const admitted = applyToBuyPatch(
      joined(),
      [fruits],
      patch({ newRecord: pain as unknown as Record<string, unknown> }),
      () => false
    );
    expect(admitted.map((item) => item.id)).toEqual(['i2', 'i1']);

    const stocked: Item = { ...pain, quantity: 50 };
    const rejected = applyToBuyPatch(
      joined(),
      [fruits],
      patch({ newRecord: stocked as unknown as Record<string, unknown> }),
      () => false
    );
    expect(rejected.map((item) => item.id)).toEqual(['i1']);
  });
});
