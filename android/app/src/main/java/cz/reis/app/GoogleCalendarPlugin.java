package cz.reis.app;

import android.accounts.Account;
import android.app.Activity;
import android.content.SharedPreferences;
import android.text.TextUtils;

import androidx.activity.result.ActivityResultLauncher;
import androidx.activity.result.IntentSenderRequest;
import androidx.activity.result.contract.ActivityResultContracts;

import com.getcapacitor.JSArray;
import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;
import com.google.android.gms.auth.api.identity.AuthorizationRequest;
import com.google.android.gms.auth.api.identity.AuthorizationResult;
import com.google.android.gms.auth.api.identity.ClearTokenRequest;
import com.google.android.gms.auth.api.identity.Identity;
import com.google.android.gms.auth.api.identity.RevokeAccessRequest;
import com.google.android.gms.common.ConnectionResult;
import com.google.android.gms.common.GoogleApiAvailability;
import com.google.android.gms.common.api.Scope;

import org.json.JSONObject;

import java.io.ByteArrayOutputStream;
import java.io.InputStream;
import java.net.HttpURLConnection;
import java.net.URL;
import java.net.URLEncoder;
import java.nio.charset.StandardCharsets;
import java.util.ArrayList;
import java.util.Arrays;
import java.util.List;

/**
 * Google sign-in for the "Rozvrh" calendar sync — sign-in and token ONLY. The
 * sync itself is TypeScript (src/mobile/googleCalendar) and runs while the app
 * is open; there is no background job (spec 2026-10-08, "Phase 2").
 *
 * Google holds the grant: AuthorizationClient (play-services-auth) matches this
 * app by package + signing SHA-1 against an Android OAuth client in project
 * reis-479320. There is no client id and no secret in this code, and no
 * refresh token ever reaches reIS — only 1-hour access tokens.
 *
 * Granular consent: the student may untick a scope on Google's screen. connect()
 * reports what was granted; accessToken()/status() then ask for exactly that,
 * because asking again for an unticked scope needs consent and would read as
 * REVOKED, switching the sync off.
 */
@CapacitorPlugin(name = "GoogleCalendar")
public class GoogleCalendarPlugin extends Plugin {

    static final List<Scope> SCOPES = Arrays.asList(
            new Scope("https://www.googleapis.com/auth/calendar.app.created"),
            new Scope("https://www.googleapis.com/auth/calendar.calendarlist.readonly"),
            new Scope("email"));

    static final String PREFS = "reis_gcal";

    private ActivityResultLauncher<IntentSenderRequest> consent;
    /** The connect call waiting on Google's consent sheet. */
    private PluginCall pendingConnect;
    /**
     * One connect at a time, from the first authorize() until the call settles.
     * pendingConnect alone covered only the consent sheet: two calls during the
     * authorize() round trip both got through. volatile: resolveConnected clears
     * it off the main thread.
     */
    private volatile boolean connectInFlight;

    static AuthorizationRequest request(List<Scope> scopes) {
        return AuthorizationRequest.builder().setRequestedScopes(scopes).build();
    }

    private SharedPreferences prefs() {
        return getContext().getSharedPreferences(PREFS, 0);
    }

    /** What the student actually granted; all scopes before the first connect. */
    List<Scope> grantedScopes() {
        String csv = prefs().getString("scopes", null);
        if (csv == null) return SCOPES;
        List<Scope> out = new ArrayList<>();
        for (String sc : csv.split(",")) if (!sc.isEmpty()) out.add(new Scope(sc));
        return out;
    }

