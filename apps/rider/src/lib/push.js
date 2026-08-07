import { Platform } from 'react-native';
import * as Notifications from 'expo-notifications';
import Constants from 'expo-constants';
import { supabase } from './supabase';

// Show the banner even when the app is open — a rider staring at the order
// list still needs to know a new one landed.
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: false,
  }),
});

/**
 * Registers this device for push and stores the token against the rider.
 *
 * Returns null when permission is refused — riders can decline and still use
 * the app, they just have to look at it themselves.
 */
export async function registerForPush(userId) {
  const existing = await Notifications.getPermissionsAsync();
  let granted = existing.granted;

  if (!granted) {
    const asked = await Notifications.requestPermissionsAsync();
    granted = asked.granted;
  }
  if (!granted) return null;

  if (Platform.OS === 'android') {
    // Must match the channelId the database sends, or Android silently
    // downgrades the notification to the default channel.
    await Notifications.setNotificationChannelAsync('orders', {
      name: 'New orders',
      importance: Notifications.AndroidImportance.MAX,
      sound: 'default',
      vibrationPattern: [0, 250, 250, 250],
    });
  }

  const projectId = Constants.expoConfig?.extra?.eas?.projectId;
  if (!projectId) {
    throw new Error('Missing EAS projectId in app.json — run `eas init`.');
  }

  const { data: token } = await Notifications.getExpoPushTokenAsync({ projectId });

  // Keyed on the token, not the user: reinstalling gives a new token, and the
  // same phone lent to another rider should move the token, not duplicate it.
  const { error } = await supabase.from('push_tokens').upsert(
    {
      user_id: userId,
      token,
      platform: Platform.OS,
      updated_at: new Date().toISOString(),
    },
    { onConflict: 'token' },
  );

  if (error) throw error;
  return token;
}

/** Called on sign-out so a shared phone stops receiving the old rider's orders. */
export async function unregisterPush() {
  try {
    const projectId = Constants.expoConfig?.extra?.eas?.projectId;
    if (!projectId) return;
    const { data: token } = await Notifications.getExpoPushTokenAsync({ projectId });
    await supabase.from('push_tokens').delete().eq('token', token);
  } catch {
    // Signing out must never fail because of a notification cleanup.
  }
}
