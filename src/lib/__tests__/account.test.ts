import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '@/types/database';
import {
  changePassword,
  fetchProfile,
  requestAccountDeletion,
  restoreAccountIfPending,
  shouldRestoreAccount,
  updateName,
  updateProfileLanguage,
  validateFirstName,
  validateLastName,
  validateNewPassword,
} from '@/lib/account';

interface StubError {
  message?: string;
  code?: string;
}

interface StubResult {
  data?: unknown;
  error?: StubError | null;
}

type FakeSupabase = SupabaseClient<Database> & {
  updateValues: unknown[];
};

function createFakeSupabase(results: StubResult[] = [], auth?: {
  signInWithPassword?: (input: { email: string; password: string }) => Promise<StubResult>;
  updateUser?: (input: { password: string }) => Promise<StubResult>;
}): FakeSupabase {
  let step = 0;
  const updateValues: unknown[] = [];
  const stepResult = () => results[Math.min(step, results.length - 1)] ?? { data: null, error: null };
  const chain = {
    select: () => chain,
    eq: () => chain,
    maybeSingle: () => {
      const result = stepResult();
      step += 1;
      return Promise.resolve({ data: result.data ?? null, error: result.error ?? null });
    },
    update: (values: unknown) => {
      const result = stepResult();
      step += 1;
      updateValues.push(values);
      return { eq: () => Promise.resolve({ data: null, error: result.error ?? null }) };
    },
  };
  return {
    from: () => chain,
    auth: {
      signInWithPassword: auth?.signInWithPassword ?? (async () => ({ data: {}, error: null })),
      updateUser: auth?.updateUser ?? (async () => ({ data: {}, error: null })),
    },
    updateValues,
  } as unknown as FakeSupabase;
}

describe('validateFirstName', () => {
  it('rejects an empty first name', () => {
    expect(validateFirstName('')).toBe('validation.first_name.required');
    expect(validateFirstName('   ')).toBe('validation.first_name.required');
  });

  it('rejects a first name without any letter', () => {
    expect(validateFirstName('123')).toBe('validation.first_name.required_letter');
  });

  it('rejects a first name longer than 50 characters', () => {
    expect(validateFirstName('a'.repeat(51))).toBe('validation.first_name.too_long');
  });

  it('accepts a valid accented first name', () => {
    expect(validateFirstName('Émilie')).toBeNull();
    expect(validateFirstName('Zoë')).toBeNull();
  });
});

describe('validateLastName', () => {
  it('rejects an empty last name', () => {
    expect(validateLastName('')).toBe('validation.last_name.required');
    expect(validateLastName('   ')).toBe('validation.last_name.required');
  });

  it('rejects a last name without any letter', () => {
    expect(validateLastName('123')).toBe('validation.last_name.required_letter');
  });

  it('rejects a last name longer than 50 characters', () => {
    expect(validateLastName('a'.repeat(51))).toBe('validation.last_name.too_long');
  });

  it('accepts a valid accented last name', () => {
    expect(validateLastName('de la Croix')).toBeNull();
  });
});

describe('validateNewPassword', () => {
  it('rejects a password shorter than 8 characters', () => {
    expect(validateNewPassword('1234567')).toBe('validation.password.min_length');
  });

  it('accepts a password of 8 characters or more', () => {
    expect(validateNewPassword('12345678')).toBeNull();
    expect(validateNewPassword('longer-password')).toBeNull();
  });
});

