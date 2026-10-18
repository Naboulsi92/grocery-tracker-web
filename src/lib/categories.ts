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

/**
 * Upsert-by-id shared by the realtime patch and the page's optimistic
 * append (ticket #243): when the Create echo lands through the realtime
 * channel before the POST response resolves, the local append must replace
 * the already-present row instead of pushing the same id a second time.
 */
export function upsertCategoryById(current: Category[], row: Category): Category[] {
  return current.some((category) => category.id === row.id)
    ? current.map((category) => (category.id === row.id ? row : category))
    : [...current, row];
}