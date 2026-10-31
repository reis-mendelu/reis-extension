package cz.reis.app;

import android.app.Notification;
import android.app.NotificationChannel;
import android.app.NotificationManager;
import android.app.PendingIntent;
import android.content.Context;
import android.content.Intent;
import android.os.Build;
import android.service.notification.StatusBarNotification;

import androidx.core.app.NotificationCompat;
import androidx.core.app.NotificationManagerCompat;

import org.json.JSONArray;
import org.json.JSONObject;

/**
 * Posts what the background check found. Native rather than through
 * @capacitor/local-notifications, which needs the Capacitor Bridge and so an
 * Activity; the job has neither. One channel per kind, created up front (at
 * launch, with the student's language) so a channel the student silenced in
 * Settings stays silenced and can be read back.
 */
final class BackgroundNotifier {
    static final String TAG = "reis-bg";
    static final String[] KINDS = {"exams", "boxes", "points"};

    private static String channelId(String kind) {
        return "reis-bg-" + kind;
    }

    /** `names` maps kind to its channel name; a kind missing from it keeps its old name. */
    static void ensureChannels(Context c, JSONObject names) {
        if (Build.VERSION.SDK_INT < 26) return;
        NotificationManager nm = c.getSystemService(NotificationManager.class);
        for (String kind : KINDS) {
            String name = names != null ? names.optString(kind, "") : "";
            if (name.isEmpty()) {
                if (nm.getNotificationChannel(channelId(kind)) != null) continue;
                name = kind;
            }
            // Re-creating an existing channel only renames it; the student's own
            // importance and sound choices are kept by the system.
            nm.createNotificationChannel(
                new NotificationChannel(channelId(kind), name, NotificationManager.IMPORTANCE_HIGH)
            );
        }
    }

    /** `json` is [{kind, title, body}], composed in TypeScript so one place owns the words. */
    static void post(Context c, String json) {
        try {
            if (!NotificationManagerCompat.from(c).areNotificationsEnabled()) {
                BgLog.line(c, "notifications are off; nothing posted");
                return;
            }
            ensureChannels(c, null);
            JSONArray list = new JSONArray(json);
            Intent open = c.getPackageManager().getLaunchIntentForPackage(c.getPackageName());
            if (open != null) open.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK | Intent.FLAG_ACTIVITY_CLEAR_TOP);
            for (int i = 0; i < list.length(); i++) {
                JSONObject n = list.getJSONObject(i);
                String kind = n.getString("kind");
                // Seconds since the epoch, as the other notifications do: two runs
                // each finding something must be two notifications, not one replaced.
                int id = (int) (System.currentTimeMillis() / 1000) + i;
                PendingIntent tap = open == null ? null
                    : PendingIntent.getActivity(c, id, open, PendingIntent.FLAG_IMMUTABLE | PendingIntent.FLAG_UPDATE_CURRENT);
                Notification built = new NotificationCompat.Builder(c, channelId(kind))
                    .setSmallIcon(R.drawable.ic_stat_reis)
                    .setContentTitle(n.getString("title"))
                    .setContentText(n.optString("body"))
                    .setStyle(new NotificationCompat.BigTextStyle().bigText(n.optString("body")))
                    .setContentIntent(tap)
                    .setAutoCancel(true)
                    .setPriority(NotificationCompat.PRIORITY_HIGH)
                    .build();
                NotificationManagerCompat.from(c).notify(TAG, id, built);
            }
            BgLog.line(c, "posted " + list.length());
        } catch (SecurityException e) {
            BgLog.line(c, "notification permission missing");
        } catch (Exception e) {
            BgLog.line(c, "post failed " + e.getClass().getSimpleName());
        }
    }

    /** Sign-out: the next person on this phone must not see this student's notifications. */
    static void clearAll(Context c) {
        NotificationManager nm = c.getSystemService(NotificationManager.class);
        for (StatusBarNotification s : nm.getActiveNotifications()) {
            if (TAG.equals(s.getTag())) nm.cancel(s.getTag(), s.getId());
        }
    }

    private BackgroundNotifier() {}
}
