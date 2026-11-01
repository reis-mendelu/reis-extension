package cz.reis.app;

import android.content.Context;
import android.os.Handler;
import android.os.Looper;
import android.webkit.ConsoleMessage;
import android.webkit.JavascriptInterface;
import android.webkit.WebChromeClient;
import android.webkit.WebResourceRequest;
import android.webkit.WebResourceResponse;
import android.webkit.WebSettings;
import android.webkit.WebView;
import android.webkit.WebViewClient;

import java.io.ByteArrayInputStream;
import java.io.InputStream;
import java.nio.charset.StandardCharsets;
import java.util.HashMap;
import java.util.Map;

/**
 * A hidden WebView serving the bundled app at https://localhost, the
 * origin Capacitor's own WebView uses, so IndexedDB is the app's own. Capacitor's
 * Bridge needs an Activity, so plugin calls are answered by BackgroundNativeBridge.
 */
class BackgroundWebRun {
    interface Done { void finished(String result); }

    private static final long TIMEOUT_MS = 120_000;
    private static final String ORIGIN_HOST = "localhost";

    private final Context ctx;
    private final Done done;
    private final Handler main = new Handler(Looper.getMainLooper());
    private WebView web;
    private volatile boolean finished;
    private BackgroundNativeBridge bridge;

    BackgroundWebRun(Context ctx, Done done) {
        this.ctx = ctx.getApplicationContext();
        this.done = done;
    }

    void start() {
        web = new WebView(ctx);
        WebSettings s = web.getSettings();
        s.setJavaScriptEnabled(true);
        s.setDomStorageEnabled(true);
        s.setUserAgentString(s.getUserAgentString() + " reIS/5 (+https://github.com/reis-mendelu/reis-extension)");
        bridge = new BackgroundNativeBridge(ctx, web);
        web.addJavascriptInterface(bridge, "androidBridge");
        web.addJavascriptInterface(new Host(), "ReisBg");
        web.setWebChromeClient(new WebChromeClient() {
            @Override
            public boolean onConsoleMessage(ConsoleMessage m) {
                // Logcat only, never the log file: a page's own errors can name URLs.
                if (m.messageLevel() == ConsoleMessage.MessageLevel.ERROR) {
                    android.util.Log.w("ReisBg", "js " + m.message());
                }
                return true;
            }
        });
        web.setWebViewClient(new WebViewClient() {
            @Override
            public WebResourceResponse shouldInterceptRequest(WebView v, WebResourceRequest r) {
                return serve(r);
            }
        });
        web.onResume();
        web.resumeTimers();
        web.loadUrl("https://" + ORIGIN_HOST + "/background.html");
        main.postDelayed(() -> finish("timeout"), TIMEOUT_MS);
    }

    private void finish(String status) {
        if (finished) return;
        finished = true;
        main.removeCallbacksAndMessages(null);
        destroy();
        done.finished(status);
    }

    /** The system stopped the job: nothing this run says from now on counts. */
    void cancel() {
        finished = true;
        main.removeCallbacksAndMessages(null);
        destroy();
    }

    void destroy() {
        // The bridge's worker threads go with the page, whichever way the run ends.
        if (bridge != null) bridge.close();
        main.post(() -> {
            if (web == null) return;
            web.stopLoading();
            web.destroy();
            web = null;
        });
    }

    private WebResourceResponse serve(WebResourceRequest r) {
        if (!"https".equals(r.getUrl().getScheme()) || !ORIGIN_HOST.equals(r.getUrl().getHost())) return null;
        String path = r.getUrl().getPath();
        if (path == null || path.equals("/")) path = "/index.html";
        try {
            InputStream in;
            String mime;
            if (path.equals("/__bg-preload.js")) {
                in = new ByteArrayInputStream(PRELOAD.getBytes(StandardCharsets.UTF_8));
                mime = "text/javascript";
            } else if (path.equals("/__native-bridge.js")) {
                in = ctx.getAssets().open("native-bridge.js");
                mime = "text/javascript";
            } else {
                in = ctx.getAssets().open("public" + path);
                mime = mimeOf(path);
            }
            Map<String, String> h = new HashMap<>();
            h.put("Access-Control-Allow-Origin", "*");
            return new WebResourceResponse(mime, "utf-8", 200, "OK", h, in);
        } catch (Exception e) {
            return new WebResourceResponse("text/plain", "utf-8", 404, "Not Found", new HashMap<>(), new ByteArrayInputStream(new byte[0]));
        }
    }

    private static String mimeOf(String path) {
        if (path.endsWith(".html")) return "text/html";
        if (path.endsWith(".js") || path.endsWith(".mjs")) return "text/javascript";
        if (path.endsWith(".css")) return "text/css";
        if (path.endsWith(".json")) return "application/json";
        if (path.endsWith(".svg")) return "image/svg+xml";
        if (path.endsWith(".wasm")) return "application/wasm";
        return "application/octet-stream";
    }

    private static String header(String name, String... methods) {
        StringBuilder m = new StringBuilder();
        for (String x : methods) {
            if (m.length() > 0) m.append(',');
            m.append("{\"name\":\"").append(x).append("\",\"rtype\":\"promise\"}");
        }
        return "{\"name\":\"" + name + "\",\"methods\":[" + m + "]}";
    }

    /** What Capacitor's JSInjector would have put before the app: the native plugins' names. */
    private static final String PRELOAD =
        "window.WEBVIEW_SERVER_URL='https://localhost';window.Capacitor={PluginHeaders:["
            + header("CapacitorHttp", "get", "post", "request") + ","
            + header("CapacitorCookies", "setCookie", "getCookies", "deleteCookie", "clearCookies") + ","
            + header("SecureStore", "get", "set", "remove") + ","
            + header("Preferences", "get", "set", "remove", "keys")
            + "]};";

    private class Host {
        /** [{kind, title, body}] from backgroundCheck.ts. */
        @JavascriptInterface
        public void notify(String json) {
            // A run that was stopped, or whose student has signed out since it
            // began, must not post: the tray is already cleared for the next one.
            if (finished || !BackgroundCheckService.signedIn(ctx)) return;
            BackgroundNotifier.post(ctx, json);
        }

        @JavascriptInterface
        public void done(String status) { main.post(() -> finish(status)); }
    }
}
