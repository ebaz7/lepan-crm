
import { Capacitor } from '@capacitor/core';
import { PushNotifications } from '@capacitor/push-notifications';
import { LocalNotifications } from '@capacitor/local-notifications';
import { Preferences } from '@capacitor/preferences';
import { apiCall } from './apiService';

const PREF_KEY = 'app_notification_pref';

export const isNotificationEnabledInApp = (): boolean => {
    return localStorage.getItem(PREF_KEY) !== 'false';
};

export const setNotificationPreference = (enabled: boolean) => {
    localStorage.setItem(PREF_KEY, String(enabled));
};

// Helper to convert VAPID key
function urlBase64ToUint8Array(base64String: string) {
  const padding = '='.repeat((4 - base64String.length % 4) % 4);
  const base64 = (base64String + padding)
    .replace(/\-/g, '+')
    .replace(/_/g, '/');
 
  const rawData = window.atob(base64);
  const outputArray = new Uint8Array(rawData.length);
 
  for (let i = 0; i < rawData.length; ++i) {
    outputArray[i] = rawData.charCodeAt(i);
  }
  return outputArray;
}

export const requestNotificationPermission = async (): Promise<boolean> => {
  if (Capacitor.isNativePlatform()) {
      try {
          const result = await PushNotifications.requestPermissions();
          const localResult = await LocalNotifications.requestPermissions();
          
          if (Capacitor.getPlatform() === 'android') {
              try {
                  await LocalNotifications.createChannel({
                      id: 'default',
                      name: 'Default',
                      description: 'General Notifications',
                      importance: 5,
                      visibility: 1,
                      vibration: true,
                  });
              } catch (e) {
                  console.error('Create channel failed', e);
              }
          }

          if (result.receive === 'granted' || localResult.display === 'granted') {
              await PushNotifications.register();
              return true;
          }
          return false;
      } catch (e) {
          console.error("Push Registration Error:", e);
          return false;
      }
  }

  // Web Logic
  if (!("Notification" in window)) return false;
  
  try {
      const permission = await Notification.requestPermission();
      if (permission === 'granted') {
          await subscribeToPushNotifications();
          return true;
      }
      return false;
  } catch (e) {
      console.error("Web Permission Error:", e);
      return false;
  }
};

export const subscribeToPushNotifications = async () => {
    if (Capacitor.isNativePlatform()) return; // Native handled by Capacitor plugin

    try {
        // 1. Get VAPID Key from Server
        const { publicKey } = await apiCall<{publicKey: string}>('/vapid-key');
        if (!publicKey) throw new Error("No VAPID key returned");

        // 2. Get Service Worker Registration
        const registration = await navigator.serviceWorker.ready;
        if (!registration) throw new Error("Service Worker not ready");

        // 3. Subscribe to Push Manager
        const convertedVapidKey = urlBase64ToUint8Array(publicKey);
        const subscription = await registration.pushManager.subscribe({
            userVisibleOnly: true,
            applicationServerKey: convertedVapidKey
        });

        // 4. Send Subscription to Server
        // We also send user info to allow targeting
        const userStr = localStorage.getItem('app_current_user');
        const user = userStr ? JSON.parse(userStr) : null;

        await apiCall('/subscribe', 'POST', {
            ...subscription.toJSON(),
            username: user?.username,
            role: user?.role,
            type: 'web'
        });

        console.log("✅ Web Push Subscribed Successfully");
    } catch (e) {
        console.error("Failed to subscribe to push:", e);
    }
};

const shownInMemory = new Set<string>();

