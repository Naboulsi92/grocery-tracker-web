import type { Database } from '@/types/database';

export type Category = Database['public']['Tables']['categories']['Row'];
export type Item = Database['public']['Tables']['items']['Row'];

export type InventoryItem = Item & {
  category?: Category;
};

export type ItemGroup = {
  category: Category | null;
  items: InventoryItem[];
};

// Ticket #117 : colonnes explicites partagées (Row complet, pas de '*').
// Inventaire SANS pagination (décision ticket) : listes miroirs de
// database.ts Row — à étendre si une colonne est ajoutée en base.
export const CATEGORY_COLUMNS = 'id, household_id, name, is_default, created_at';

export const ITEM_COLUMNS =
  'id, household_id, category_id, name, quantity, unit, low_stock_threshold, already_notified, template_id, created_at, updated_at, last_modified_at, last_modified_by';

export function joinInventory(items: Item[], categories: Category[]): InventoryItem[] {
  const categoriesById = new Map(categories.map((category) => [category.id, category]));

  return items.map((item) => ({
    ...item,
    category: item.category_id ? categoriesById.get(item.category_id) : undefined,
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

export function getNextCategoryOrder(positions: number[]): number {
  return Math.max(0, ...positions) + 1;
}

export function getErrorMessage(error: unknown, fallback: string): string {
  if (error instanceof Error && error.message.trim()) return error.message;
  if (typeof error === 'object' && error !== null && 'message' in error) {
    const message = Reflect.get(error, 'message');
    if (typeof message === 'string' && message.trim()) return message;
  }
  return fallback;
}
