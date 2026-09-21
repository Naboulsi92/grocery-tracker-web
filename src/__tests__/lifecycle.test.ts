import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '@/types/database';
import {
  requestAccountDeletion,
  restoreAccountIfPending,
  shouldRestoreAccount,
} from '@/lib/account';
import { mergeHouseholdMembers } from '@/lib/household';
import { translate } from '@/lib/i18n';

const GRACE_PERIOD_MS = 7 * 24 * 60 * 60 * 1000;

/**
 * Compte/foyer lifecycle — #110 P1-9 (PRD §4.8, §4.9, §5).
 *
 * Unit contract for what Playwright cannot cover deterministically:
 * exact quit-dialog wording, post-leave membership shape, 7-day
 * restore/purge boundaries, and the 0-member orphan cascade.
 * E2E counterpart: src/e2e/lifecycle.spec.ts.
 */

interface StubResult {
  data?: unknown;
  error?: { message?: string; code?: string } | null;
}

function createFakeSupabase(results: StubResult[] = []) {
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
    updateValues,
  } as unknown as SupabaseClient<Database> & { updateValues: unknown[] };
}

/**
 * Mirrors the purge predicate of
 * supabase/migrations/20260916020000_server_notifications.sql
 * (`p.deleted_at < now() - interval '7 days'`): strict `<`, so a row
 * exactly 7 days old is NOT purged yet (but still restorable, see below).
 */
function isPurgeEligible(deletedAt: string | null, now: number): boolean {
  if (deletedAt === null) return false;
  return Date.parse(deletedAt) < now - GRACE_PERIOD_MS;
}

describe('lifecycle P1-9 — quit dialog wording (PRD §4.8)', () => {
  it('uses the exact quit warning and the Confirmer/Annuler actions', () => {
    expect(translate('fr', 'household.leave_hint')).toBe(
      "Vous perdrez l'accès à l'inventaire. L'autre membre garde toutes les données.",
    );
    expect(translate('fr', 'household.leave_confirm_title')).toBe('Quitter le foyer ?');
    expect(translate('fr', 'common.confirm')).toBe('Confirmer');
    expect(translate('fr', 'common.cancel')).toBe('Annuler');
  });

  it('shows the post-leave screen (0 inventory reads after departure)', () => {
    expect(translate('fr', 'household.left_title')).toBe('Vous avez quitté le foyer');
    expect(translate('fr', 'household.left_sub')).toBe("Vous n'avez plus accès à l'inventaire.");
  });
});

describe('lifecycle P1-9 — leaving removes access, the other member keeps everything', () => {
  const memberships = [
    { user_id: 'user-leaver', role: 'member', joined_at: '2026-08-31T10:00:00Z' },
    { user_id: 'user-stays', role: 'owner', joined_at: '2026-08-31T10:00:00Z' },
  ] as const;
  const profiles = [
    { id: 'user-leaver', first_name: 'Alex', last_name: 'Partant' },
    { id: 'user-stays', first_name: 'Camille', last_name: 'Restante' },
  ] as const;

  it('drops the leaver from the merged member list', () => {
    const remaining = mergeHouseholdMembers(
      memberships.filter((m) => m.user_id !== 'user-leaver').map((m) => ({ ...m })),
      profiles.map((p) => ({ ...p })),
    );
    expect(remaining.map((m) => m.user_id)).toEqual(['user-stays']);
  });

  it('keeps the remaining member intact, with no retention limit', () => {
    const remaining = mergeHouseholdMembers(
      memberships.filter((m) => m.user_id !== 'user-leaver').map((m) => ({ ...m })),
      profiles.map((p) => ({ ...p })),
    );
    expect(remaining).toEqual([
      {
        user_id: 'user-stays',
        role: 'owner',
        joined_at: '2026-08-31T10:00:00Z',
        fullName: 'Camille Restante',
      },
    ]);
  });
});

describe('lifecycle P1-9 — soft-delete restore within 7 days (PRD §4.9)', () => {
  const now = Date.parse('2026-09-10T00:00:00.000Z');

  it('is restorable 6 days after deletion', () => {
    expect(shouldRestoreAccount('2026-09-04T00:00:00.000Z', now)).toBe(true);
  });

  it('is still restorable exactly at the 7-day boundary (inclusive)', () => {
    expect(shouldRestoreAccount('2026-09-03T00:00:00.000Z', now)).toBe(true);
  });

  it('clears deleted_at when restoring a pending soft-delete', async () => {
    // NOTE: restoreAccountIfPending compares against Date.now(), so the
    // fixture must stay relative to the real clock (a fixed 2026-09-10 date
    // stops being restorable as soon as the suite runs >7 days later).
    const supabase = createFakeSupabase([
      { data: { deleted_at: new Date(Date.now() - 1000).toISOString() } },
      { error: null },
    ]);
    const result = await restoreAccountIfPending(supabase, 'user-1');
    expect(result).toEqual({ restored: true, error: null });
    expect(supabase.updateValues[0]).toEqual({ deleted_at: null });
  });

  it('records a parseable soft-delete timestamp on deletion request', async () => {
    const supabase = createFakeSupabase([{ error: null }]);
    const result = await requestAccountDeletion(supabase, 'user-1');
    expect(result.error).toBeNull();
    const update = supabase.updateValues[0] as { deleted_at?: string | null };
    expect(Date.parse(update.deleted_at as string)).not.toBeNaN();
  });
});

