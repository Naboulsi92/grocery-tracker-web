import { createClient } from '@/utils/supabase/client';
import type { Database } from '@/types/database';

type Item = Database['public']['Tables']['items']['Row'];
type ItemInsert = Database['public']['Tables']['items']['Insert'];
type ItemUpdate = Database['public']['Tables']['items']['Update'];

export type ItemOperationError = {
  error: Error | null;
};

export async function createItem(
  householdId: string,
  data: {
    name: string;
    quantity?: number;
    unit_id: string;
    category_id?: string | null;
    low_stock_threshold?: number;
  }
): Promise<ItemOperationError> {
  const supabase = createClient();

  const itemData: ItemInsert = {
    household_id: householdId,
    name: data.name,
    quantity: data.quantity ?? 1,
    unit_id: data.unit_id,
    category_id: data.category_id ?? null,
    low_stock_threshold: data.low_stock_threshold ?? 1,
  };

  const { error } = await supabase.from('items').insert(itemData);

  if (error) {
    console.warn('client_operation_failed', {
      area: 'item',
      action: 'create',
      code: error.code ?? 'unknown',
    });
    return { error: new Error(itemActionError('create', error)) };
  }

  return { error: null };
}

export async function updateItem(
  itemId: string,
  householdId: string,
  data: {
    name?: string;
    unit_id?: string;
    category_id?: string | null;
    low_stock_threshold?: number;
  }
): Promise<ItemOperationError> {
  const supabase = createClient();

  const updateData: ItemUpdate = {
    name: data.name,
    unit_id: data.unit_id,
    category_id: data.category_id,
    low_stock_threshold: data.low_stock_threshold,
  };

  const { error } = await supabase
    .from('items')
    .update(updateData)
    .eq('id', itemId)
    .eq('household_id', householdId);

  if (error) {
    console.warn('client_operation_failed', {
      area: 'item',
      action: 'update',
      code: error.code ?? 'unknown',
    });
    return { error: new Error(itemActionError('update', error)) };
  }

  return { error: null };
}

export async function updateItemQuantity(
  itemId: string,
  quantity: number
): Promise<ItemOperationError> {
  const supabase = createClient();

  const { error } = await supabase.rpc('adjust_item_quantity', {
    p_item_id: itemId,
    p_delta: quantity,
  });

  if (error) {
    console.warn('client_operation_failed', {
      area: 'item',
      action: 'updateQuantity',
      code: error.code ?? 'unknown',
    });
    return { error: new Error(itemActionError('updateQuantity', error)) };
  }

  return { error: null };
}

export async function deleteItem(itemId: string, householdId: string): Promise<ItemOperationError> {
  const supabase = createClient();

  const { error } = await supabase
    .from('items')
    .delete()
    .eq('id', itemId)
    .eq('household_id', householdId);

  if (error) {
    console.warn('client_operation_failed', {
      area: 'item',
      action: 'delete',
      code: error.code ?? 'unknown',
    });
    return { error: new Error(itemActionError('delete', error)) };
  }

  return { error: null };
}

function itemActionError(
  action: 'create' | 'update' | 'updateQuantity' | 'delete',
  error: { message?: string; code?: string } | null | undefined
): string {
  if (action === 'update' && error?.message?.includes('row-level security')) {
    return "Vous n'avez pas l'autorisation de modifier cet article.";
  }
  if (action === 'delete' && error?.message?.includes('row-level security')) {
    return "Vous n'avez pas l'autorisation de supprimer cet article.";
  }

  const fallback = {
    create: "Impossible de créer l'article. Vous pouvez réessayer.",
    update: "Impossible de mettre à jour l'article. Vous pouvez réessayer.",
    updateQuantity: 'Impossible de modifier la quantité. Vous pouvez réessayer.',
    delete: "Impossible de supprimer l'article. Vous pouvez réessayer.",
  } as const;

  return fallback[action];
}