    @Override
    public void load() {
        // Registered here, during the activity's onCreate: an ActivityResult
        // launcher must exist before the activity is STARTED.
        consent = getActivity().registerForActivityResult(
                new ActivityResultContracts.StartIntentSenderForResult(), r -> {
                    PluginCall call = pendingConnect;
                    pendingConnect = null;
                    if (call == null) return;
                    // Only a dismissed sheet is CANCELLED; anything else that
                    // fails to parse is a real failure, not the student's choice.
                    if (r.getResultCode() == Activity.RESULT_CANCELED) {
                        connectInFlight = false;
                        call.reject("CANCELLED", "CANCELLED");
                        return;
                    }
                    try {
                        AuthorizationResult res = Identity.getAuthorizationClient(getActivity())
                                .getAuthorizationResultFromIntent(r.getData());
                        resolveConnected(call, res);
                    } catch (Exception e) {
                        connectInFlight = false;
                        call.reject("AUTH_FAILED", "AUTH_FAILED", e);
                    }
                });
    }

    @PluginMethod
    public void isAvailable(PluginCall call) {
        int s = GoogleApiAvailability.getInstance().isGooglePlayServicesAvailable(getContext());
        call.resolve(new JSObject().put("available", s == ConnectionResult.SUCCESS));
    }

    @PluginMethod
    public void connect(PluginCall call) {
        if (connectInFlight) {
            // A connect is already running; a second launch would stack another sheet.
            call.reject("IN_PROGRESS", "IN_PROGRESS");
            return;
        }
        // Reserved before authorize(), released on every terminal path below.
        connectInFlight = true;
        try {
            Identity.getAuthorizationClient(getActivity()).authorize(request(SCOPES))
                    .addOnSuccessListener(res -> {
                        if (res.hasResolution() && res.getPendingIntent() != null) {
                            pendingConnect = call;
                            try {
                                consent.launch(new IntentSenderRequest.Builder(
                                        res.getPendingIntent().getIntentSender()).build());
                            } catch (Exception e) {
                                pendingConnect = null;
                                connectInFlight = false;
                                call.reject("AUTH_FAILED", "AUTH_FAILED", e);
                            }
                        } else {
                            resolveConnected(call, res);
                        }
                    })
                    .addOnFailureListener(e -> {
                        connectInFlight = false;
                        call.reject("AUTH_FAILED", "AUTH_FAILED", e);
                    });
        } catch (Exception e) {
            connectInFlight = false;
            call.reject("AUTH_FAILED", "AUTH_FAILED", e);
        }
    }

    private void resolveConnected(PluginCall call, AuthorizationResult res) {
        // tokeninfo is a network call: off the main thread.
        new Thread(() -> {
            try {
                String email = fetchEmail(res.getAccessToken());
                List<String> granted = res.getGrantedScopes();
                // TextUtils.join, not String.join: that one is API 26 and minSdk is 24.
                prefs().edit()
                        .putString("email", email)
                        .putString("scopes", TextUtils.join(",", granted))
                        .apply();
                JSArray scopes = new JSArray();
                for (String sc : granted) scopes.put(sc);
                // Released before settling: the controller's granular-consent retry
                // calls connect() again the moment this one resolves.
                connectInFlight = false;
                call.resolve(new JSObject().put("email", email).put("scopes", scopes));
            } catch (Exception e) {
                connectInFlight = false;
                call.reject("AUTH_FAILED", "AUTH_FAILED", e);
            }
        }).start();
    }

    @PluginMethod
    public void accessToken(PluginCall call) {
        Identity.getAuthorizationClient(getContext()).authorize(request(grantedScopes()))
                .addOnSuccessListener(res -> {
                    // hasResolution = consent needed again: revoked, or never granted.
                    if (res.hasResolution() || res.getAccessToken() == null) {
                        call.reject("REVOKED", "REVOKED");
                    } else {
                        call.resolve(new JSObject().put("token", res.getAccessToken()));
                    }
                })
                .addOnFailureListener(e -> call.reject("AUTH_FAILED", "AUTH_FAILED", e));
    }

    @PluginMethod
    public void invalidateToken(PluginCall call) {
        String token = call.getString("token");
        if (token == null) {
            call.resolve();
            return;
        }
        Identity.getAuthorizationClient(getContext())
                .clearToken(ClearTokenRequest.builder().setToken(token).build())
                .addOnCompleteListener(t -> call.resolve());
    }

