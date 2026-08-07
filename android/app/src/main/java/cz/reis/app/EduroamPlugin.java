package cz.reis.app;

import android.content.Intent;
import android.net.wifi.WifiEnterpriseConfig;
import android.net.wifi.WifiNetworkSuggestion;
import android.os.Build;
import android.os.Bundle;
import android.provider.Settings;
import android.util.Base64;

import androidx.activity.result.ActivityResult;

import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.ActivityCallback;
import com.getcapacitor.annotation.CapacitorPlugin;

import java.io.ByteArrayInputStream;
import java.security.KeyStore;
import java.security.PrivateKey;
import java.security.cert.CertificateFactory;
import java.security.cert.X509Certificate;
import java.util.ArrayList;
import java.util.List;
import java.util.regex.Matcher;
import java.util.regex.Pattern;

/**
 * Configures MENDELU's eduroam as a real saved Wi-Fi network, from the student's
 * own IS certificate. Two taps: the button in reIS, then Save in Android's own
 * dialog.
 *
 * Ported from the throwaway spike's EduroamProbePlugin, which verified on API 35
 * with real MENDELU cert material that this path accepts an EAP-TLS config backed
 * by a SELF-SIGNED root — the one assumption worth proving before building on it.
 *
 * Java rather than Kotlin on purpose: the Capacitor app module has no Kotlin
 * Gradle plugin, and DownloadsPlugin is Java for the same reason.
 *
 * Why not geteduroam: it re-resolves the signing institution against the eduroam
 * discovery catalogue, MENDELU is not in it, and the failed lookup disables a
 * config that was already working. This path has no discovery step at all.
 *
 * Why not WifiManager.addNetworkSuggestions: that API is built for carrier
 * offload. Its networks are invisible in the Wi-Fi list, a declined prompt
 * revokes CHANGE_WIFI_STATE, and tapping Disconnect blacklists the network for
 * 24 hours. ACTION_WIFI_ADD_NETWORKS produces a network the student owns.
 */
@CapacitorPlugin(name = "Eduroam")
public class EduroamPlugin extends Plugin {

    private static final String SSID = "eduroam";

    /**
     * MENDELU's own Android guide says `mendelu.cz`, and that is what this must
     * be — NOT the `aleph.mendelu.cz` the iOS profile pins. setDomainSuffixMatch
     * does label-wise suffix matching against SubjectAltName dNSName entries,
     * which is stricter and differently scoped than Apple's TLSTrustedServerNames.
     * The shorter suffix still matches aleph.mendelu.cz and survives a RADIUS
     * rename. Security is anchored by the private MENDELU root, not by hostname
     * granularity.
     */
    private static final String DOMAIN_SUFFIX = "mendelu.cz";

    /** CN=... in an RFC 2253 subject, honouring backslash-escaped separators. */
    private static final Pattern CN = Pattern.compile("CN=((?:\\\\.|[^,])*)");

