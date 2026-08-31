import {
  getErrorMessage,
  getLowStockItems,
  getNextCategoryOrder,
  groupItems,
  joinInventory,
  type Category,
  type Item,
  type Unit,
} from '@/lib/inventory';

const category = (id: string, order: number | null = 1): Category => ({
  id,
  name: id,
  icon: null,
  order,
  household_id: 'home-1',
  created_at: null,
});

const unit: Unit = { id: 'unit-1', name: 'unité', abbrev: 'u' };
const item = (id: string, categoryId: string | null, quantity = 1, threshold = 1): Item => ({
  id,
  name: id,
  category_id: categoryId,
  quantity,
  low_stock_threshold: threshold,
  unit_id: unit.id,
  household_id: 'home-1',
  created_at: null,
  last_modified_at: null,
  last_modified_by: null,
});

describe('inventory helpers', () => {
  it('joins and groups known and orphaned items without losing any', () => {
    const categories = [category('fruit'), category('empty', 2)];
    const inventory = joinInventory(
      [item('apple', 'fruit'), item('mystery', 'removed'), item('bread', null)],
      categories,
      [unit],
    );

    expect(groupItems(inventory, categories)).toEqual([
      { category: categories[0], items: [expect.objectContaining({ id: 'apple', unit })] },
      { category: null, items: [expect.objectContaining({ id: 'mystery' }), expect.objectContaining({ id: 'bread' })] },
    ]);
  });

  it('includes quantities equal to the low-stock threshold', () => {
    const inventory = joinInventory(
      [item('empty', null, 0, 1), item('limit', null, 2, 2), item('stocked', null, 3, 2)],
      [],
      [unit],
    );

    expect(getLowStockItems(inventory).map(({ id }) => id)).toEqual(['empty', 'limit']);
  });

  it('calculates order with nullable values and empty lists', () => {
    expect(getNextCategoryOrder([])).toBe(1);
    expect(getNextCategoryOrder([category('first', null), category('third', 3)])).toBe(4);
  });

  it('normalizes unknown errors', () => {
    expect(getErrorMessage(new Error('offline'), 'fallback')).toBe('offline');
    expect(getErrorMessage({ message: 'denied' }, 'fallback')).toBe('denied');
    expect(getErrorMessage('failure', 'fallback')).toBe('fallback');
  });
});
