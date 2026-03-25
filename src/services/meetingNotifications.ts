import * as Notifications from 'expo-notifications';
import type { CalendarEvent } from '../db/schema';
import { getSetting } from '../db/queries';

export async function requestNotificationPermissions(): Promise<boolean> {
  const { status: existing } = await Notifications.getPermissionsAsync();
  if (existing === 'granted') return true;

  const { status } = await Notifications.requestPermissionsAsync();
  return status === 'granted';
}

export async function scheduleMeetingNotification(event: CalendarEvent): Promise<string | null> {
  // Check if notifications and meeting reminders are enabled
  const notificationsEnabled = await getSetting('notificationsEnabled');
  const meetingRemindersEnabled = await getSetting('meetingRemindersEnabled');
  if (notificationsEnabled === 'false' || meetingRemindersEnabled === 'false') return null;

  const triggerDate = new Date(event.startTime);
  triggerDate.setSeconds(triggerDate.getSeconds() - 60); // 1 minute before

  // Don't schedule notifications in the past
  if (triggerDate.getTime() <= Date.now()) return null;

  const id = await Notifications.scheduleNotificationAsync({
    content: {
      title: `Meeting starting: ${event.title}`,
      body: 'Tap to start recording',
      data: { eventId: event.id, action: 'auto-record' },
      sound: true,
    },
    trigger: { date: triggerDate, type: Notifications.SchedulableTriggerInputTypes.DATE },
  });

  return id;
}

export async function cancelAllMeetingNotifications(): Promise<void> {
  await Notifications.cancelAllScheduledNotificationsAsync();
}

export async function scheduleNotificationsForEvents(events: CalendarEvent[]): Promise<void> {
  // Cancel existing meeting notifications and reschedule
  await cancelAllMeetingNotifications();

  for (const event of events) {
    if (event.autoRecord) {
      await scheduleMeetingNotification(event);
    }
  }
}
