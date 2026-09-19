import { createClient } from '@/utils/supabase/client';
import type { Database } from '@/types/database';
import type { SupabaseClient } from '@supabase/supabase-js';
import { translate, type Language } from '@/lib/i18n';

export type HistoryActionType = 'modification' | 'suppression';

type HistoryRow = Database['public']['Tables']['history']['Row'];
type ProfileName = Pick<Database['public']['Tables']['profiles']['Row'], 'id' | 'first_name' | 'last_name'>;

export type HistoryEntry = HistoryRow & { actorName: string };

export function formatRelativeTime(
  performedAt: string | Date,
  language: Language = 'fr',
  now: Date = new Date(),
): string {
  const elapsedMs = now.getTime() - new Date(performedAt).getTime();
  if (elapsedMs < 60_000) return translate(language, 'time.just_now');
  const minutes = Math.floor(elapsedMs / 60_000);
  if (minutes < 60) return translate(language, 'time.minutes_ago', { count: minutes });
  const hours = Math.floor(elapsedMs / 3_600_000);
  if (hours < 24) return translate(language, 'time.hours_ago', { count: hours });
  const days = Math.floor(elapsedMs / 86_400_000);
  if (days === 1) return translate(language, 'time.yesterday');
  return translate(language, 'time.days_ago', { count: days });
}

export function joinHistoryActors(
  entries: HistoryRow[],
  profiles: ProfileName[],
  language: Language = 'fr',
): HistoryEntry[] {
  const actorNames = new Map(profiles.map((profile) => [
    profile.id,
    [profile.first_name?.trim(), profile.last_name?.trim()].filter(Boolean).join(' '),
  ]));
  const fallback = translate(language, 'history.fallback_actor');
  return entries.map((entry) => ({
    ...entry,
    actorName: entry.performed_by
      ? actorNames.get(entry.performed_by) || fallback
      : fallback,
  }));
}

export async function logItemHistory(
  householdId: string,
  actionType: HistoryActionType,
  itemName: string,
  supabase?: SupabaseClient
): Promise<void> {
  const client = supabase ?? createClient();
  const { data: { user } } = await client.auth.getUser();

  const { error } = await client.from('history').insert({
    household_id: householdId,
    performed_by: user?.id ?? null,
    action_type: actionType,
    item_name: itemName,
  });

  if (error) {
    console.warn('history_insert_failed', { area: 'history', code: error.code ?? 'unknown' });
  }
}

export async function fetchHouseholdHistory(
  householdId: string,
  supabase?: SupabaseClient,
  language: Language = 'fr',
): Promise<HistoryEntry[]> {
  const client = supabase ?? createClient();

  const { data, error } = await client
    .from('history')
    .select('id, household_id, action_type, item_name, performed_at, performed_by')
    .eq('household_id', householdId)
    .order('performed_at', { ascending: false })
    .limit(20);
  if (error) throw error;

  const userIds = [...new Set(
    (data ?? [])
      .map((entry) => entry.performed_by)
      .filter((id): id is string => Boolean(id))
  )];

  let profiles: ProfileName[] = [];
  if (userIds.length > 0) {
    const profilesResult = await client.from('profiles').select('id, first_name, last_name').in('id', userIds);
    if (profilesResult.error) throw profilesResult.error;
    profiles = profilesResult.data ?? [];
  }

  return joinHistoryActors(data ?? [], profiles, language);
}
