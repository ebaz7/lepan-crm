
import { Capacitor } from '@capacitor/core';
import { PushNotifications } from '@capacitor/push-notifications';
import { LocalNotifications } from '@capacitor/local-notifications';
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
          if (result.receive === 'granted') {
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
        const userStr = localStorage.getItem('currentUser');
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

export const sendNotification = async (title: string, body: string) => {
  if (!isNotificationEnabledInApp()) return;

  if (Capacitor.isNativePlatform()) {
      try {
          await LocalNotifications.schedule({
              notifications: [
                  {
                      title: title,
                      body: body,
                      id: new Date().getTime(),
                      schedule: { at: new Date(Date.now() + 100) },
                      sound: 'beep.wav',
                      smallIcon: 'ic_stat_icon_config_sample', 
                      actionTypeId: "",
                      extra: null
                  }
              ]
          });
      } catch (e) {}
      return;
  }

  if (Notification.permission === "granted") {
      try {
          // Check if SW is active to show via SW (more reliable)
          const registration = await navigator.serviceWorker.ready;
          if (registration && registration.active) {
              registration.showNotification(title, {
                  body,
                  icon: '/pwa-192x192.png',
                  dir: 'rtl',
                  lang: 'fa',
                  vibrate: [200, 100, 200]
              } as any);
          } else {
              new Notification(title, { body, icon: '/pwa-192x192.png', dir: 'rtl', lang: 'fa' });
          }
      } catch (e) {
          console.error("Web Notification Error:", e);
      }
  }
};
