package com.payment.system;

import android.app.NotificationChannel;
import android.app.NotificationManager;
import android.app.PendingIntent;
import android.content.Context;
import android.content.Intent;
import android.content.SharedPreferences;
import android.os.Build;
import android.util.Log;
import androidx.annotation.NonNull;
import androidx.core.app.NotificationCompat;
import androidx.work.Worker;
import androidx.work.WorkerParameters;
import org.json.JSONArray;
import org.json.JSONObject;
import java.io.BufferedReader;
import java.io.InputStreamReader;
import java.net.HttpURLConnection;
import java.net.URL;

public class SyncWorker extends Worker {
    private static final String TAG = "SyncWorker";
    private static final String PREFS_NAME = "CapacitorStorage";
    private static final String DEFAULT_SERVER_URL = "https://dlkam.ir";

    public SyncWorker(@NonNull Context context, @NonNull WorkerParameters workerParams) {
        super(context, workerParams);
    }

    @NonNull
    @Override
    public Result doWork() {
        Log.d(TAG, "Background synchronization started...");
        
        try {
            // Retrieve configuration values from preferences (synchronized from web interface)
            SharedPreferences prefs = getApplicationContext().getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE);
            String serverUrl = prefs.getString("server_url", DEFAULT_SERVER_URL);
            String currentUserRaw = prefs.getString("current_user", "");
            
            if (serverUrl == null || serverUrl.isEmpty()) {
                serverUrl = DEFAULT_SERVER_URL;
            }
            if (serverUrl.endsWith("/")) {
                serverUrl = serverUrl.substring(0, serverUrl.length() - 1);
            }

            Log.d(TAG, "Syncing with Server: " + serverUrl);
            
            // Fetch unread notifications
            URL url = new URL(serverUrl + "/api/notifications/unread");
            HttpURLConnection conn = (HttpURLConnection) url.openConnection();
            conn.setRequestMethod("GET");
            conn.setConnectTimeout(10000);
            conn.setReadTimeout(10000);
            conn.setRequestProperty("Content-Type", "application/json");
            
            int responseCode = conn.getResponseCode();
            if (responseCode == HttpURLConnection.HTTP_OK) {
                BufferedReader in = new BufferedReader(new InputStreamReader(conn.getInputStream()));
                StringBuilder response = new StringBuilder();
                String inputLine;
                while ((inputLine = in.readLine()) != null) {
                    response.append(inputLine);
                }
                in.close();

                Log.d(TAG, "Raw Response: " + response.toString());
                
                // Parse the response
                JSONArray notifications = new JSONArray(response.toString());
                int newNotifCount = 0;
                
                for (int i = 0; i < notifications.length(); i++) {
                    JSONObject notif = notifications.getJSONObject(i);
                    String id = notif.optString("id", "");
                    String title = notif.optString("title", "اعلان جدید");
                    String body = notif.optString("body", "");
                    
                    // Filter or check if already notified on this device locally
                    SharedPreferences logPrefs = getApplicationContext().getSharedPreferences("shown_notifications_log", Context.MODE_PRIVATE);
                    if (!logPrefs.getBoolean(id, false)) {
                        // Show native notification
                        showNativeNotification(id, title, body);
                        logPrefs.edit().putBoolean(id, true).apply();
                        newNotifCount++;
                    }
                }
                Log.d(TAG, "Background sync completed successfully. Displayed " + newNotifCount + " new notifications.");
            } else {
                Log.e(TAG, "Server returned response code: " + responseCode);
            }
            
        } catch (Exception e) {
            Log.e(TAG, "Error performing background synchronization", e);
            return Result.retry();
        }

        return Result.success();
    }

    private void showNativeNotification(String id, String title, String body) {
        Context context = getApplicationContext();
        NotificationManager notificationManager = (NotificationManager) context.getSystemService(Context.NOTIFICATION_SERVICE);
        String channelId = "fcm_default_channel";

        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            NotificationChannel channel = notificationManager.getNotificationChannel(channelId);
            if (channel == null) {
                channel = new NotificationChannel(channelId, "اعلان‌های سیستم خروج و پرداخت", NotificationManager.IMPORTANCE_HIGH);
                channel.setDescription("کانال اصلی اعلان‌های پرداخت و برگه خروج کارخانه");
                channel.enableVibration(true);
                channel.setVibrationPattern(new long[]{100, 200, 300, 400, 500, 400, 300, 200, 400});
                notificationManager.createNotificationChannel(channel);
            }
        }

        // Action when notification is clicked - Open MainActivity
        Intent intent = new Intent(context, MainActivity.class);
        intent.addFlags(Intent.FLAG_ACTIVITY_CLEAR_TOP);
        PendingIntent pendingIntent;
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M) {
            pendingIntent = PendingIntent.getActivity(context, id.hashCode(), intent, PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE);
        } else {
            pendingIntent = PendingIntent.getActivity(context, id.hashCode(), intent, PendingIntent.FLAG_UPDATE_CURRENT);
        }

        NotificationCompat.Builder builder = new NotificationCompat.Builder(context, channelId)
                .setSmallIcon(android.R.drawable.ic_dialog_info)
                .setContentTitle(title)
                .setContentText(body)
                .setAutoCancel(true)
                .setPriority(NotificationCompat.PRIORITY_HIGH)
                .setContentIntent(pendingIntent)
                .setVibrate(new long[]{100, 200, 300, 400, 500});

        notificationManager.notify(id.hashCode(), builder.build());
    }
}