describe('shouldRestoreAccount', () => {
  it('returns false when there is no soft-delete', () => {
    expect(shouldRestoreAccount(null)).toBe(false);
  });

  it('returns false when deleted_at is in the future', () => {
    expect(shouldRestoreAccount('2999-01-01T00:00:00.000Z', Date.parse('2026-01-01T00:00:00.000Z'))).toBe(false);
  });

  it('returns true when deleted_at is within the 7-day retention window', () => {
    const now = Date.parse('2026-09-10T00:00:00.000Z');
    expect(shouldRestoreAccount('2026-09-09T00:00:00.000Z', now)).toBe(true);
  });

  it('returns true exactly at the 7-day boundary (inclusive)', () => {
    const now = Date.parse('2026-09-10T00:00:00.000Z');
    expect(shouldRestoreAccount('2026-09-03T00:00:00.000Z', now)).toBe(true);
  });

  it('returns false beyond the 7-day retention window', () => {
    const now = Date.parse('2026-09-10T00:00:00.000Z');
    expect(shouldRestoreAccount('2026-09-01T00:00:00.000Z', now)).toBe(false);
  });

  it('returns true when deleted_at equals now', () => {
    const now = Date.parse('2026-09-01T00:00:00.000Z');
    expect(shouldRestoreAccount('2026-09-01T00:00:00.000Z', now)).toBe(true);
  });
});

describe('fetchProfile', () => {
  it('returns the profile on success', async () => {
    const supabase = createFakeSupabase([
      { data: { id: 'user-1', first_name: 'Alex', last_name: 'Dupont', language: 'fr', deleted_at: null } },
    ]);
    const result = await fetchProfile(supabase, 'user-1');
    expect(result.error).toBeNull();
    expect(result.profile?.first_name).toBe('Alex');
    expect(result.profile?.last_name).toBe('Dupont');
    expect(result.profile?.language).toBe('fr');
  });

  it('surfaces a friendly error on failure', async () => {
    const supabase = createFakeSupabase([
      { error: { message: 'permission denied', code: '42501' } },
    ]);
    const result = await fetchProfile(supabase, 'user-1');
    expect(result.profile).toBeNull();
    expect(result.error).toBe('errors.account.profile_load_failed');
  });
});

describe('updateName', () => {
  it('trims and writes the first and last name on success', async () => {
    const supabase = createFakeSupabase([{ data: null, error: null }]);
    const result = await updateName(supabase, 'user-1', '  Alex  ', '  Dupont  ');
    expect(result.error).toBeNull();
    expect(supabase.updateValues[0]).toEqual({ first_name: 'Alex', last_name: 'Dupont' });
  });

  it('rejects an invalid first name before hitting the database', async () => {
    const supabase = createFakeSupabase([]);
    const result = await updateName(supabase, 'user-1', '123', 'Dupont');
    expect(result.error).toContain('required_letter');
    expect(supabase.updateValues).toHaveLength(0);
  });

  it('rejects an invalid last name before hitting the database', async () => {
    const supabase = createFakeSupabase([]);
    const result = await updateName(supabase, 'user-1', 'Alex', '');
    expect(result.error).toContain('required');
    expect(supabase.updateValues).toHaveLength(0);
  });

  it('surfaces a friendly error on failure', async () => {
    const supabase = createFakeSupabase([{ error: { message: 'boom', code: '500' } }]);
    const result = await updateName(supabase, 'user-1', 'Alex', 'Dupont');
    expect(result.error).toBe('errors.account.name_save_failed');
  });
});

describe('updateProfileLanguage', () => {
  it('writes the language on success', async () => {
    const supabase = createFakeSupabase([{ data: null, error: null }]);
    const result = await updateProfileLanguage(supabase, 'user-1', 'en');
    expect(result.error).toBeNull();
  });

  it('rejects an unknown language', async () => {
    const supabase = createFakeSupabase([]);
    const result = await updateProfileLanguage(supabase, 'user-1', 'de' as never);
    expect(result.error).toContain('unknown');
  });

  it('surfaces a friendly error on failure', async () => {
    const supabase = createFakeSupabase([{ error: { message: 'boom', code: '500' } }]);
    const result = await updateProfileLanguage(supabase, 'user-1', 'fr');
    expect(result.error).toBe('errors.account.language_save_failed');
  });
});

