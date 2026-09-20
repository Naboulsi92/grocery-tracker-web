import { getLowStockItems, type InventoryItem } from '@/lib/inventory';

// ─── Miroirs JS du contrat serveur — notifications seuil à sens unique ───────
// Réf DB (lecture seule, ne pas toucher) :
//   migration #108 §2 = 20260916020000_server_notifications.sql re-asserté :
//   §1  notify_threshold_crossing() BEFORE UPDATE OF quantity
//   §1b notify_threshold_crossing_on_insert() + garde seed (foyer 1 membre)
//   §2  pending_notifications : actor_id posé + target_user_id null
//       → « non-acting members » ; target_user_id posé → ce seul membre.
//   §3  enqueue_daily_reminders : notification_type IN ('push','both').
// Ces tests verrouillent le contrat repris en e2e P0-2 / P0-3 sans appeler la DB.

// ─── 1/franchissement via already_notified (SQL §1) ──────────────────────────

type ThresholdState = { quantity: number; threshold: number; alreadyNotified: boolean };

function applyThresholdCrossing(
  oldState: ThresholdState,
  newQuantity: number,
): { alreadyNotified: boolean; enqueued: boolean } {
  const next: ThresholdState = { ...oldState, quantity: newQuantity };
  if (
    next.quantity <= next.threshold &&
    next.alreadyNotified === false &&
    (oldState.quantity > oldState.threshold || oldState.alreadyNotified === false)
  ) {
    return { alreadyNotified: true, enqueued: true };
  }
  if (next.quantity > next.threshold && oldState.alreadyNotified === true) {
    return { alreadyNotified: false, enqueued: false };
  }
  return { alreadyNotified: next.alreadyNotified, enqueued: false };
}

describe('threshold crossing — 1 notif par franchissement (already_notified)', () => {
  it('enqueues once when the quantity crosses down through the threshold', () => {
    expect(applyThresholdCrossing({ quantity: 5, threshold: 2, alreadyNotified: false }, 2)).toEqual({
      alreadyNotified: true,
      enqueued: true,
    });
  });

  it('treats quantity equal to the threshold as low stock (<=)', () => {
    expect(applyThresholdCrossing({ quantity: 3, threshold: 2, alreadyNotified: false }, 2)).toEqual({
      alreadyNotified: true,
      enqueued: true,
    });
  });

  it('does NOT re-enqueue while the item stays below the threshold', () => {
    const crossed = applyThresholdCrossing({ quantity: 5, threshold: 2, alreadyNotified: false }, 1);
    expect(crossed.enqueued).toBe(true);

    expect(
      applyThresholdCrossing({ quantity: 1, threshold: 2, alreadyNotified: crossed.alreadyNotified }, 1),
    ).toEqual({ alreadyNotified: true, enqueued: false });
  });

  it('resets already_notified above the threshold then re-enqueues on the next down-cross (baisser/remonter/rebaisser = 2 notifs)', () => {
    let state: ThresholdState = { quantity: 5, threshold: 2, alreadyNotified: false };
    let sent = 0;

    const cross = (quantity: number) => {
      const result = applyThresholdCrossing(state, quantity);
      state = { ...state, quantity, alreadyNotified: result.alreadyNotified };
      if (result.enqueued) sent += 1;
    };

    cross(1); // baisser → 1 notif
    cross(1); // reste bas → 0
    cross(5); // remonter → reset, 0
    expect(state.alreadyNotified).toBe(false);
    cross(0); // rebaisser → 1 notif

    expect(sent).toBe(2);
    expect(state.alreadyNotified).toBe(true);
  });

  it('never enqueues when the quantity stays above the threshold', () => {
    expect(applyThresholdCrossing({ quantity: 5, threshold: 2, alreadyNotified: false }, 4)).toEqual({
      alreadyNotified: false,
      enqueued: false,
    });
  });
});

// ─── Garde seed à l'INSERT (SQL §1b) ─────────────────────────────────────────
// create_household sème les items à quantité 0 alors que le foyer n'a qu'un
// membre : aucune pending row (aucun destinataire non-acteur).

function shouldEnqueueOnInsert(options: {
  quantity: number;
  threshold: number;
  alreadyNotified: boolean;
  hasOtherMember: boolean;
}): boolean {
  const { quantity, threshold, alreadyNotified, hasOtherMember } = options;
  return quantity <= threshold && alreadyNotified === false && hasOtherMember;
}

describe('threshold insert guard — single-member household enqueues nothing', () => {
  it('enqueues when a second member already exists', () => {
    expect(
      shouldEnqueueOnInsert({ quantity: 0, threshold: 1, alreadyNotified: false, hasOtherMember: true }),
    ).toBe(true);
  });

  it('skips the seed insert while the creator is the only member', () => {
    expect(
      shouldEnqueueOnInsert({ quantity: 0, threshold: 1, alreadyNotified: false, hasOtherMember: false }),
    ).toBe(false);
  });

  it('never enqueues above the threshold, even with another member', () => {
    expect(
      shouldEnqueueOnInsert({ quantity: 3, threshold: 1, alreadyNotified: false, hasOtherMember: true }),
    ).toBe(false);
  });
});

// ─── Sens unique : seul l'autre membre est notifié (PRD §4.6, P0-2) ──────────

function selectRecipients(memberIds: string[], actorId: string): string[] {
  return memberIds.filter((id) => id !== actorId);
}

describe('one-way notification — actor is never notified (P0-2)', () => {
  it('notifies only B when A crosses the threshold', () => {
    expect(selectRecipients(['user-a', 'user-b'], 'user-a')).toEqual(['user-b']);
  });

  it('notifies only A when B crosses the threshold', () => {
    expect(selectRecipients(['user-a', 'user-b'], 'user-b')).toEqual(['user-a']);
  });

  it('notifies nobody when the actor is the only member', () => {
    expect(selectRecipients(['user-a'], 'user-a')).toEqual([]);
  });
});

// ─── Canaux : push/both éligibles au push, badge/none non (SQL §3) ───────────

type Channel = 'push' | 'badge' | 'both' | 'none';

function isPushEligible(notificationType: Channel): boolean {
  return notificationType === 'push' || notificationType === 'both';
}

describe('notification channels (push/both vs badge/none)', () => {
  it.each(['push', 'both'] as Channel[])('sends push for %s', (type) => {
    expect(isPushEligible(type)).toBe(true);
  });

  it.each(['badge', 'none'] as Channel[])('skips push for %s', (type) => {
    expect(isPushEligible(type)).toBe(false);
  });
});

// ─── Signal to-buy : getLowStockItems (rappel quotidien §3) ──────────────────

const lowStockItem = (id: string, quantity: number, threshold: number): InventoryItem => ({
  id,
  name: id,
  category_id: null,
  category: undefined,
  quantity,
  low_stock_threshold: threshold,
  unit: 'unite',
  household_id: 'home-1',
  created_at: null,
  last_modified_at: null,
  last_modified_by: null,
  template_id: null,
  already_notified: false,
  updated_at: null,
});

describe('low-stock signal backing the reminder query', () => {
  it('flags items at or below threshold as to-buy', () => {
    const items = [
      lowStockItem('empty', 0, 1),
      lowStockItem('limit', 2, 2),
      lowStockItem('stocked', 3, 2),
    ];

    expect(getLowStockItems(items).map(({ id }) => id)).toEqual(['empty', 'limit']);
  });
});
