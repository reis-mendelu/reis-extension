package cz.reis.app;

import android.app.Notification;
import android.app.NotificationChannel;
import android.app.NotificationManager;
import android.app.PendingIntent;
import android.content.ContentResolver;
import android.content.ContentValues;
import android.content.Context;
import android.content.Intent;
import android.net.Uri;
import android.os.Build;
import android.os.Environment;
import android.provider.MediaStore;
import android.util.Base64;

import androidx.core.content.FileProvider;

import android.Manifest;
import android.content.pm.PackageManager;

import androidx.core.content.ContextCompat;

import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;
import com.getcapacitor.annotation.Permission;
import com.getcapacitor.annotation.PermissionCallback;

import java.io.File;
import java.io.FileOutputStream;
import java.io.OutputStream;

/**
 * Saves a file into the user's Downloads folder and posts a system notification
 * that opens it — i.e. what every browser does, and what Capacitor's own
 * Filesystem plugin cannot do (its Directory enum has no Downloads member).
 *
 * Android-only on purpose. iOS has no Downloads folder; there the Files/share
 * sheet IS the native pattern, so the JS side keeps using Share on iOS.
 */
@CapacitorPlugin(
        name = "Downloads",
        permissions = {
                @Permission(alias = DownloadsPlugin.NOTIFICATIONS, strings = {
                        Manifest.permission.POST_NOTIFICATIONS
                })
        })
public class DownloadsPlugin extends Plugin {

    static final String NOTIFICATIONS = "notifications";

    private static final String CHANNEL_ID = "reis-downloads";

    /**
     * POST_NOTIFICATIONS is a RUNTIME grant on Android 13+, and nothing ever
     * asked for it — so notifyDownloaded's nm.notify() was dropped on the floor
     * and every download completed with no visible sign whatsoever (verified on
     * device: the file saved, granted=false, student saw nothing).
     *
     * Requested from the download path rather than at boot so the prompt appears
     * when the student has just asked for a file, which is both the Android
     * guidance and the only moment the request makes sense. Deliberately
     * fire-and-forget: the save itself must never wait on, or fail because of,
     * a notification permission. The in-app toast is the real confirmation; this
     * only buys back the tap-to-open notification.
     */
    @PluginMethod
    public void requestNotificationPermission(PluginCall call) {
        if (Build.VERSION.SDK_INT < Build.VERSION_CODES.TIRAMISU || hasNotificationPermission()) {
            call.resolve(new JSObject().put("granted", hasNotificationPermission()));
            return;
        }
        requestPermissionForAlias(NOTIFICATIONS, call, "notificationPermissionResult");
    }

    @PermissionCallback
    private void notificationPermissionResult(PluginCall call) {
        call.resolve(new JSObject().put("granted", hasNotificationPermission()));
    }

    private boolean hasNotificationPermission() {
        if (Build.VERSION.SDK_INT < Build.VERSION_CODES.TIRAMISU) return true;
        return ContextCompat.checkSelfPermission(
                getContext(), Manifest.permission.POST_NOTIFICATIONS)
                == PackageManager.PERMISSION_GRANTED;
    }

    @PluginMethod
    public void save(PluginCall call) {
        String filename = call.getString("filename");
        String base64 = call.getString("base64");
        String mime = call.getString("mime", "application/octet-stream");

        if (filename == null || base64 == null) {
            call.reject("save requires filename and base64");
            return;
        }

        // The JS side sanitises too (src/mobile/safeFilename.ts), but this is a
        // plugin surface reachable from any script in the WebView, and the
        // pre-API-29 branch below builds a real path out of this value. Keeping
        // it to a basename here means the traversal cannot depend on the caller.
        filename = new File(filename).getName();
        if (filename.isEmpty() || filename.equals(".") || filename.equals("..")) {
            call.reject("save requires a filename, not a directory reference");
            return;
        }

        try {
            byte[] bytes = Base64.decode(base64, Base64.DEFAULT);
            Uri uri = writeToDownloads(filename, mime, bytes);
            if (uri == null) {
                call.reject("Could not open a Downloads entry for " + filename);
                return;
            }
            notifyDownloaded(filename, mime, uri);

            JSObject ret = new JSObject();
            ret.put("uri", uri.toString());
            ret.put("bytes", bytes.length);
            call.resolve(ret);
        } catch (Exception e) {
            call.reject(e.getClass().getSimpleName() + ": " + e.getMessage(), e);
        }
    }

    /**
     * API 29+ must go through MediaStore — scoped storage forbids writing into
     * shared Downloads by path. Below that, the public directory still works.
     */
    private Uri writeToDownloads(String filename, String mime, byte[] bytes) throws Exception {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) {
            ContentResolver resolver = getContext().getContentResolver();
            ContentValues values = new ContentValues();
            values.put(MediaStore.Downloads.DISPLAY_NAME, filename);
            values.put(MediaStore.Downloads.MIME_TYPE, mime);
            // IS_PENDING hides a half-written file from other apps until the
            // stream is closed, so nothing can open a truncated PDF.
            values.put(MediaStore.Downloads.IS_PENDING, 1);

            Uri uri = resolver.insert(MediaStore.Downloads.EXTERNAL_CONTENT_URI, values);
            if (uri == null) return null;

            try (OutputStream out = resolver.openOutputStream(uri)) {
                if (out == null) return null;
                out.write(bytes);
            }
            values.clear();
            values.put(MediaStore.Downloads.IS_PENDING, 0);
            resolver.update(uri, values, null, null);
            return uri;
        }

        File dir = Environment.getExternalStoragePublicDirectory(Environment.DIRECTORY_DOWNLOADS);
        if (!dir.exists() && !dir.mkdirs()) return null;
        File target = new File(dir, filename);
        try (FileOutputStream out = new FileOutputStream(target)) {
            out.write(bytes);
        }
        return FileProvider.getUriForFile(
                getContext(), getContext().getPackageName() + ".fileprovider", target);
    }

    private void notifyDownloaded(String filename, String mime, Uri uri) {
        // Without the runtime grant nm.notify() is a silent no-op on Android
        // 13+. Returning early keeps that fact visible in the code instead of
        // pretending a notification was posted.
        if (!hasNotificationPermission()) return;

        NotificationManager nm =
                (NotificationManager) getContext().getSystemService(Context.NOTIFICATION_SERVICE);
        if (nm == null) return;

        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            NotificationChannel channel = new NotificationChannel(
                    CHANNEL_ID, "Stažené soubory", NotificationManager.IMPORTANCE_DEFAULT);
            nm.createNotificationChannel(channel);
        }

        Intent view = new Intent(Intent.ACTION_VIEW)
                .setDataAndType(uri, mime)
                .addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION | Intent.FLAG_ACTIVITY_NEW_TASK);

        int flags = PendingIntent.FLAG_UPDATE_CURRENT;
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M) {
            flags |= PendingIntent.FLAG_IMMUTABLE;
        }
        PendingIntent pending = PendingIntent.getActivity(
                getContext(), filename.hashCode(), view, flags);

        Notification.Builder b = Build.VERSION.SDK_INT >= Build.VERSION_CODES.O
                ? new Notification.Builder(getContext(), CHANNEL_ID)
                : new Notification.Builder(getContext());

        nm.notify(filename.hashCode(), b
                .setContentTitle(filename)
                .setContentText("Staženo")
                .setSmallIcon(android.R.drawable.stat_sys_download_done)
                .setContentIntent(pending)
                .setAutoCancel(true)
                .build());
    }
}
