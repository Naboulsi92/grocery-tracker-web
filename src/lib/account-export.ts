import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '@/types/database';

/**
 * RGPD export (§4.11, ticket #136) : téléchargement JSON des données
 * personnelles — profil + foyer (membres, catégories, articles, historique).
 *
 * Format :
 * {
 *   exported_at: string (ISO), version: 1,
 *   profile: { id, first_name, last_name, language, notification_type,
 *     reminder_time, deleted_at, created_at } | null,
 *   household: null | {
 *     id, name, membership: { role, joined_at },
 *     members: [{ user_id, role, joined_at, first_name, last_name }],
 *     categories: [{ id, name, is_default, created_at }],
 *     items: [{ id, category_id, name, quantity, unit,
 *       low_stock_threshold, created_at }],
 *     history: [{ id, action_type, item_name, performed_by,
 *       performed_at }] (200 plus récentes)
 *   }
 * }
 *
 * Périmètre RLS : les mêmes lectures membre-gatées que l'app (useHousehold,
 * pages items/history). Sans foyer (ex. après quitter, pendant la grâce 7j),
 * household vaut null — le profil reste exporté. Aucune écriture, aucune
 * migration : lecture seule côté client.
 */

export const ACCOUNT_EXPORT_VERSION = 1;
const HISTORY_EXPORT_LIMIT = 200;

type ExportProfile = Pick<
  Database['public']['Tables']['profiles']['Row'],
  'id' | 'first_name' | 'last_name' | 'language' | 'notification_type' | 'reminder_time' | 'deleted_at' | 'created_at'
>;

type ExportMembership = Pick<
  Database['public']['Tables']['household_members']['Row'],
  'household_id' | 'user_id' | 'role' | 'joined_at'
>;

type ExportMember = Omit<ExportMembership, 'household_id'> & {
  first_name: string | null;
  last_name: string | null;
};

type ExportCategory = Pick<
  Database['public']['Tables']['categories']['Row'],
  'id' | 'name' | 'is_default' | 'created_at'
>;

type ExportItem = Pick<
  Database['public']['Tables']['items']['Row'],
  'id' | 'category_id' | 'name' | 'quantity' | 'unit' | 'low_stock_threshold' | 'created_at'
>;

type ExportHistoryEntry = Pick<
  Database['public']['Tables']['history']['Row'],
  'id' | 'action_type' | 'item_name' | 'performed_by' | 'performed_at'
>;

export interface AccountExport {
  exported_at: string;
  version: number;
  profile: ExportProfile | null;
  household: {
    id: string;
    name: string;
    membership: { role: ExportMembership['role']; joined_at: string | null };
    members: ExportMember[];
    categories: ExportCategory[];
    items: ExportItem[];
    history: ExportHistoryEntry[];
  } | null;
}

type ExportAction = 'export';

function exportActionError(
  error: { message?: string; code?: string } | null | undefined,
): string {
  console.warn('client_operation_failed', {
    area: 'account',
    action: 'export' as ExportAction,
    code: error?.code ?? 'unknown',
  });
  return 'errors.account.export_failed';
}

/**
 * Construit l'export RGPD : profil toujours, foyer seulement si le user
 * est encore membre (sinon RLS → household null, sans erreur).
 */
export async function buildAccountExport(
  supabase: SupabaseClient<Database>,
  userId: string,
): Promise<{ data: AccountExport | null; error: string | null }> {
  const { data: profile, error: profileError } = await supabase
    .from('profiles')
    .select('id, first_name, last_name, language, notification_type, reminder_time, deleted_at, created_at')
    .eq('id', userId)
    .maybeSingle();

  if (profileError) return { data: null, error: exportActionError(profileError) };

  const { data: membership, error: membershipError } = await supabase
    .from('household_members')
    .select('household_id, user_id, role, joined_at')
    .eq('user_id', userId)
    .maybeSingle();

  if (membershipError) return { data: null, error: exportActionError(membershipError) };

  if (!membership) {
    return {
      data: { exported_at: new Date().toISOString(), version: ACCOUNT_EXPORT_VERSION, profile, household: null },
      error: null,
    };
  }

  const householdId = membership.household_id;
  const [householdResult, membersResult, categoriesResult, itemsResult, historyResult] = await Promise.all([
    supabase.from('households').select('id, name').eq('id', householdId).maybeSingle(),
    supabase
      .from('household_members')
      .select('user_id, role, joined_at')
      .eq('household_id', householdId)
      .order('joined_at', { ascending: true }),
    supabase.from('categories').select('id, name, is_default, created_at').eq('household_id', householdId).order('name'),
    supabase
      .from('items')
      .select('id, category_id, name, quantity, unit, low_stock_threshold, created_at')
      .eq('household_id', householdId)
      .order('name'),
    supabase
      .from('history')
      .select('id, action_type, item_name, performed_by, performed_at')
      .eq('household_id', householdId)
      .order('performed_at', { ascending: false })
      .limit(HISTORY_EXPORT_LIMIT),
  ]);

  const firstError =
    householdResult.error ?? membersResult.error ?? categoriesResult.error ?? itemsResult.error ?? historyResult.error;
  if (firstError || !householdResult.data) return { data: null, error: exportActionError(firstError) };

  const memberships = membersResult.data ?? [];
  const memberProfiles = memberships.length
    ? await supabase.from('profiles').select('id, first_name, last_name').in('id', memberships.map((m) => m.user_id))
    : { data: [], error: null };

  if (memberProfiles.error) return { data: null, error: exportActionError(memberProfiles.error) };

  const namesById = new Map((memberProfiles.data ?? []).map((p) => [p.id, p]));
  const members: ExportMember[] = memberships.map((m) => ({
    user_id: m.user_id,
    role: m.role,
    joined_at: m.joined_at,
    first_name: namesById.get(m.user_id)?.first_name ?? null,
    last_name: namesById.get(m.user_id)?.last_name ?? null,
  }));

  return {
    data: {
      exported_at: new Date().toISOString(),
      version: ACCOUNT_EXPORT_VERSION,
      profile,
      household: {
        id: householdResult.data.id,
        name: householdResult.data.name,
        membership: { role: membership.role, joined_at: membership.joined_at },
        members,
        categories: categoriesResult.data ?? [],
        items: itemsResult.data ?? [],
        history: historyResult.data ?? [],
      },
    },
    error: null,
  };
}

export function accountExportFilename(at: Date = new Date()): string {
  const iso = at.toISOString();
  const stamp = `${iso.slice(0, 10).replace(/-/g, '')}-${iso.slice(11, 16).replace(':', '')}`;
  return `grocery-list-export-${stamp}.json`;
}

/** Déclenche le téléchargement du JSON (navigateur uniquement). */
export function downloadAccountExport(data: AccountExport): void {
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = accountExportFilename();
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  URL.revokeObjectURL(url);
}