    @PluginMethod
    public void configure(PluginCall call) {
        if (Build.VERSION.SDK_INT < Build.VERSION_CODES.R) {
            // The JS side gates on this too, but a plugin surface is reachable
            // from any script in the WebView, so it cannot rely on that.
            call.reject("ACTION_WIFI_ADD_NETWORKS requires Android 11 (API 30); this device is "
                    + Build.VERSION.SDK_INT);
            return;
        }

        String p12Base64 = call.getString("p12Base64");
        String passphrase = call.getString("passphrase");
        String caDerBase64 = call.getString("caDerBase64");
        if (p12Base64 == null || passphrase == null || caDerBase64 == null) {
            call.reject("configure requires p12Base64, passphrase and caDerBase64");
            return;
        }

        // Reported on every failure. "Rejected" is only actionable if we know
        // whether the PKCS#12, the CA, the Builder or the system dialog rejected
        // it — this is the single most useful thing the spike taught.
        String stage = "decode";
        try {
            byte[] p12 = Base64.decode(p12Base64, Base64.DEFAULT);
            char[] pass = passphrase.toCharArray();
            byte[] caDer = Base64.decode(caDerBase64, Base64.DEFAULT);

            stage = "keystore";
            KeyStore ks = KeyStore.getInstance("PKCS12");
            ks.load(new ByteArrayInputStream(p12), pass);
            if (!ks.aliases().hasMoreElements()) {
                call.reject("FAILED at stage=keystore: the PKCS#12 contains no entries");
                return;
            }
            String alias = ks.aliases().nextElement();
            PrivateKey key = (PrivateKey) ks.getKey(alias, pass);
            X509Certificate clientCert = (X509Certificate) ks.getCertificate(alias);
            if (key == null || clientCert == null) {
                call.reject("FAILED at stage=keystore: no key/certificate pair under " + alias);
                return;
            }

            stage = "ca";
            X509Certificate ca = (X509Certificate) CertificateFactory
                    .getInstance("X.509")
                    .generateCertificate(new ByteArrayInputStream(caDer));

            stage = "identity";
            // Android does NOT derive the EAP identity from the client
            // certificate — it must be set explicitly, and an empty one is what
            // greys out CONNECT in the manual flow. But the IS-issued cert's
            // subject CN already IS `<login>@mendelu.cz`, so read it off the
            // certificate already in hand rather than asking the student or
            // making another IS request. An explicit override wins if supplied.
            String identity = call.getString("identity");
            if (identity == null || identity.isEmpty()) {
                identity = subjectCommonName(clientCert);
            }
            if (identity == null || identity.isEmpty()) {
                call.reject("FAILED at stage=identity: no CN on the client certificate and no "
                        + "identity supplied");
                return;
            }

            stage = "enterpriseConfig";
            WifiEnterpriseConfig enterprise = new WifiEnterpriseConfig();
            enterprise.setEapMethod(WifiEnterpriseConfig.Eap.TLS);
            enterprise.setCaCertificate(ca);
            enterprise.setClientKeyEntry(key, clientCert);
            enterprise.setDomainSuffixMatch(DOMAIN_SUFFIX);
            enterprise.setIdentity(identity);

            stage = "suggestionBuilder";
            // There is NO generic setWifiEnterpriseConfig on this Builder — the
            // caller must commit to a WPA generation, and MENDELU's eduroam is
            // WPA2-Enterprise. Deprecated since API 33 but still the only WPA2
            // path. (A WifiNetworkSuggestion object is used here, but this is
            // NOT the Suggestion API; the intent below makes it a saved network.)
            @SuppressWarnings("deprecation")
            WifiNetworkSuggestion suggestion = new WifiNetworkSuggestion.Builder()
                    .setSsid(SSID)
                    .setWpa2EnterpriseConfig(enterprise)
                    .build();

            stage = "intent";
            ArrayList<WifiNetworkSuggestion> list = new ArrayList<>();
            list.add(suggestion);
            Bundle extras = new Bundle();
            extras.putParcelableArrayList(Settings.EXTRA_WIFI_NETWORK_LIST, list);
            Intent intent = new Intent(Settings.ACTION_WIFI_ADD_NETWORKS).putExtras(extras);

            // Diagnostics that cost nothing and explain a later rejection. Both
            // are certificate subjects, not student data beyond the login the
            // student is themselves configuring.
            call.getData().put("_identity", identity);
            call.getData().put("_caSubject", ca.getSubjectX500Principal().getName());

            stage = "startActivity";
            startActivityForResult(call, intent, "onAddResult");
        } catch (Exception e) {
            call.reject("FAILED at stage=" + stage + ": "
                    + e.getClass().getSimpleName() + ": " + e.getMessage(), e);
        }
    }

    /**
     * Pull CN out of an RFC 2253 subject. Android has no javax.naming.ldap, so
     * this is a regex rather than an LdapName — the MENDELU CN is an email
     * address with no separators in it, and escaped commas are handled anyway.
     */
    static String subjectCommonName(X509Certificate cert) {
        Matcher m = CN.matcher(cert.getSubjectX500Principal().getName());
        return m.find() ? m.group(1).replace("\\", "") : null;
    }

    @ActivityCallback
    private void onAddResult(PluginCall call, ActivityResult result) {
        if (call == null) {
            return;
        }
        String perNetwork = "(none)";
        if (result.getData() != null) {
            List<Integer> codes = result.getData()
                    .getIntegerArrayListExtra(Settings.EXTRA_WIFI_NETWORK_RESULT_LIST);
            if (codes != null) {
                StringBuilder sb = new StringBuilder();
                for (Integer c : codes) {
                    if (sb.length() > 0) {
                        sb.append(',');
                    }
                    sb.append(c);
                }
                perNetwork = sb.toString();
            }
        }
        JSObject ret = new JSObject();
        // resultCode -1 = RESULT_OK, 0 = RESULT_CANCELED. The JS side maps these
        // to an outcome; see src/mobile/configureEduroam.ts.
        ret.put("resultCode", result.getResultCode());
        // per-network 0 = ADD_WIFI_RESULT_SUCCESS, 1 = ADD_OR_UPDATE_FAILED,
        // 2 = ALREADY_EXISTS.
        ret.put("perNetwork", perNetwork);
        ret.put("identity", call.getData().optString("_identity"));
        ret.put("caSubject", call.getData().optString("_caSubject"));
        call.resolve(ret);
    }
}
