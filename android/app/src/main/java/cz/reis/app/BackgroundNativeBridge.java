package cz.reis.app;

import android.content.Context;
import android.content.SharedPreferences;
import android.util.Base64;
import android.webkit.CookieManager;
import android.webkit.JavascriptInterface;
import android.webkit.WebView;

import org.json.JSONArray;
import org.json.JSONObject;

import java.io.ByteArrayOutputStream;
import java.io.InputStream;
import java.io.OutputStream;
import java.net.CookieHandler;
import java.net.HttpURLConnection;
import java.net.URI;
import java.net.URL;
import java.nio.charset.StandardCharsets;
import java.security.KeyStore;
import java.util.Collections;
import java.util.Iterator;
import java.util.List;
import java.util.Map;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;

import javax.crypto.Cipher;
import javax.crypto.SecretKey;
import javax.crypto.spec.GCMParameterSpec;

/**
 * Stands in for Capacitor's Bridge, which cannot exist without an Activity.
 * Speaks native-bridge.js's wire format (androidBridge.postMessage in,
 * Capacitor.fromNative out) for exactly the plugins the sync path touches.
 */
class BackgroundNativeBridge {
    private final Context ctx;
    private final WebView web;
    private final android.os.Handler main = new android.os.Handler(android.os.Looper.getMainLooper());
    private final ExecutorService pool = Executors.newFixedThreadPool(6);

    BackgroundNativeBridge(Context ctx, WebView web) {
        this.ctx = ctx;
        this.web = web;
        // Capacitor installs this when its Bridge starts; a cold process has none.
        CookieHandler.setDefault(new CookieHandler() {
            @Override
            public Map<String, List<String>> get(URI uri, Map<String, List<String>> h) {
                String c = CookieManager.getInstance().getCookie(uri.toString());
                return c == null ? Collections.emptyMap() : Collections.singletonMap("Cookie", Collections.singletonList(c));
            }

            @Override
            public void put(URI uri, Map<String, List<String>> h) {
                List<String> set = h.get("Set-Cookie");
                if (set == null) return;
                for (String c : set) CookieManager.getInstance().setCookie(uri.toString(), c);
            }
        });
    }

    @JavascriptInterface
    public void postMessage(String msg) {
        pool.execute(() -> {
            String callbackId = "-1", plugin = "", method = "";
            try {
                JSONObject m = new JSONObject(msg);
                callbackId = m.optString("callbackId", "-1");
                plugin = m.optString("pluginId");
                method = m.optString("methodName");
                JSONObject o = m.optJSONObject("options");
                if (o == null) o = new JSONObject();
                Object data = dispatch(plugin, method, o);
                reply(callbackId, plugin, method, true, data);
            } catch (Throwable t) {
                BgLog.line(ctx, "bridge error " + plugin + "." + method + ": " + t.getClass().getSimpleName());
                JSONObject err = new JSONObject();
                try { err.put("message", String.valueOf(t.getMessage())); } catch (Exception ignored) {}
                reply(callbackId, plugin, method, false, err);
            }
        });
    }

    private Object dispatch(String plugin, String method, JSONObject o) throws Exception {
        switch (plugin + "." + method) {
            case "CapacitorHttp.get": return http("GET", o);
            case "CapacitorHttp.post": return http("POST", o);
            case "CapacitorHttp.request": return http(o.optString("method", "GET").toUpperCase(), o);
            case "CapacitorCookies.setCookie": {
                String url = o.getString("url");
                CookieManager cm = CookieManager.getInstance();
                cm.setCookie(url, o.getString("key") + "=" + o.getString("value") + "; path=/");
                cm.flush();
                return new JSONObject();
            }
            case "SecureStore.get": return new JSONObject().put("value", secureGet(o.getString("key")));
            case "Preferences.get": {
                String v = prefs().getString(o.getString("key"), null);
                return new JSONObject().put("value", v == null ? JSONObject.NULL : v);
            }
            case "Preferences.set":
                prefs().edit().putString(o.getString("key"), o.getString("value")).apply();
                return new JSONObject();
            case "Preferences.remove":
                prefs().edit().remove(o.getString("key")).apply();
                return new JSONObject();
            default:
                throw new UnsupportedOperationException(plugin + "." + method + " is not implemented in the background");
        }
    }

