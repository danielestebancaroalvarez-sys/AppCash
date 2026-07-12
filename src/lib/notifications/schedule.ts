import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';
import { listFixedItems, upsertNotification } from '@/lib/db';
import { createId } from '@/lib/id';
import { addDaysIso, nowIso } from '@/lib/dates';
import { formatAud } from '@/lib/money';
import { queueMutation } from '@/lib/sync/engine';

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowBanner: true,
    shouldShowList: true,
    shouldPlaySound: true,
    shouldSetBadge: false,
  }),
});

export async function ensureNotificationPermissions(): Promise<boolean> {
  const settings = await Notifications.getPermissionsAsync();
  if (settings.granted) return true;
  const req = await Notifications.requestPermissionsAsync();
  return req.granted;
}

export async function scheduleFixedItemReminders(): Promise<number> {
  const granted = await ensureNotificationPermissions();
  if (!granted) return 0;

  await Notifications.cancelAllScheduledNotificationsAsync();
  const items = (await listFixedItems()).filter((i) => i.active && !i.auto_debit);
  let count = 0;

  for (const item of items) {
    const dueDate = addDaysIso(item.next_due, -item.notify_days_before);
    const triggerDate = new Date(`${dueDate}T09:00:00`);
    if (triggerDate.getTime() <= Date.now()) continue;

    await Notifications.scheduleNotificationAsync({
      content: {
        title: `Pay ${item.name}`,
        body: `Manual payment of ${formatAud(item.amount_aud)} is due on ${item.next_due}.`,
      },
      trigger: {
        type: Notifications.SchedulableTriggerInputTypes.DATE,
        date: triggerDate,
        channelId: Platform.OS === 'android' ? 'payments' : undefined,
      },
    });

    const n = {
      id: createId(),
      user_id: item.user_id,
      title: `Pay ${item.name}`,
      body: `Manual payment of ${formatAud(item.amount_aud)} due ${item.next_due}.`,
      due_at: dueDate,
      related_fixed_id: item.id,
      status: 'pending' as const,
      updated_at: nowIso(),
    };
    await upsertNotification(n);
    await queueMutation('notifications', n);
    count += 1;
  }

  if (Platform.OS === 'android') {
    await Notifications.setNotificationChannelAsync('payments', {
      name: 'Payment reminders',
      importance: Notifications.AndroidImportance.DEFAULT,
    });
  }

  return count;
}