    /**
     * Connected = stored scopes and a silent authorize() that needs no consent.
     * The scopes are the marker, not the email: email is display-only and null
     * when tokeninfo was offline or the student unticked the email scope.
     */
    @PluginMethod
    public void status(PluginCall call) {
        String email = prefs().getString("email", null);
        if (prefs().getString("scopes", null) == null) {
            call.resolve(new JSObject().put("connected", false).put("email", null));
            return;
        }
        Identity.getAuthorizationClient(getContext()).authorize(request(grantedScopes()))
                .addOnSuccessListener(res -> call.resolve(new JSObject()
                        .put("connected", !res.hasResolution() && res.getAccessToken() != null)
                        .put("email", email)))
                .addOnFailureListener(e -> call.resolve(
                        new JSObject().put("connected", false).put("email", email)));
    }

    /**
     * Revokes at Google, then forgets locally even if the revoke fails. Stored
     * scopes mean there is a grant to revoke; a missing email is recovered from
     * a silent token first, since revokeAccess() needs the account.
     */
    @PluginMethod
    public void disconnect(PluginCall call) {
        String email = prefs().getString("email", null);
        List<Scope> scopes = grantedScopes();
        Runnable forget = () -> {
            prefs().edit().clear().apply();
            call.resolve();
        };
        if (prefs().getString("scopes", null) == null) {
            forget.run();
            return;
        }
        if (email != null) {
            revoke(email, scopes, forget);
            return;
        }
        Identity.getAuthorizationClient(getContext()).authorize(request(scopes))
                .addOnSuccessListener(res -> {
                    String token = res.getAccessToken();
                    if (res.hasResolution() || token == null) {
                        forget.run(); // Nothing silent to revoke with: already revoked.
                        return;
                    }
                    new Thread(() -> {
                        String recovered = fetchEmail(token);
                        if (recovered != null) {
                            revoke(recovered, scopes, forget);
                        } else {
                            // No address, no revokeAccess(): drop the cached token at least.
                            Identity.getAuthorizationClient(getContext())
                                    .clearToken(ClearTokenRequest.builder().setToken(token).build())
                                    .addOnCompleteListener(t -> forget.run());
                        }
                    }).start();
                })
                .addOnFailureListener(e -> forget.run());
    }

    private void revoke(String email, List<Scope> scopes, Runnable then) {
        Identity.getAuthorizationClient(getContext())
                .revokeAccess(RevokeAccessRequest.builder()
                        .setAccount(new Account(email, "com.google"))
                        .setScopes(scopes)
                        .build())
                .addOnCompleteListener(t -> then.run());
    }

    /** The `email` scope makes tokeninfo return the address. It never leaves the device. */
    static String fetchEmail(String token) {
        if (token == null) return null;
        try {
            HttpURLConnection c = (HttpURLConnection) new URL(
                    "https://www.googleapis.com/oauth2/v3/tokeninfo?access_token="
                            + URLEncoder.encode(token, "UTF-8")).openConnection();
            // Without these a stalled network holds connect() open indefinitely.
            c.setConnectTimeout(10_000);
            c.setReadTimeout(10_000);
            if (c.getResponseCode() != 200) return null;
            try (InputStream in = c.getInputStream()) {
                // Not readAllBytes(): API 33, a NoSuchMethodError (not caught below) on 24–32.
                ByteArrayOutputStream buf = new ByteArrayOutputStream();
                byte[] chunk = new byte[4096];
                for (int n; (n = in.read(chunk)) != -1; ) buf.write(chunk, 0, n);
                String body = new String(buf.toByteArray(), StandardCharsets.UTF_8);
                String email = new JSONObject(body).optString("email", "");
                return email.isEmpty() ? null : email;
            }
        } catch (Exception e) {
            return null;
        }
    }
}
