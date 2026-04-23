/**
 * Push notification service for study reminders.
 * Uses @notifee/react-native to schedule a daily local notification.
 */
import notifee, {
  AndroidImportance,
  TimestampTrigger,
  TriggerType,
  RepeatFrequency,
  AuthorizationStatus,
} from '@notifee/react-native';
import { Platform } from 'react-native';

const REMINDER_CHANNEL_ID = 'study-reminder';
const REMINDER_NOTIFICATION_ID = 'daily-study-reminder';

/**
 * Request notification permissions from the OS.
 * Returns true if granted.
 */
export async function requestNotificationPermissions(): Promise<boolean> {
  try {
    if (Platform.OS === 'android') {
      await notifee.createChannel({
        id: REMINDER_CHANNEL_ID,
        name: 'Нагадування про навчання',
        importance: AndroidImportance.DEFAULT,
        vibration: true,
        vibrationPattern: [0, 250, 250, 250],
      });
    }

    const settings = await notifee.requestPermission();
    return (
      settings.authorizationStatus === AuthorizationStatus.AUTHORIZED ||
      settings.authorizationStatus === AuthorizationStatus.PROVISIONAL
    );
  } catch {
    return false;
  }
}

/**
 * Schedule a repeating daily notification at the given hour:minute.
 * Cancels any previous reminder first.
 */
export async function scheduleStudyReminder(hour: number, minute: number): Promise<boolean> {
  try {
    const granted = await requestNotificationPermissions();

    if (!granted) {
      return false;
    }

    // Cancel existing reminder before scheduling a new one
    await cancelStudyReminder();

    // Build next trigger time
    const now = new Date();
    const trigger = new Date();
    trigger.setHours(hour, minute, 0, 0);

    // If time already passed today — schedule for tomorrow
    if (trigger.getTime() <= now.getTime()) {
      trigger.setDate(trigger.getDate() + 1);
    }

    const timestampTrigger: TimestampTrigger = {
      type: TriggerType.TIMESTAMP,
      timestamp: trigger.getTime(),
      repeatFrequency: RepeatFrequency.DAILY,
    };

    await notifee.createTriggerNotification(
      {
        id: REMINDER_NOTIFICATION_ID,
        title: '📚 Час вчити англійську!',
        body: 'Сьогоднішня сесія чекає. Відкрий LangAI й зроби декілька вправ.',
        android: {
          channelId: REMINDER_CHANNEL_ID,
          smallIcon: 'ic_launcher',
        },
      },
      timestampTrigger
    );

    return true;
  } catch {
    return false;
  }
}

/**
 * Cancel the daily study reminder if it exists.
 */
export async function cancelStudyReminder(): Promise<void> {
  try {
    await notifee.cancelNotification(REMINDER_NOTIFICATION_ID);
  } catch {
    // Notification may not exist — that's fine
  }
}

/**
 * Returns true if a study reminder is currently scheduled.
 */
export async function isReminderScheduled(): Promise<boolean> {
  try {
    const triggered = await notifee.getTriggerNotifications();
    return triggered.some((n) => n.notification.id === REMINDER_NOTIFICATION_ID);
  } catch {
    return false;
  }
}
