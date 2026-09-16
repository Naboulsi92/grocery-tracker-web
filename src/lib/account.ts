import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '@/types/database';
import { LETTER_PATTERN } from './validation';

export type Profile = Pick<
  Database['public']['Tables']['profiles']['Row'],
  'id' | 'display_name' | 'language' | 'deleted_at'
>;

export type ProfileLanguage = 'fr' | 'en';

const MAX_DISPLAY_NAME_LENGTH = 50;
const MIN_PASSWORD_LENGTH = 8;

type AccountAction =
  | 'load'
  | 'updateName'
  | 'language'
  | 'delete'
  | 'restore'
  | 'verifyPassword'
  | 'updatePassword';

export function validateDisplayName(value: string): string | null {
  const trimmed = value.trim();
  if (!trimmed) return 'validation.display_name.required';
  if (!LETTER_PATTERN.test(trimmed)) return 'validation.display_name.required_letter';
  if (trimmed.length > MAX_DISPLAY_NAME_LENGTH) {
    return 'validation.display_name.too_long';
  }
  return null;
}

export function validateNewPassword(value: string): string | null {
  if (value.length < MIN_PASSWORD_LENGTH) {
    return 'validation.password.min_length';
  }
  return null;
}

export function isProfileLanguage(value: string): value is ProfileLanguage {
  return value === 'fr' || value === 'en';
}

/**
 * Account deletion is soft (profiles.deleted_at set). The user may cancel by
 * signing in again within the 7-day retention window. Permanent deletion is
 * performed by the member-gdpr-sweep edge function (RPC sweep_fully_deleted_members),
 * scheduled daily by an external cron — as long as the row still exists and
 * deleted_at is in the past, the account is restorable.
 */
export function shouldRestoreAccount(deletedAt: string | null, now: number = Date.now()): boolean {
  if (deletedAt === null) return false;
  return Date.parse(deletedAt) <= now;
}

export async function fetchProfile(
  supabase: SupabaseClient<Database>,
  userId: string,
): Promise<{ profile: Profile | null; error: string | null }> {
  const { data, error } = await supabase
    .from('profiles')
    .select('id, display_name, language, deleted_at')
    .eq('id', userId)
    .maybeSingle();

  if (error) return { profile: null, error: accountActionError('load', error) };
  return { profile: data, error: null };
}

export async function updateDisplayName(
  supabase: SupabaseClient<Database>,
  userId: string,
  displayName: string,
): Promise<{ error: string | null }> {
  const trimmed = displayName.trim();
  const validationError = validateDisplayName(trimmed);
  if (validationError) return { error: validationError };

  const { error } = await supabase
    .from('profiles')
    .update({ display_name: trimmed })
    .eq('id', userId);

  if (error) return { error: accountActionError('updateName', error) };
  return { error: null };
}

export async function updateProfileLanguage(
  supabase: SupabaseClient<Database>,
  userId: string,
  language: ProfileLanguage,
): Promise<{ error: string | null }> {
  if (!isProfileLanguage(language)) return { error: 'validation.language.unknown' };

  const { error } = await supabase
    .from('profiles')
    .update({ language })
    .eq('id', userId);

  if (error) return { error: accountActionError('language', error) };
  return { error: null };
}

export async function changePassword(
  supabase: SupabaseClient<Database>,
  email: string,
  currentPassword: string,
  newPassword: string,
): Promise<{ error: string | null }> {
  const validationError = validateNewPassword(newPassword);
  if (validationError) return { error: validationError };

  // Verifying the current password also refreshes the session, which avoids the
  // "reauthentication required" error updateUser() can raise on stale sessions.
  const { error: verifyError } = await supabase.auth.signInWithPassword({ email, password: currentPassword });
  if (verifyError) return { error: accountActionError('verifyPassword', verifyError) };

  const { error } = await supabase.auth.updateUser({ password: newPassword });
  if (error) return { error: accountActionError('updatePassword', error) };
  return { error: null };
}

/**
 * Soft-deletes the account: sets profiles.deleted_at = now(). The user can
 * cancel by signing in again within 7 days (see restoreAccountIfPending). The
 * permanent deletion after 7 days is handled by the member-gdpr-sweep edge
 * function (see supabase/functions/member-gdpr-sweep + functions/README.md).
 */
export async function requestAccountDeletion(
  supabase: SupabaseClient<Database>,
  userId: string,
): Promise<{ error: string | null }> {
  const { error } = await supabase
    .from('profiles')
    .update({ deleted_at: new Date().toISOString() })
    .eq('id', userId);

  if (error) return { error: accountActionError('delete', error) };
  return { error: null };
}

export async function restoreAccountIfPending(
  supabase: SupabaseClient<Database>,
  userId: string,
): Promise<{ restored: boolean; error: string | null }> {
  const { data, error } = await supabase
    .from('profiles')
    .select('deleted_at')
    .eq('id', userId)
    .maybeSingle();

  if (error) return { restored: false, error: accountActionError('restore', error) };
  if (!data || !shouldRestoreAccount(data.deleted_at)) return { restored: false, error: null };

  const { error: updateError } = await supabase
    .from('profiles')
    .update({ deleted_at: null })
    .eq('id', userId);

  if (updateError) return { restored: false, error: accountActionError('restore', updateError) };
  return { restored: true, error: null };
}

function accountActionError(
  action: AccountAction,
  error: { message?: string; code?: string } | null | undefined,
): string {
  console.warn('client_operation_failed', {
    area: 'account',
    action,
    code: error?.code ?? 'unknown',
  });

  if (action === 'verifyPassword') {
    if (error?.message?.includes('Invalid login credentials')) {
      return 'errors.account.password_incorrect';
    }
    return 'errors.account.password_verify_failed';
  }

  if (action === 'updatePassword') {
    const message = error?.message?.toLowerCase() ?? '';
    if (error?.code === 'same_password' || message.includes('password should be different')) {
      return 'errors.account.password_same';
    }
    if (error?.code === 'weak_password' || message.includes('weak password')) {
      return 'errors.account.password_weak';
    }
    if (error?.code === 'reauth_required' || message.includes('reauthentication')) {
      return 'errors.account.session_reauth_required';
    }
    return 'errors.account.password_change_failed';
  }

  const fallback: Record<AccountAction, string> = {
    load: 'errors.account.profile_load_failed',
    updateName: 'errors.account.name_save_failed',
    language: 'errors.account.language_save_failed',
    delete: 'errors.account.delete_failed',
    restore: 'errors.account.restore_failed',
    verifyPassword: 'errors.account.password_verify_failed',
    updatePassword: 'errors.account.password_change_failed',
  };
  return fallback[action];
}