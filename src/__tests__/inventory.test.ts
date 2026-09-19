import {
  getErrorMessage,
  getLowStockItems,
  getNextCategoryOrder,
  groupItems,
  joinInventory,
  type Category,
  type Item,
} from '@/lib/inventory';

const category = (id: string): Category => ({
  id,
  name: id,
  is_default: false,
  household_id: 'home-1',
  created_at: null,
});

const item = (id: string, categoryId: string | null, quantity = 1, threshold = 1, unit = 'unite'): Item => ({
  id,
  name: id,
  category_id: categoryId,
  quantity,
  low_stock_threshold: threshold,
  unit,
  household_id: 'home-1',
  created_at: null,
  last_modified_at: null,
  last_modified_by: null,
  template_id: null,
  already_notified: false,
  updated_at: null,
});

describe('inventory helpers', () => {
  it('joins and groups known and orphaned items without losing any', () => {
    const categories = [category('fruit'), category('empty')];
    const inventory = joinInventory(
      [item('apple', 'fruit'), item('mystery', 'removed'), item('bread', null)],
      categories,
    );

    expect(groupItems(inventory, categories)).toEqual([
      { category: categories[0], items: [expect.objectContaining({ id: 'apple' })] },
      { category: null, items: [expect.objectContaining({ id: 'mystery' }), expect.objectContaining({ id: 'bread' })] },
    ]);
  });

  it('includes quantities equal to the low-stock threshold', () => {
    const inventory = joinInventory(
      [item('empty', null, 0, 1), item('limit', null, 2, 2), item('stocked', null, 3, 2)],
      [],
    );

    expect(getLowStockItems(inventory).map(({ id }) => id)).toEqual(['empty', 'limit']);
  });

  it('calculates next position from numeric values', () => {
    expect(getNextCategoryOrder([])).toBe(1);
    expect(getNextCategoryOrder([1, 3])).toBe(4);
  });

  it('normalizes unknown errors', () => {
    expect(getErrorMessage(new Error('offline'), 'fallback')).toBe('offline');
    expect(getErrorMessage({ message: 'denied' }, 'fallback')).toBe('denied');
    expect(getErrorMessage('failure', 'fallback')).toBe('fallback');
  });
});
