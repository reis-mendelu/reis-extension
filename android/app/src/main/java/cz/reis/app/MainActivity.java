package cz.reis.app;

import android.os.Bundle;

import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {
    @Override
    public void onCreate(Bundle savedInstanceState) {
        registerPlugin(DownloadsPlugin.class);
        registerPlugin(EduroamPlugin.class);
        registerPlugin(SecureStorePlugin.class);
        super.onCreate(savedInstanceState);
    }
}
