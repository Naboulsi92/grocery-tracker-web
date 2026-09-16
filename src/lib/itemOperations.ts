import { createClient } from '@/utils/supabase/client';
import type { Database } from '@/types/database';
import type { SupabaseClient } from '@supabase/supabase-js';
import { logItemHistory } from './history';
import { enqueueAction } from './offlineQueue';

type Item = Database['public']['Tables']['items']['Row'];
type ItemInsert = Database['public']['Tables']['items']['Insert'];
type ItemUpdate = Database['public']['Tables']['items']['Update'];
type DefaultItem = Database['public']['Tables']['default_items']['Row'];

export type { DefaultItem };

export function isItemPristine(item: Item, defaultItem?: DefaultItem | null): boolean {
  if (!item.default_item_id || !defaultItem || item.default_item_id !== defaultItem.id) return false;
  return (
    item.name.trim().toLowerCase() === defaultItem.name_fr.trim().toLowerCase() &&
    item.unit === defaultItem.unit &&
    item.low_stock_threshold === defaultItem.threshold
  );
}

export type ItemOperationError = {
  error: Error | null;
  queued?: boolean;
};

function logItemOperationError(
  action: 'create' | 'update' | 'updateQuantity' | 'delete',
  error: { code?: string } | null | undefined
) {
  console.warn('client_operation_failed', {
    area: 'item',
    action,
    code: error?.code ?? 'unknown',
  });
}

export async function createItem(
  householdId: string,
  data: {
    name: string;
    quantity?: number;
    unit: string;
    category_id?: string | null;
    low_stock_threshold?: number;
  },
  supabase?: SupabaseClient
): Promise<ItemOperationError> {
  if (!navigator.onLine) {
    await enqueueAction({
      type: 'create',
      payload: {
        householdId,
        name: data.name,
        quantity: data.quantity ?? 1,
        unit: data.unit,
        category_id: data.category_id ?? null,
        low_stock_threshold: data.low_stock_threshold ?? 1,
      },
      createdAt: Date.now(),
      retryCount: 0,
    });
    return { error: null, queued: true };
  }

  const client = supabase ?? createClient();

  const itemData: ItemInsert = {
    household_id: householdId,
    name: data.name,
    quantity: data.quantity ?? 1,
    unit: data.unit,
    category_id: data.category_id ?? null,
    low_stock_threshold: data.low_stock_threshold ?? 1,
  };

  const { error } = await client.from('items').insert(itemData);

  if (error) {
    logItemOperationError('create', error);
    return { error: new Error(itemActionError('create', error)) };
  }

  return { error: null };
}

export async function updateItem(
  itemId: string,
  householdId: string,
  data: {
    name?: string;
    unit?: string;
    category_id?: string | null;
    low_stock_threshold?: number;
  },
  supabase?: SupabaseClient
): Promise<ItemOperationError> {
  if (!navigator.onLine) {
    await enqueueAction({
      type: 'update',
      payload: { itemId, householdId, ...data },
      createdAt: Date.now(),
      retryCount: 0,
    });
    return { error: null, queued: true };
  }

  const client = supabase ?? createClient();

  const { data: current } = await client
    .from('items')
    .select('id, name, unit, quantity, low_stock_threshold, default_item_id')
    .eq('id', itemId)
    .eq('household_id', householdId)
    .maybeSingle();

  if (!current) {
    return { error: new Error(itemActionError('update', { message: 'item not found' })) };
  }

  const unitChanged = data.unit !== undefined && data.unit !== current.unit;

  const updateData: ItemUpdate = {
    name: data.name,
    unit: data.unit,
    category_id: data.category_id,
    low_stock_threshold: data.low_stock_threshold,
  };

  // Unit change clears the low-stock threshold (user must re-enter). The DB column is
  // non-nullable, so 1 is the "cleared" sentinel. The default-origin marker is preserved:
  // divergence from the linked default IS the fork.
  if (unitChanged) {
    updateData.low_stock_threshold = 1;
  }

  const { error } = await client
    .from('items')
    .update(updateData)
    .eq('id', itemId)
    .eq('household_id', householdId);

  if (error) {
    logItemOperationError('update', error);
    return { error: new Error(itemActionError('update', error)) };
  }

  // Unit change clears the quantity too; clients have no direct UPDATE grant on quantity,
  // so use the existing adjust RPC (delta = -current, clamped to 0). Not history-logged.
  if (unitChanged && current.quantity > 0) {
    const { error: quantityError } = await client.rpc('adjust_item_quantity', {
      p_item_id: itemId,
      p_delta: -current.quantity,
    });
    if (quantityError) {
      logItemOperationError('update', quantityError);
      return { error: new Error(itemActionError('update', quantityError)) };
    }
  }

  const itemName =
    data.name !== undefined && data.name.trim() !== current.name
      ? data.name.trim()
      : current.name;
  await logItemHistory(householdId, 'modification', itemName, client);

  return { error: null };
}

export async function updateItemQuantity(
  itemId: string,
  quantity: number,
  supabase?: SupabaseClient
): Promise<ItemOperationError> {
  if (!navigator.onLine) {
    await enqueueAction({
      type: 'updateQuantity',
      payload: { itemId, delta: quantity },
      createdAt: Date.now(),
      retryCount: 0,
    });
    return { error: null, queued: true };
  }

  const client = supabase ?? createClient();

  const { error } = await client.rpc('adjust_item_quantity', {
    p_item_id: itemId,
    p_delta: quantity,
  });

  if (error) {
    logItemOperationError('updateQuantity', error);
    return { error: new Error(itemActionError('updateQuantity', error)) };
  }

  return { error: null };
}

export async function deleteItem(
  itemId: string,
  householdId: string,
  supabase?: SupabaseClient
): Promise<ItemOperationError> {
  if (!navigator.onLine) {
    await enqueueAction({
      type: 'delete',
      payload: { itemId, householdId },
      createdAt: Date.now(),
      retryCount: 0,
    });
    return { error: null, queued: true };
  }

  const client = supabase ?? createClient();

  const { data: itemToDelete } = await client.from('items').select('name').eq('id', itemId).eq('household_id', householdId).maybeSingle();
  const itemName = itemToDelete?.name;

  const { error } = await client
    .from('items')
    .delete()
    .eq('id', itemId)
    .eq('household_id', householdId);

  if (error) {
    logItemOperationError('delete', error);
    return { error: new Error(itemActionError('delete', error)) };
  }

  if (itemName) {
    await logItemHistory(householdId, 'suppression', itemName, client);
  }

  return { error: null };
}

function itemActionError(
  action: 'create' | 'update' | 'updateQuantity' | 'delete',
  error: { message?: string; code?: string } | null | undefined
): string {
  if (action === 'update' && error?.message?.includes('row-level security')) {
    return 'errors.item.update_denied';
  }
  if (action === 'delete' && error?.message?.includes('row-level security')) {
    return 'errors.item.delete_denied';
  }

  const fallback = {
    create: 'errors.item.create_failed',
    update: 'errors.item.update_failed',
    updateQuantity: 'errors.item.quantity_failed',
    delete: 'errors.item.delete_failed',
  } as const;

  return fallback[action];
}