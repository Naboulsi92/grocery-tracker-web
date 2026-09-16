import type { Category } from '@/lib/inventory';

export type { Category };

export function hasDuplicateCustomName(
  categories: Category[],
  name: string,
  editingId: string | null,
): boolean {
  const normalized = name.trim().toLowerCase();
  if (!normalized) return false;
  return categories.some(
    (category) =>
      !category.is_default && category.id !== editingId && category.name.toLowerCase() === normalized,
  );
}