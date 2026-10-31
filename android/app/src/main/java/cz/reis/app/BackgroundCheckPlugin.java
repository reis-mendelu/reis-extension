package cz.reis.app;

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

    @PluginMethod
    public void clearNotifications(PluginCall call) {
        BackgroundNotifier.clearAll(getContext());
        call.resolve();
    }
}