describe('changePassword', () => {
  it('rejects a short new password before calling the database', async () => {
    const supabase = createFakeSupabase();
    const result = await changePassword(supabase, 'a@b.c', 'current-password', '123');
    expect(result.error).toContain('min_length');
  });

  it('rejects an incorrect current password', async () => {
    const supabase = createFakeSupabase(undefined, {
      signInWithPassword: async () => ({ data: null, error: { message: 'Invalid login credentials', code: 'invalid_credentials' } }),
    });
    const result = await changePassword(supabase, 'a@b.c', 'wrong', 'new-password-1');
    expect(result.error).toBe('errors.account.password_incorrect');
  });

  it('updates the password after verifying the current one', async () => {
    let updated = false;
    const supabase = createFakeSupabase(undefined, {
      signInWithPassword: async ({ email, password }) => ({
        data: { user: {} },
        error: password === 'current-password' && email === 'a@b.c' ? null : { message: 'Invalid login credentials' },
      }),
      updateUser: async ({ password }) => {
        updated = password === 'new-password-1';
        return { data: {}, error: null };
      },
    });
    const result = await changePassword(supabase, 'a@b.c', 'current-password', 'new-password-1');
    expect(result.error).toBeNull();
    expect(updated).toBe(true);
  });

  it('maps a same-password error to a friendly message', async () => {
    const supabase = createFakeSupabase(undefined, {
      updateUser: async () => ({ data: null, error: { message: 'New password should be different from the old password.', code: 'same_password' } }),
    });
    const result = await changePassword(supabase, 'a@b.c', 'current-password', 'current-password');
    expect(result.error).toBe('errors.account.password_same');
  });

  it('maps a reauthentication error to a friendly message', async () => {
    const supabase = createFakeSupabase(undefined, {
      updateUser: async () => ({ data: null, error: { message: 'Reauthentication required for security', code: 'reauth_required' } }),
    });
    const result = await changePassword(supabase, 'a@b.c', 'current-password', 'new-password-1');
    expect(result.error).toBe('errors.account.session_reauth_required');
  });
});

describe('requestAccountDeletion', () => {
  it('records the soft-delete timestamp on success', async () => {
    const supabase = createFakeSupabase([{ error: null }]);
    const result = await requestAccountDeletion(supabase, 'user-1');
    expect(result.error).toBeNull();
    const update = supabase.updateValues[0] as { deleted_at?: string | null };
    expect(update.deleted_at).toEqual(expect.any(String));
    expect(Date.parse(update.deleted_at as string)).not.toBeNaN();
  });

  it('surfaces a friendly error on failure', async () => {
    const supabase = createFakeSupabase([{ error: { message: 'boom', code: '500' } }]);
    const result = await requestAccountDeletion(supabase, 'user-1');
    expect(result.error).toBe('errors.account.delete_failed');
  });
});

describe('restoreAccountIfPending', () => {
  it('restores the account when deleted_at is in the past', async () => {
    const supabase = createFakeSupabase([
      { data: { deleted_at: new Date(Date.now() - 1000).toISOString() } },
      { error: null },
    ]);
    const result = await restoreAccountIfPending(supabase, 'user-1');
    expect(result.restored).toBe(true);
    expect(result.error).toBeNull();
    expect(supabase.updateValues[0]).toEqual({ deleted_at: null });
  });

  it('does nothing when the profile is not soft-deleted', async () => {
    const supabase = createFakeSupabase([{ data: { deleted_at: null } }]);
    const result = await restoreAccountIfPending(supabase, 'user-1');
    expect(result.restored).toBe(false);
    expect(result.error).toBeNull();
  });

  it('does nothing when deleted_at is in the future', async () => {
    const supabase = createFakeSupabase([
      { data: { deleted_at: new Date(Date.now() + 60_000).toISOString() } },
    ]);
    const result = await restoreAccountIfPending(supabase, 'user-1');
    expect(result.restored).toBe(false);
  });

  it('surfaces a friendly error when the update fails', async () => {
    const supabase = createFakeSupabase([
      { data: { deleted_at: new Date(Date.now() - 1000).toISOString() } },
      { error: { message: 'boom', code: '500' } },
    ]);
    const result = await restoreAccountIfPending(supabase, 'user-1');
    expect(result.restored).toBe(false);
    expect(result.error).toBe('errors.account.restore_failed');
  });
});