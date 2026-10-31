package cz.reis.app;

import android.content.Intent;
import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;

/**
 * The app's handle on the background check: the switch in Nastavení, the
 * channel names in the student's language, and the sign-out cleanup. The check
 * itself runs without the app (BackgroundCheckService).
 */
@CapacitorPlugin(name = "BackgroundCheck")
public class BackgroundCheckPlugin extends Plugin {

    /** Called at every launch after sign-in: names the channels, and re-arms the job if it is on. */
    @PluginMethod
    public void start(PluginCall call) {
        BackgroundNotifier.ensureChannels(getContext(), call.getObject("channelNames"));
        BackgroundCheckService.schedule(getContext());
        JSObject out = new JSObject();
        out.put("enabled", BackgroundCheckService.isEnabled(getContext()));
        call.resolve(out);
    }

    /** A language switch: renames the channels, leaves the job alone. */
    @PluginMethod
    public void setChannelNames(PluginCall call) {
        BackgroundNotifier.ensureChannels(getContext(), call.getObject("channelNames"));
        call.resolve();
    }

    @PluginMethod
    public void setEnabled(PluginCall call) {
        Boolean enabled = call.getBoolean("enabled");
        if (enabled == null) {
            call.reject("enabled is required");
            return;
        }
        BackgroundCheckService.setEnabled(getContext(), enabled);
        call.resolve();
    }

    /** The tap that launched the app, once: the intent outlives the page, so it is consumed here. */
    @PluginMethod
    public void getLaunchTap(PluginCall call) {
        Intent launch = getActivity() != null ? getActivity().getIntent() : null;
        JSObject tap = tapOf(launch);
        if (launch != null) {
            launch.removeExtra(BackgroundNotifier.EXTRA_KIND);
            launch.removeExtra(BackgroundNotifier.EXTRA_COURSE);
        }
        call.resolve(tap != null ? tap : new JSObject());
    }

    /** A tap while the app is already running arrives as a new intent (the activity is singleTask). */
    @Override
    protected void handleOnNewIntent(Intent intent) {
        super.handleOnNewIntent(intent);
        JSObject tap = tapOf(intent);
        if (tap != null) notifyListeners("notificationTap", tap, true);
    }

    private static JSObject tapOf(Intent intent) {
        if (intent == null) return null;
        String kind = intent.getStringExtra(BackgroundNotifier.EXTRA_KIND);
        if (kind == null) return null;
        JSObject tap = new JSObject();
        tap.put("kind", kind);
        tap.put("courseCode", intent.getStringExtra(BackgroundNotifier.EXTRA_COURSE));
        return tap;
    }

    @PluginMethod
    public void clearNotifications(PluginCall call) {
        BackgroundNotifier.clearAll(getContext());
        // A tap that launched the app is this student's too: the next person to
        // sign in must not be taken to their subject.
        Intent launch = getActivity() != null ? getActivity().getIntent() : null;
        if (launch != null) {
            launch.removeExtra(BackgroundNotifier.EXTRA_KIND);
            launch.removeExtra(BackgroundNotifier.EXTRA_COURSE);
        }
        call.resolve();
    }
}