    private SharedPreferences prefs() {
        return ctx.getSharedPreferences("CapacitorStorage", Context.MODE_PRIVATE);
    }

    /** Same alias, prefs file and layout as SecureStorePlugin; read-only. */
    private Object secureGet(String key) {
        String stored = ctx.getSharedPreferences("reis_secure_store", Context.MODE_PRIVATE).getString(key, null);
        if (stored == null) return JSONObject.NULL;
        try {
            KeyStore ks = KeyStore.getInstance("AndroidKeyStore");
            ks.load(null);
            KeyStore.Entry e = ks.getEntry("reis.securestore.v1", null);
            if (!(e instanceof KeyStore.SecretKeyEntry)) return JSONObject.NULL;
            SecretKey k = ((KeyStore.SecretKeyEntry) e).getSecretKey();
            byte[] joined = Base64.decode(stored, Base64.NO_WRAP);
            Cipher c = Cipher.getInstance("AES/GCM/NoPadding");
            c.init(Cipher.DECRYPT_MODE, k, new GCMParameterSpec(128, joined, 0, 12));
            return new String(c.doFinal(joined, 12, joined.length - 12), StandardCharsets.UTF_8);
        } catch (Exception ex) {
            return JSONObject.NULL;
        }
    }

    private JSONObject http(String verb, JSONObject o) throws Exception {
        HttpURLConnection c = (HttpURLConnection) new URL(o.getString("url")).openConnection();
        c.setRequestMethod(verb);
        c.setConnectTimeout(20_000);
        c.setReadTimeout(30_000);
        JSONObject headers = o.optJSONObject("headers");
        if (headers != null) {
            for (Iterator<String> it = headers.keys(); it.hasNext(); ) {
                String k = it.next();
                c.setRequestProperty(k, headers.getString(k));
            }
        }
        if ("POST".equals(verb) && o.has("data")) {
            Object d = o.get("data");
            byte[] body = (d instanceof String ? (String) d : d.toString()).getBytes(StandardCharsets.UTF_8);
            c.setDoOutput(true);
            try (OutputStream out = c.getOutputStream()) { out.write(body); }
        }
        int status = c.getResponseCode();
        InputStream in = status >= 400 ? c.getErrorStream() : c.getInputStream();
        ByteArrayOutputStream buf = new ByteArrayOutputStream();
        if (in != null) {
            byte[] chunk = new byte[16384];
            int n;
            while ((n = in.read(chunk)) > 0) buf.write(chunk, 0, n);
            in.close();
        }
        String text = new String(buf.toByteArray(), StandardCharsets.UTF_8);
        JSONObject resp = new JSONObject();
        JSONObject outHeaders = new JSONObject();
        for (Map.Entry<String, List<String>> e : c.getHeaderFields().entrySet()) {
            if (e.getKey() != null && !e.getValue().isEmpty()) outHeaders.put(e.getKey(), e.getValue().get(0));
        }
        resp.put("status", status);
        resp.put("headers", outHeaders);
        resp.put("url", c.getURL().toString());
        String ct = c.getContentType();
        // As HttpRequestHandler does: a JSON body crosses the bridge already parsed.
        if (ct != null && ct.contains("json")) {
            try { resp.put("data", text.trim().startsWith("[") ? new JSONArray(text) : new JSONObject(text)); }
            catch (Exception ex) { resp.put("data", text); }
        } else {
            resp.put("data", text);
        }
        c.disconnect();
        return resp;
    }

    private void reply(String callbackId, String plugin, String method, boolean ok, Object data) {
        if ("-1".equals(callbackId)) return;
        try {
            JSONObject r = new JSONObject();
            r.put("callbackId", callbackId);
            r.put("pluginId", plugin);
            r.put("methodName", method);
            r.put("success", ok);
            r.put(ok ? "data" : "error", data);
            String js = "window.Capacitor.fromNative(" + r + ")";
            // Not web.post(): a WebView never attached to a window queues those forever.
            main.post(() -> web.evaluateJavascript(js, null));
        } catch (Exception e) {
            BgLog.line(ctx, "reply failed " + e.getClass().getSimpleName());
        }
    }
}
