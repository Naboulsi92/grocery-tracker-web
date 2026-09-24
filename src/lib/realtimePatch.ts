import type { RealtimePatch } from '@/hooks/useHouseholdRealtime';
import {
  getLowStockItems,
  joinInventory,
  type Category,
  type InventoryItem,
  type Item,
} from './inventory';

function asItem(record: Record<string, unknown> | null): Item | null {
  if (!record || typeof record.id !== 'string') return null;
  return record as unknown as Item;
}

function asCategory(record: Record<string, unknown> | null): Category | null {
  if (!record || typeof record.id !== 'string') return null;
  return record as unknown as Category;
}

function patchId(patch: RealtimePatch): string | null {
  const id = patch.oldRecord?.id ?? patch.newRecord?.id;
  return typeof id === 'string' ? id : null;
}

/**
 * LWW guard (PRD §4.12): a patch carrying an older `updated_at` than the row
 * already displayed is a stale echo — ignore it. Missing timestamps (or a
 * missing local row) always apply: arrival order wins.
 */
function isNewerItem(row: Item, existing: InventoryItem): boolean {
  if (!row.updated_at || !existing.updated_at) return true;
  return row.updated_at >= existing.updated_at;
}

function byName(a: { name: string }, b: { name: string }): number {
  return a.name.localeCompare(b.name);
}

/**
 * Applies an items-table patch to a joined inventory list (ticket #123).
 * Upsert-by-id keeps local echoes idempotent: the originator's own write
 * arrives back as INSERT/UPDATE and replaces the identical row instead of
 * duplicating it. The list stays name-sorted like the `order('name')` fetch.
 */
export function applyItemPatch(
  current: InventoryItem[],
  categories: Category[],
  patch: RealtimePatch
): InventoryItem[] {
  if (patch.table !== 'items') return current;

  if (patch.event === 'DELETE') {
    const id = patchId(patch);
    if (!id) return current;
    return current.filter((item) => item.id !== id);
  }

  const row = asItem(patch.newRecord);
  if (!row) return current;
  const existing = current.find((item) => item.id === row.id);
  if (existing && !isNewerItem(row, existing)) return current;

  const [joined] = joinInventory([row], categories);
  const next = existing
    ? current.map((item) => (item.id === row.id ? joined : item))
    : [...current, joined];
  return next.sort(byName);
}

/**
 * Applies a categories-table patch. Categories carry no `updated_at`, so
 * arrival order wins (documented limitation — category writes are rare and
 * always full-row).
 */
export function applyCategoryPatch(current: Category[], patch: RealtimePatch): Category[] {
  if (patch.table !== 'categories') return current;

  if (patch.event === 'DELETE') {
    const id = patchId(patch);
    if (!id) return current;
    return current.filter((category) => category.id !== id);
  }

  const row = asCategory(patch.newRecord);
  if (!row) return current;
  return current.some((category) => category.id === row.id)
    ? current.map((category) => (category.id === row.id ? row : category))
    : [...current, row];
}

/**
 * Refreshes the category embedded in joined rows after a category patch
 * (joins go stale otherwise — the row keeps the old category object).
 */
export function refreshEmbeddedCategories(
  current: InventoryItem[],
  category: Category
): InventoryItem[] {
  return current.map((item) =>
    item.category_id === category.id ? { ...item, category } : item
  );
}

/**
 * Drops the embedded category of rows whose category was deleted
 * (deletion is normally blocked while items reference it, but a remote
 * delete must never leave a ghost category object behind).
 */
export function clearEmbeddedCategory(current: InventoryItem[], categoryId: string): InventoryItem[] {
  return current.map((item) =>
    item.category_id === categoryId ? { ...item, category: undefined } : item
  );
}
/**
 * To-buy variant: same upsert/LWW core, plus the page's low-stock contract
 * (mirrors `fetchItems`): a row that is neither low-stock nor checked-out
 * leaves the list; a checked row stays (updated) even above its threshold.
 */
export function applyToBuyPatch(
  current: InventoryItem[],
  categories: Category[],
  patch: RealtimePatch,
  isChecked: (id: string) => boolean
): InventoryItem[] {
  if (patch.table !== 'items') return current;

  if (patch.event === 'DELETE') {
    const id = patchId(patch);
    if (!id) return current;
    return current.filter((item) => item.id !== id);
  }

  const row = asItem(patch.newRecord);
  if (!row) return current;
  const existing = current.find((item) => item.id === row.id);
  if (existing && !isNewerItem(row, existing)) return current;

  const [joined] = joinInventory([row], categories);
  const [lowStock] = getLowStockItems([joined]);
  if (!lowStock && !isChecked(row.id)) {
    return current.filter((item) => item.id !== row.id);
  }
  const next = existing
    ? current.map((item) => (item.id === row.id ? joined : item))
    : [...current, joined];
  return next.sort(byName);
}
