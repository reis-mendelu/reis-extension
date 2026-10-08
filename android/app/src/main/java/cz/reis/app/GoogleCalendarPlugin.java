package cz.reis.app;

import android.accounts.Account;
import android.content.SharedPreferences;

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
    /** The connect call waiting on Google's consent sheet. One at a time. */
    private PluginCall pendingConnect;

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
                    try {
                        AuthorizationResult res = Identity.getAuthorizationClient(getActivity())
                                .getAuthorizationResultFromIntent(r.getData());
                        resolveConnected(call, res);
                    } catch (Exception e) {
                        call.reject("CANCELLED", "CANCELLED", e);
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
        if (pendingConnect != null) {
            // The consent sheet is already up; a second launch would stack another.
            call.reject("IN_PROGRESS", "IN_PROGRESS");
            return;
        }
        Identity.getAuthorizationClient(getActivity()).authorize(request(SCOPES))
                .addOnSuccessListener(res -> {
                    if (res.hasResolution() && res.getPendingIntent() != null) {
                        pendingConnect = call;
                        consent.launch(new IntentSenderRequest.Builder(
                                res.getPendingIntent().getIntentSender()).build());
                    } else {
                        resolveConnected(call, res);
                    }
                })
                .addOnFailureListener(e -> call.reject("AUTH_FAILED", "AUTH_FAILED", e));
    }

    private void resolveConnected(PluginCall call, AuthorizationResult res) {
        // tokeninfo is a network call: off the main thread.
        new Thread(() -> {
            String email = fetchEmail(res.getAccessToken());
            List<String> granted = res.getGrantedScopes();
            prefs().edit()
                    .putString("email", email)
                    .putString("scopes", String.join(",", granted))
                    .apply();
            JSArray scopes = new JSArray();
            for (String sc : granted) scopes.put(sc);
            call.resolve(new JSObject().put("email", email).put("scopes", scopes));
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

    /** Connected = a stored account and a silent authorize() that needs no consent. */
    @PluginMethod
    public void status(PluginCall call) {
        String email = prefs().getString("email", null);
        if (email == null) {
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

    /** Revokes at Google, then forgets locally even if the revoke fails. */
    @PluginMethod
    public void disconnect(PluginCall call) {
        String email = prefs().getString("email", null);
        List<Scope> scopes = grantedScopes();
        Runnable forget = () -> {
            prefs().edit().clear().apply();
            call.resolve();
        };
        if (email == null) {
            forget.run();
            return;
        }
        Identity.getAuthorizationClient(getContext())
                .revokeAccess(RevokeAccessRequest.builder()
                        .setAccount(new Account(email, "com.google"))
                        .setScopes(scopes)
                        .build())
                .addOnCompleteListener(t -> forget.run());
    }

    /** The `email` scope makes tokeninfo return the address. It never leaves the device. */
    static String fetchEmail(String token) {
        if (token == null) return null;
        try {
            HttpURLConnection c = (HttpURLConnection) new URL(
                    "https://www.googleapis.com/oauth2/v3/tokeninfo?access_token="
                            + URLEncoder.encode(token, "UTF-8")).openConnection();
            if (c.getResponseCode() != 200) return null;
            try (InputStream in = c.getInputStream()) {
                String body = new String(in.readAllBytes(), StandardCharsets.UTF_8);
                String email = new JSONObject(body).optString("email", "");
                return email.isEmpty() ? null : email;
            }
        } catch (Exception e) {
            return null;
        }
    }
}