export const syncNativeShownNotifications = async () => {
    if (!Capacitor.isNativePlatform()) return;
    try {
        const { keys } = await Preferences.keys();
        const shownIdsFromNative: string[] = [];
        for (const k of keys) {
            if (k.startsWith('shown_')) {
                const id = k.substring(6); // remove 'shown_'
                shownIdsFromNative.push(id);
            }
        }
        if (shownIdsFromNative.length > 0) {
            const key = 'shown_notifications_log';
            const raw = localStorage.getItem(key);
            const list: string[] = raw ? JSON.parse(raw) : [];
            let updated = false;
            for (const id of shownIdsFromNative) {
                shownInMemory.add(id);
                if (!list.includes(id)) {
                    list.push(id);
                    updated = true;
                }
            }
            if (updated) {
                if (list.length > 500) list.splice(0, list.length - 500);
                localStorage.setItem(key, JSON.stringify(list));
                console.log('[NativeSync] Synchronized native shown notifications count:', shownIdsFromNative.length);
            }
        }
    } catch (e) {
        console.error('Error synchronizing native shown notifications', e);
    }
};

export const hasNotificationBeenShown = (id: string): boolean => {
    if (!id) return false;
    if (shownInMemory.has(id)) return true;
    try {
        const key = 'shown_notifications_log';
        const raw = localStorage.getItem(key);
        const list: string[] = raw ? JSON.parse(raw) : [];
        const found = list.includes(id);
        if (found) {
            shownInMemory.add(id);
        }
        return found;
    } catch {
        return false;
    }
};

export const markNotificationAsShown = (id: string) => {
    if (!id) return;
    shownInMemory.add(id);
    try {
        const key = 'shown_notifications_log';
        const raw = localStorage.getItem(key);
        const list: string[] = raw ? JSON.parse(raw) : [];
        if (!list.includes(id)) {
            list.push(id);
            if (list.length > 500) {
                list.shift();
            }
            localStorage.setItem(key, JSON.stringify(list));
            
            // Sync to native SharedPreferences as well so background worker can see it!
            if (Capacitor.isNativePlatform()) {
                Preferences.set({ key: `shown_${id}`, value: 'true' }).catch(console.error);
            }
        }
    } catch (e) {
        console.error("markNotificationAsShown error", e);
    }
};

let lastNotificationString = '';
let lastNotificationTime = 0;

const getPwaIconUrl = (): string => {
  try {
    const cached = localStorage.getItem('app_data_settings');
    if (cached) {
      const parsed = JSON.parse(cached);
      if (parsed?.pwaIcon) {
        return parsed.pwaIcon;
      }
    }
  } catch (e) {
    console.error('Failed to parse settings for pwaIcon', e);
  }
  return '/pwa-192x192.png'; // default fallback
};

export const sendNotification = async (title: string, body: string, data?: any) => {
  if (!isNotificationEnabledInApp()) return;
  
  const idValue = data?.id || '';
  if (idValue && hasNotificationBeenShown(idValue)) {
      return; // Already notified on this device, do not duplicate!
  }

  const currentStr = `${title}:${body}`;
  const now = Date.now();
  if (currentStr === lastNotificationString && (now - lastNotificationTime < 5000)) {
      return; // Deduplicate identical notifications fired within 5 seconds
  }
  lastNotificationString = currentStr;
  lastNotificationTime = now;

  if (idValue) {
      markNotificationAsShown(idValue);
  }

  if (Capacitor.isNativePlatform()) {
      try {
          await LocalNotifications.schedule({
              notifications: [
                  {
                      title: title,
                      body: body,
                      id: Math.floor(Math.random() * 2147483647),
                      schedule: { at: new Date(Date.now() + 50) },
                      extra: data || null,
                      channelId: 'fcm_default_channel',
                      smallIcon: 'res://ic_launcher',
                      sound: 'default'
                  }
              ]
          });
      } catch (e) { console.error('LocalNotifications error', e); }
      return;
  }

  if (Notification.permission === "granted") {
      try {
          const iconUrl = getPwaIconUrl();
          // Check if SW is active to show via SW (more reliable)
          const registration = await navigator.serviceWorker.ready;
          if (registration && registration.active) {
              registration.showNotification(title, {
                  body,
                  icon: iconUrl,
                  dir: 'rtl',
                  lang: 'fa',
                  vibrate: [200, 100, 200],
                  data: data
              } as any);
          } else {
              new Notification(title, { body, icon: iconUrl, dir: 'rtl', lang: 'fa' });
          }
      } catch (e) {
          console.error("Web Notification Error:", e);
      }
  }
};
