import { supabaseAdmin } from './supabase-admin';

interface PushMessage {
  to: string;
  title: string;
  body: string;
  data?: Record<string, any>;
  sound?: 'default' | null;
  badge?: number;
  channelId?: string;
}

export async function sendPushNotification(
  pushToken: string,
  title: string,
  body: string,
  data?: Record<string, any>
): Promise<boolean> {
  try {
    const message: PushMessage = {
      to: pushToken,
      title,
      body,
      data: data || {},
      sound: 'default',
    };

    const response = await fetch('https://exp.host/--/api/v2/push/send', {
      method: 'POST',
      headers: {
        'Accept': 'application/json',
        'Accept-Encoding': 'gzip, deflate',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(message),
    });

    const result = await response.json();
    if (result.data?.status === 'error') {
      console.error('[Push] Error sending notification:', result.data.message);
      return false;
    }
    return true;
  } catch (err) {
    console.error('[Push] Failed to send notification:', err);
    return false;
  }
}

export async function sendBulkPushNotifications(
  messages: PushMessage[]
): Promise<{ sent: number; failed: number }> {
  let sent = 0;
  let failed = 0;

  const chunks: PushMessage[][] = [];
  for (let i = 0; i < messages.length; i += 100) {
    chunks.push(messages.slice(i, i + 100));
  }

  for (const chunk of chunks) {
    try {
      const response = await fetch('https://exp.host/--/api/v2/push/send', {
        method: 'POST',
        headers: {
          'Accept': 'application/json',
          'Accept-Encoding': 'gzip, deflate',
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(chunk),
      });

      const result = await response.json();
      if (Array.isArray(result.data)) {
        for (const r of result.data) {
          if (r.status === 'ok') sent++;
          else failed++;
        }
      }
    } catch (err) {
      console.error('[Push] Bulk send error:', err);
      failed += chunk.length;
    }
  }

  return { sent, failed };
}

type NotificationCategory =
  | 'contest_reminders'
  | 'results'
  | 'giveaway_alerts'
  | 'badge_awards'
  | 'streak_reminders'
  | 'crown_updates'
  | 'social_activity'
  | 'marketing'
  | 'live_game_updates';

export async function sendUserPushNotification(
  userId: string,
  title: string,
  body: string,
  category: NotificationCategory,
  data?: Record<string, any>
): Promise<boolean> {
  try {
    const { data: profile } = await supabaseAdmin
      .from('user_profiles')
      .select('push_token')
      .eq('id', userId)
      .single();

    if (!profile?.push_token) return false;

    const { data: prefs } = await supabaseAdmin
      .from('user_preferences')
      .select('*')
      .eq('user_id', userId)
      .single();

    if (prefs) {
      const prefKey = category as string;
      if (prefs[prefKey] === false) {
        return false;
      }
    }

    return await sendPushNotification(profile.push_token, title, body, data);
  } catch (err) {
    console.error('[Push] sendUserPushNotification error:', err);
    return false;
  }
}

export async function sendPushToMultipleUsers(
  userIds: string[],
  title: string,
  body: string,
  category: NotificationCategory,
  data?: Record<string, any>
): Promise<{ sent: number; failed: number; skipped: number }> {
  let skipped = 0;

  const { data: profiles } = await supabaseAdmin
    .from('user_profiles')
    .select('id, push_token')
    .in('id', userIds)
    .not('push_token', 'is', null);

  if (!profiles || profiles.length === 0) {
    return { sent: 0, failed: 0, skipped: userIds.length };
  }

  const tokenUserIds = profiles.map(p => p.id);

  const { data: allPrefs } = await supabaseAdmin
    .from('user_preferences')
    .select('*')
    .in('user_id', tokenUserIds);

  const prefsMap: Record<string, any> = {};
  for (const p of (allPrefs || [])) {
    prefsMap[p.user_id] = p;
  }

  const messages: PushMessage[] = [];
  for (const profile of profiles) {
    const userPrefs = prefsMap[profile.id];
    if (userPrefs && userPrefs[category] === false) {
      skipped++;
      continue;
    }
    messages.push({
      to: profile.push_token,
      title,
      body,
      data: data || {},
      sound: 'default',
    });
  }

  skipped += userIds.length - profiles.length;

  if (messages.length === 0) {
    return { sent: 0, failed: 0, skipped };
  }

  const result = await sendBulkPushNotifications(messages);
  return { ...result, skipped };
}
