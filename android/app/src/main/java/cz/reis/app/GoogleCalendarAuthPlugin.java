package cz.reis.app;

import android.app.PendingIntent;

import androidx.activity.result.ActivityResult;
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
import com.google.android.gms.auth.api.identity.Identity;
import com.google.android.gms.common.api.Scope;

import java.util.ArrayList;
import java.util.List;

/**
 * SPIKE: read-only Google Calendar token through the Authorization API.
 *
 * `connect` may present Google's consent UI. `getAccessToken` never does: once
 * consent exists, authorize() returns a fresh access token without a resolution,
 * and when it would need UI the call is rejected with NEEDS_CONSENT instead of
 * popping a sheet over a background sync. No serverAuthCode is requested, so no
 * backend is involved. Credential Manager is deliberately not used.
 */
@CapacitorPlugin(name = "GoogleCalendarAuth")
public class GoogleCalendarAuthPlugin extends Plugin {
    private ActivityResultLauncher<IntentSenderRequest> consentLauncher;
    private PluginCall pendingConsent;

    @Override
    public void load() {
        consentLauncher = getBridge().registerForActivityResult(
            new ActivityResultContracts.StartIntentSenderForResult(), this::onConsentResult);
    }

    @PluginMethod
    public void connect(PluginCall call) {
        authorize(call, true);
    }

    @PluginMethod
    public void getAccessToken(PluginCall call) {
        authorize(call, false);
    }

    @PluginMethod
    public void disconnect(PluginCall call) {
        // Spike: revocation is done from myaccount.google.com/permissions.
        call.resolve();
    }

    private void authorize(PluginCall call, boolean interactive) {
        JSArray scopeArray = call.getArray("scopes");
        List<Scope> scopes = new ArrayList<>();
        try {
            if (scopeArray != null) {
                for (int i = 0; i < scopeArray.length(); i++) {
                    scopes.add(new Scope(scopeArray.getString(i)));
                }
            }
        } catch (Exception e) {
            call.reject("bad scopes");
            return;
        }
        AuthorizationRequest request = AuthorizationRequest.builder().setRequestedScopes(scopes).build();
        Identity.getAuthorizationClient(getActivity())
            .authorize(request)
            .addOnSuccessListener(result -> {
                if (!result.hasResolution()) {
                    call.resolve(payload(result));
                    return;
                }
                if (!interactive) {
                    call.reject("consent needed", "NEEDS_CONSENT");
                    return;
                }
                PendingIntent pending = result.getPendingIntent();
                if (pending == null) {
                    call.reject("no pending intent");
                    return;
                }
                if (pendingConsent != null) {
                    call.reject("consent already in progress");
                    return;
                }
                pendingConsent = call;
                getBridge().saveCall(call);
                consentLauncher.launch(new IntentSenderRequest.Builder(pending.getIntentSender()).build());
            })
            .addOnFailureListener(e -> call.reject("authorize failed: " + e.getMessage()));
    }

    private void onConsentResult(ActivityResult activityResult) {
        PluginCall call = pendingConsent;
        pendingConsent = null;
        if (call == null) return;
        try {
            AuthorizationResult result = Identity.getAuthorizationClient(getActivity())
                .getAuthorizationResultFromIntent(activityResult.getData());
            call.resolve(payload(result));
        } catch (Exception e) {
            call.reject("consent cancelled or failed: " + e.getMessage());
        } finally {
            getBridge().releaseCall(call);
        }
    }

    private JSObject payload(AuthorizationResult result) {
        JSObject out = new JSObject();
        out.put("accessToken", result.getAccessToken());
        JSArray granted = new JSArray();
        for (String s : result.getGrantedScopes()) granted.put(s);
        out.put("grantedScopes", granted);
        return out;
    }
}
