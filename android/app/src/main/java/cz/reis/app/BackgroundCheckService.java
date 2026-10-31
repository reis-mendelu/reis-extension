package cz.reis.app;

import android.app.ActivityManager;
import android.app.job.JobInfo;
import android.app.job.JobParameters;
import android.app.job.JobScheduler;
import android.app.job.JobService;
import android.content.ComponentName;
import android.content.Context;
import android.content.SharedPreferences;
import android.os.Build;
import android.os.SystemClock;

/**
 * The phone's background check. Every ~15 minutes (the platform minimum, and
 * Android batches it under Doze) Android starts this service; it loads the
 * bundled app headless in a hidden WebView (BackgroundWebRun), which compares
 * IS with what the device has already seen and posts a notification for what
 * is new. Nothing leaves the device but the requests to IS.
 *
 * JobScheduler rather than WorkManager: WorkManager only wraps it, and this
 * needs no more than a periodic job with a network constraint.
 */
public class BackgroundCheckService extends JobService {
    private static final int JOB_ID = 4201;
    private static final long PERIOD_MS = 15 * 60 * 1000L;
    private static final String PREFS = "reis_background_check";
    private static final String KEY_ENABLED = "enabled";
    /** The key tokenStore.ts keeps the IS session under, in SecureStorePlugin's prefs file. */
    private static final String TOKEN_KEY = "reis.session.uisAuth";

    /** The job runs in the app's own process, so a static is the truth about the foreground app. */
    static volatile boolean appInForeground;

    private BackgroundWebRun run;
    private long startedAt;

    static boolean isEnabled(Context c) {
        return c.getSharedPreferences(PREFS, Context.MODE_PRIVATE).getBoolean(KEY_ENABLED, true);
    }

    static void setEnabled(Context c, boolean enabled) {
        SharedPreferences.Editor e = c.getSharedPreferences(PREFS, Context.MODE_PRIVATE).edit();
        e.putBoolean(KEY_ENABLED, enabled).apply();
        if (enabled) schedule(c);
        else cancel(c);
    }

    /** Idempotent; a pending job (which survives an app update) is left alone. */
    static void schedule(Context c) {
        try {
            if (!isEnabled(c)) return;
            JobScheduler js = c.getSystemService(JobScheduler.class);
            if (js.getPendingJob(JOB_ID) != null) return;
            int r = js.schedule(
                new JobInfo.Builder(JOB_ID, new ComponentName(c, BackgroundCheckService.class))
                    .setPeriodic(PERIOD_MS)
                    .setPersisted(true)
                    .setRequiredNetworkType(JobInfo.NETWORK_TYPE_ANY)
                    .setRequiresBatteryNotLow(true)
                    .build()
            );
            BgLog.line(c, "scheduled result=" + r);
        } catch (Throwable t) {
            // A scheduling fault must never cost the student the app itself.
            BgLog.line(c, "schedule FAILED " + t.getClass().getSimpleName());
        }
    }

    static void cancel(Context c) {
        try {
            c.getSystemService(JobScheduler.class).cancel(JOB_ID);
        } catch (Throwable ignored) {
        }
    }

    private static boolean signedIn(Context c) {
        return c.getSharedPreferences("reis_secure_store", Context.MODE_PRIVATE).contains(TOKEN_KEY);
    }

    @Override
    public boolean onStartJob(JobParameters params) {
        startedAt = SystemClock.elapsedRealtime();
        ActivityManager am = getSystemService(ActivityManager.class);
        BgLog.line(this, "job start fg=" + appInForeground + " restricted="
            + (Build.VERSION.SDK_INT >= 28 && am.isBackgroundRestricted()));
        // The app is open and runs its own sync; a signed-out phone has nothing to check.
        if (!isEnabled(this) || appInForeground || !signedIn(this)) return false;
        run = new BackgroundWebRun(this, status -> {
            BgLog.line(this, "job done in " + (SystemClock.elapsedRealtime() - startedAt) + "ms " + status);
            jobFinished(params, false);
        });
        run.start();
        return true;
    }

    @Override
    public boolean onStopJob(JobParameters params) {
        BgLog.line(this, "job STOPPED by system after " + (SystemClock.elapsedRealtime() - startedAt) + "ms");
        if (run != null) run.destroy();
        return false;
    }
}
