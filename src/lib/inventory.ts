import type { Database } from '@/types/database';

export type Category = Database['public']['Tables']['categories']['Row'];
export type Item = Database['public']['Tables']['items']['Row'];
export type Unit = Database['public']['Tables']['units']['Row'];

export type InventoryItem = Item & {
  category?: Category;
  unit?: Unit;
};

export type ItemGroup = {
  category: Category | null;
  items: InventoryItem[];
};

export function joinInventory(items: Item[], categories: Category[], units: Unit[]): InventoryItem[] {
  const categoriesById = new Map(categories.map((category) => [category.id, category]));
  const unitsById = new Map(units.map((unit) => [unit.id, unit]));

  return items.map((item) => ({
    ...item,
    category: item.category_id ? categoriesById.get(item.category_id) : undefined,
    unit: unitsById.get(item.unit_id),
  }));
}

export function groupItems(items: InventoryItem[], categories: Category[]): ItemGroup[] {
  const groups = categories
    .map((category) => ({ category, items: items.filter((item) => item.category_id === category.id) }))
    .filter((group) => group.items.length > 0);
  const uncategorized = items.filter((item) => !item.category_id || !item.category);

  return uncategorized.length > 0 ? [...groups, { category: null, items: uncategorized }] : groups;
}

export function getLowStockItems(items: InventoryItem[]): InventoryItem[] {
  return items.filter((item) => item.quantity <= item.low_stock_threshold);
}

export function getNextCategoryOrder(categories: Category[]): number {
  return Math.max(0, ...categories.map((category) => category.order ?? 0)) + 1;
}

export function getErrorMessage(error: unknown, fallback: string): string {
  if (error instanceof Error && error.message.trim()) return error.message;
  if (typeof error === 'object' && error !== null && 'message' in error) {
    const message = Reflect.get(error, 'message');
    if (typeof message === 'string' && message.trim()) return message;
  }
  return fallback;
}
