package cz.reis.app;

import android.content.Context;
import android.util.Log;

import java.io.File;
import java.io.FileWriter;
import java.text.SimpleDateFormat;
import java.util.Date;
import java.util.Locale;

/**
 * One line per background run, in logcat and in a small file in the app's
 * external files dir (readable with adb, where the release build has no
 * run-as). Timings and states only: never a subject, a grade or a token.
 */
final class BgLog {
    private static final String TAG = "ReisBg";
    private static final long MAX_BYTES = 64 * 1024;
    private static final SimpleDateFormat FMT = new SimpleDateFormat("yyyy-MM-dd HH:mm:ss.SSS", Locale.US);

    static synchronized void line(Context ctx, String msg) {
        String stamped = FMT.format(new Date()) + " " + msg;
        Log.i(TAG, stamped);
        try {
            File dir = ctx.getExternalFilesDir(null);
            if (dir == null) return;
            File f = new File(dir, "bgcheck.log");
            if (f.length() > MAX_BYTES) f.delete();
            try (FileWriter w = new FileWriter(f, true)) {
                w.write(stamped + "\n");
            }
        } catch (Exception ignored) {
        }
    }

    private BgLog() {}
}
