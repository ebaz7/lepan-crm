
import { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.payment.system',
  appName: 'Payment Order System',
  webDir: 'dist',
  server: {
    //androidScheme: 'https', // این خط باعث می‌شود فایل‌ها از طریق پروتکل امن داخلی بارگذاری شوند
    cleartext: true, // اجازه دسترسی به API های http معمولی (لوکال شبکه)
    allowNavigation: ['*', 'http://*', 'https://*'] // اجازه درخواست به سرورهای خارجی
  },
  plugins: {
    PushNotifications: {
      presentationOptions: ["badge", "sound", "alert"]
    },
    Keyboard: {
      resize: 'body',
      style: 'dark',
      resizeOnFullScreen: true
    }
  },
  android: {
    allowMixedContent: true,
    backgroundColor: "#ffffff"
  }
};

export default config;
