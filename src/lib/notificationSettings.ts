import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '@/types/database';

export type NotificationType = 'push' | 'badge' | 'both' | 'none';

export interface NotificationSettings {
  notificationType: NotificationType;
  reminderTime: string | null;
}

const LOAD_ERROR = 'errors.notifications.load_failed';
const SAVE_ERROR = 'errors.notifications.save_failed';

function isNotificationType(value: string | null): value is NotificationType {
  return value === 'push' || value === 'badge' || value === 'both' || value === 'none';
}

export async function loadNotificationSettings(
  supabase: SupabaseClient<Database>,
  userId: string,
): Promise<{ settings: NotificationSettings | null; error: string | null }> {
  const { data, error } = await supabase
    .from('profiles')
    .select('notification_type, reminder_time')
    .eq('id', userId)
    .maybeSingle();

  if (error || !data) {
    return { settings: null, error: LOAD_ERROR };
  }

  return {
    settings: {
      notificationType: isNotificationType(data.notification_type) ? data.notification_type : 'none',
      reminderTime: data.reminder_time,
    },
    error: null,
  };
}

export async function saveNotificationSettings(
  supabase: SupabaseClient<Database>,
  userId: string,
  settings: NotificationSettings,
): Promise<{ error: string | null }> {
  const profileUpdate: Database['public']['Tables']['profiles']['Update'] = {
    notification_type: settings.notificationType,
    reminder_time: settings.reminderTime,
  };

  const { error } = await supabase
    .from('profiles')
    .update(profileUpdate)
    .eq('id', userId);

  if (error) {
    return { error: SAVE_ERROR };
  }

  return { error: null };
}