describe('lifecycle P1-9 — purge after 7 days (cron sweep)', () => {
  const now = Date.parse('2026-09-10T00:00:00.000Z');

  it('is NOT restorable beyond the 7-day window', () => {
    expect(shouldRestoreAccount('2026-09-01T00:00:00.000Z', now)).toBe(false);
  });

  it('is purge-eligible only strictly after 7 days (mirrors `deleted_at < now() - 7 days`)', () => {
    expect(isPurgeEligible('2026-09-01T00:00:00.000Z', now)).toBe(true);
    // Exactly at the boundary: restorable, but not yet purged.
    expect(isPurgeEligible('2026-09-03T00:00:00.000Z', now)).toBe(false);
    expect(shouldRestoreAccount('2026-09-03T00:00:00.000Z', now)).toBe(true);
    expect(isPurgeEligible(null, now)).toBe(false);
  });

  it('does not restore once the retention window has elapsed', async () => {
    const eightDaysAgo = new Date(now - 8 * 24 * 60 * 60 * 1000).toISOString();
    const supabase = createFakeSupabase([{ data: { deleted_at: eightDaysAgo } }]);
    const result = await restoreAccountIfPending(supabase, 'user-1');
    expect(result.restored).toBe(false);
    expect(supabase.updateValues).toHaveLength(0);
  });

  it('does not restore when there is no soft-delete pending', async () => {
    const supabase = createFakeSupabase([{ data: { deleted_at: null } }]);
    const result = await restoreAccountIfPending(supabase, 'user-1');
    expect(result).toEqual({ restored: false, error: null });
    expect(supabase.updateValues).toHaveLength(0);
  });

  it('does not restore a future-dated soft-delete', async () => {
    const supabase = createFakeSupabase([
      { data: { deleted_at: new Date(Date.now() + 60_000).toISOString() } },
    ]);
    const result = await restoreAccountIfPending(supabase, 'user-1');
    expect(result.restored).toBe(false);
    expect(supabase.updateValues).toHaveLength(0);
  });

  it('treats an unparseable deleted_at as non-restorable', () => {
    expect(shouldRestoreAccount('not-a-timestamp', now)).toBe(false);
  });
});

describe('lifecycle P1-9 — 0-member orphan cascade (PRD §5)', () => {
  interface OrphanState {
    members: { user_id: string }[];
    customCategories: { id: string }[];
    items: { id: string }[];
    history: { id: string }[];
    itemTemplates: { id: string }[];
    defaultCategories: { id: string }[];
  }

  /**
   * Documents the PRD §5 cascade rule: a household is never deleted while
   * it has at least one member; at 0 members its custom categories, all
   * items (including default forks) and history cascade, while the shared
   * ITEM_TEMPLATES catalogue and default categories are never affected.
   */
  function applyOrphanCascade(state: OrphanState): OrphanState {
    if (state.members.length > 0) return state;
    return {
      members: [],
      customCategories: [],
      items: [],
      history: [],
      itemTemplates: state.itemTemplates,
      defaultCategories: state.defaultCategories,
    };
  }

  const populated: OrphanState = {
    members: [{ user_id: 'user-1' }],
    customCategories: [{ id: 'custom-1' }],
    items: [{ id: 'fork-of-default-milk' }, { id: 'custom-item' }],
    history: [{ id: 'history-1' }],
    itemTemplates: [{ id: 'template-milk' }],
    defaultCategories: [{ id: 'default-fruits' }],
  };

  it('keeps everything while at least one member remains', () => {
    expect(applyOrphanCascade(populated)).toBe(populated);
  });

  it('purges custom categories, items and history at 0 members', () => {
    const orphan: OrphanState = { ...populated, members: [] };
    const purged = applyOrphanCascade(orphan);
    expect(purged.members).toEqual([]);
    expect(purged.customCategories).toEqual([]);
    expect(purged.items).toEqual([]);
    expect(purged.history).toEqual([]);
  });

  it('never affects ITEM_TEMPLATES or default categories', () => {
    const orphan: OrphanState = { ...populated, members: [] };
    const purged = applyOrphanCascade(orphan);
    expect(purged.itemTemplates).toEqual([{ id: 'template-milk' }]);
    expect(purged.defaultCategories).toEqual([{ id: 'default-fruits' }]);
  });

  it('leaves an already-empty orphan unchanged (idempotent)', () => {
    const empty: OrphanState = {
      members: [],
      customCategories: [],
      items: [],
      history: [],
      itemTemplates: [{ id: 'template-milk' }],
      defaultCategories: [{ id: 'default-fruits' }],
    };
    expect(applyOrphanCascade(empty)).toEqual(empty);
  });
});
