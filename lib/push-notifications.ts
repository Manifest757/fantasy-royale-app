import { useState, useEffect, useRef } from 'react';
import { Platform } from 'react-native';
import { router } from 'expo-router';
import { supabase } from './supabase';
import { getApiUrl } from './supabase-data';

let Notifications: typeof import('expo-notifications') | null = null;
let notificationsInitialized = false;

async function getNotifications() {
  if (Platform.OS === 'web') return null;
  if (Notifications) return Notifications;
  try {
    Notifications = await import('expo-notifications');
    return Notifications;
  } catch {
    return null;
  }
}

async function initNotificationHandler() {
  if (notificationsInitialized || Platform.OS === 'web') return;
  notificationsInitialized = true;
  try {
    const N = await getNotifications();
    if (!N) return;
    N.setNotificationHandler({
      handleNotification: async () => ({
        shouldShowAlert: true,
        shouldPlaySound: true,
        shouldSetBadge: true,
        shouldShowBanner: true,
        shouldShowList: true,
      }),
    });
  } catch {
  }
}

export async function registerForPushNotificationsAsync(): Promise<string | null> {
  if (Platform.OS === 'web') return null;

  try {
    const N = await getNotifications();
    if (!N) return null;

    await initNotificationHandler();

    const { status: existingStatus } = await N.getPermissionsAsync();
    let finalStatus = existingStatus;

    if (existingStatus !== 'granted') {
      const { status } = await N.requestPermissionsAsync();
      finalStatus = status;
    }

    if (finalStatus !== 'granted') {
      console.log('[Push] Permission not granted');
      return null;
    }

    if (Platform.OS === 'android') {
      try {
        await N.setNotificationChannelAsync('default', {
          name: 'Default',
          importance: N.AndroidImportance.MAX,
        });
      } catch {
      }
    }

    let Constants: typeof import('expo-constants')['default'] | null = null;
    try {
      Constants = (await import('expo-constants')).default;
    } catch {
      console.log('[Push] expo-constants not available');
      return null;
    }

    const projectId = Constants?.expoConfig?.extra?.eas?.projectId ?? (Constants as any)?.easConfig?.projectId;

    if (!projectId) {
      console.log('[Push] No EAS project ID configured, skipping push token registration');
      return null;
    }

    const tokenData = await N.getExpoPushTokenAsync({ projectId });
    return tokenData.data;
  } catch (err) {
    console.log('[Push] Could not get push token:', err);
    return null;
  }
}

async function savePushToken(token: string): Promise<void> {
  try {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session?.access_token) return;

    const apiUrl = getApiUrl().replace(/\/$/, '');
    await fetch(`${apiUrl}/api/me/push-token`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${session.access_token}`,
      },
      body: JSON.stringify({ push_token: token }),
    });
  } catch (err) {
    console.log('[Push] Error saving push token:', err);
  }
}

export function usePushNotifications(isAuthenticated: boolean) {
  const [expoPushToken, setExpoPushToken] = useState<string | null>(null);
  const listenersRef = useRef<{ notification?: any; response?: any }>({});

  useEffect(() => {
    if (!isAuthenticated || Platform.OS === 'web') return;

    let cancelled = false;

    (async () => {
      try {
        const token = await registerForPushNotificationsAsync();
        if (token && !cancelled) {
          setExpoPushToken(token);
          savePushToken(token);
        }
      } catch {
      }

      try {
        const N = await getNotifications();
        if (!N || cancelled) return;

        listenersRef.current.notification = N.addNotificationReceivedListener(notification => {
          console.log('[Push] Notification received:', notification.request.content.title);
        });

        listenersRef.current.response = N.addNotificationResponseReceivedListener(response => {
          const data = response.notification.request.content.data;
          if (data?.route) {
            router.push(data.route as string);
          } else if (data?.contestId) {
            router.push(`/bracket/${data.contestId}`);
          }
        });
      } catch {
      }
    })();

    return () => {
      cancelled = true;
      (async () => {
        try {
          const N = await getNotifications();
          if (!N) return;
          if (listenersRef.current.notification) {
            N.removeNotificationSubscription(listenersRef.current.notification);
          }
          if (listenersRef.current.response) {
            N.removeNotificationSubscription(listenersRef.current.response);
          }
        } catch {
        }
      })();
    };
  }, [isAuthenticated]);

  return { expoPushToken };
}
