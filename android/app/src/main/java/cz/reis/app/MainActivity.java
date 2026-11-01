package cz.reis.app;

import android.os.Build;
import android.os.Bundle;

import androidx.activity.EdgeToEdge;

import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {
    // The background check leaves the run to the app while it is on screen.
    @Override
    public void onStart() {
        super.onStart();
        BackgroundCheckService.appInForeground = true;
    }

    @Override
    public void onStop() {
        BackgroundCheckService.appInForeground = false;
        super.onStop();
    }

    @Override
    public void onCreate(Bundle savedInstanceState) {
        registerPlugin(BackgroundCheckPlugin.class);
        registerPlugin(DownloadsPlugin.class);
        registerPlugin(EduroamPlugin.class);
        registerPlugin(SecureStorePlugin.class);
        super.onCreate(savedInstanceState);
        // Android 15+ draws the app edge-to-edge on its own (targetSdk 36), so
        // the app's background shows behind a transparent status bar and the
        // web layout clears it with env(safe-area-inset-*). Before 15 the system
        // paints its own opaque strip instead — white on MIUI, whatever the app
        // theme. Opting the older versions in gives them the same layout.
        // The icon colour is set from JS (src/mobile/systemBarsTheme.ts).
        if (Build.VERSION.SDK_INT < Build.VERSION_CODES.VANILLA_ICE_CREAM) {
            EdgeToEdge.enable(this);
        }
    }
}
