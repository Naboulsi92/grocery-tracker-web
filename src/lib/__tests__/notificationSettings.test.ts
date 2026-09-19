import {
  loadNotificationSettings,
  saveNotificationSettings,
  type NotificationSettings,
} from '@/lib/notificationSettings';

type StoredProfile = { notification_type: string | null; reminder_time: string | null };

const data = jest.fn();
const update = jest.fn();
const eq = jest.fn();
let storedProfile: StoredProfile | null;
let queryError: { message: string } | null;
let updateError: { message: string } | null;

function fakeSupabase() {
  return {
    from: () => ({
      select: data,
      update,
      eq,
    }),
  } as never;
}

describe('notificationSettings', () => {
  const supabase = fakeSupabase();

  beforeEach(() => {
    jest.clearAllMocks();
    storedProfile = null;
    queryError = null;
    updateError = null;
    data.mockReturnThis();
    update.mockReturnThis();
    eq.mockImplementation(() => ({
      maybeSingle: () => Promise.resolve({ data: storedProfile, error: queryError }),
      then: (resolve: (result: { error: { message: string } | null }) => unknown) =>
        Promise.resolve({ error: updateError }).then(resolve),
    }));
  });

  describe('loadNotificationSettings', () => {
    it('loads and maps the stored notification type and reminder time', async () => {
      storedProfile = { notification_type: 'both', reminder_time: '19:30' };

      const result = await loadNotificationSettings(supabase, 'user-1');

      expect(eq).toHaveBeenCalledWith('id', 'user-1');
      expect(result).toEqual({
        settings: { notificationType: 'both', reminderTime: '19:30' },
        error: null,
      });
    });

    it('normalizes an unknown notification type to none', async () => {
      storedProfile = { notification_type: 'email', reminder_time: null };

      const result = await loadNotificationSettings(supabase, 'user-1');

      expect(result.settings).toEqual({ notificationType: 'none', reminderTime: null });
    });

    it('normalizes a legacy NULL notification type to none', async () => {
      storedProfile = { notification_type: null, reminder_time: null };

      const result = await loadNotificationSettings(supabase, 'user-1');

      expect(result.settings).toEqual({ notificationType: 'none', reminderTime: null });
    });

    it('persists the explicit none type', async () => {
      storedProfile = { notification_type: 'none', reminder_time: null };

      const result = await loadNotificationSettings(supabase, 'user-1');

      expect(result.settings).toEqual({ notificationType: 'none', reminderTime: null });
    });

    it('returns a readable error when the profile cannot be loaded', async () => {
      queryError = { message: 'connection failed' };

      const result = await loadNotificationSettings(supabase, 'user-1');

      expect(result.settings).toBeNull();
      expect(result.error).toBe('errors.notifications.load_failed');
    });
  });

  describe('saveNotificationSettings', () => {
    it('persists the notification type and reminder time on the profile', async () => {
      const settings: NotificationSettings = { notificationType: 'push', reminderTime: null };

      const result = await saveNotificationSettings(supabase, 'user-1', settings);

      expect(update).toHaveBeenCalledWith({ notification_type: 'push', reminder_time: null });
      expect(eq).toHaveBeenCalledWith('id', 'user-1');
      expect(result).toEqual({ error: null });
    });

    it('returns a readable error when the update fails', async () => {
      updateError = { message: 'connection failed' };

      const result = await saveNotificationSettings(supabase, 'user-1', {
        notificationType: 'badge',
        reminderTime: '07:00',
      });

      expect(result.error).toBe('errors.notifications.save_failed');
    });
  });
});