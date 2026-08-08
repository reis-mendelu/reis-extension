package cz.reis.app;

import android.content.SharedPreferences;
import android.security.keystore.KeyGenParameterSpec;
import android.security.keystore.KeyProperties;
import android.util.Base64;

import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;

import java.nio.charset.StandardCharsets;
import java.security.KeyStore;

import javax.crypto.Cipher;
import javax.crypto.KeyGenerator;
import javax.crypto.SecretKey;
import javax.crypto.spec.GCMParameterSpec;

/**
 * Encrypted storage for the IS session token.
 *
 * The app persists UISAuth, which authenticates as the student on its own and
 * never rotates. @capacitor/preferences is SharedPreferences — plaintext — so
 * anything able to read app storage could act as that student. Here the value
 * is encrypted with AES-256-GCM under a key generated inside the Android
 * Keystore: the key is hardware-backed where a TEE/StrongBox exists, cannot be
 * exported, and never enters the JS heap. Only ciphertext is persisted.
 *
 * Written by hand rather than pulled in as a dependency for two reasons: this
 * sits directly on the credential path, and the obvious library for it —
 * androidx.security:security-crypto (EncryptedSharedPreferences) — was
 * deprecated in April 2025.
 *
 * setUserAuthenticationRequired is deliberately NOT set: the token is read at
 * cold start to restore the session, and demanding a device unlock there would
 * break launch-time sync for a credential the OS already protects at rest.
 */
@CapacitorPlugin(name = "SecureStore")
public class SecureStorePlugin extends Plugin {

    private static final String KEYSTORE = "AndroidKeyStore";
    private static final String KEY_ALIAS = "reis.securestore.v1";
    private static final String PREFS = "reis_secure_store";
    private static final String TRANSFORMATION = "AES/GCM/NoPadding";
    private static final int GCM_TAG_BITS = 128;
    private static final int IV_BYTES = 12;

    private SharedPreferences prefs() {
        return getContext().getSharedPreferences(PREFS, android.content.Context.MODE_PRIVATE);
    }

    /**
     * Created on first use and reused thereafter. Generating it inside the
     * Keystore — rather than generating bytes here and importing them — is what
     * keeps the key material out of this process entirely.
     */
    private SecretKey key() throws Exception {
        KeyStore ks = KeyStore.getInstance(KEYSTORE);
        ks.load(null);
        KeyStore.Entry entry = ks.getEntry(KEY_ALIAS, null);
        if (entry instanceof KeyStore.SecretKeyEntry) {
            return ((KeyStore.SecretKeyEntry) entry).getSecretKey();
        }
        KeyGenerator gen = KeyGenerator.getInstance(KeyProperties.KEY_ALGORITHM_AES, KEYSTORE);
        gen.init(
            new KeyGenParameterSpec.Builder(
                KEY_ALIAS,
                KeyProperties.PURPOSE_ENCRYPT | KeyProperties.PURPOSE_DECRYPT
            )
                .setBlockModes(KeyProperties.BLOCK_MODE_GCM)
                .setEncryptionPaddings(KeyProperties.ENCRYPTION_PADDING_NONE)
                .setKeySize(256)
                .build()
        );
        return gen.generateKey();
    }

    @PluginMethod
    public void set(PluginCall call) {
        String storageKey = call.getString("key");
        String value = call.getString("value");
        if (storageKey == null || value == null) {
            call.reject("key and value are required");
            return;
        }
        try {
            Cipher cipher = Cipher.getInstance(TRANSFORMATION);
            cipher.init(Cipher.ENCRYPT_MODE, key());
            byte[] iv = cipher.getIV();
            byte[] ct = cipher.doFinal(value.getBytes(StandardCharsets.UTF_8));

            // IV prepended rather than stored beside the ciphertext: one string
            // cannot go out of sync with itself, and GCM needs a fresh IV per
            // write — which the Cipher generates for us on every init.
            byte[] joined = new byte[iv.length + ct.length];
            System.arraycopy(iv, 0, joined, 0, iv.length);
            System.arraycopy(ct, 0, joined, iv.length, ct.length);

            prefs().edit().putString(storageKey, Base64.encodeToString(joined, Base64.NO_WRAP)).apply();
            call.resolve();
        } catch (Exception e) {
            call.reject("secure set failed: " + e.getClass().getSimpleName());
        }
    }

    /**
     * Resolves {value: null} for "not stored" AND for "stored but unreadable".
     *
     * The Keystore key is invalidated by a device-credential change or a restore
     * onto new hardware, and decryption then throws for a value that is present
     * but permanently unrecoverable. Both cases mean the same thing to the app:
     * no session, present login. Rejecting instead would turn a recoverable
     * lapse into a boot failure. The dead entry is dropped so the next write
     * starts clean.
     */
    @PluginMethod
    public void get(PluginCall call) {
        String storageKey = call.getString("key");
        if (storageKey == null) {
            call.reject("key is required");
            return;
        }
        String stored = prefs().getString(storageKey, null);
        JSObject out = new JSObject();
        if (stored == null) {
            out.put("value", null);
            call.resolve(out);
            return;
        }
        try {
            byte[] joined = Base64.decode(stored, Base64.NO_WRAP);
            byte[] iv = new byte[IV_BYTES];
            System.arraycopy(joined, 0, iv, 0, IV_BYTES);

            Cipher cipher = Cipher.getInstance(TRANSFORMATION);
            cipher.init(Cipher.DECRYPT_MODE, key(), new GCMParameterSpec(GCM_TAG_BITS, iv));
            byte[] pt = cipher.doFinal(joined, IV_BYTES, joined.length - IV_BYTES);
            out.put("value", new String(pt, StandardCharsets.UTF_8));
        } catch (Exception e) {
            prefs().edit().remove(storageKey).apply();
            out.put("value", null);
        }
        call.resolve(out);
    }

    @PluginMethod
    public void remove(PluginCall call) {
        String storageKey = call.getString("key");
        if (storageKey == null) {
            call.reject("key is required");
            return;
        }
        prefs().edit().remove(storageKey).apply();
        call.resolve();
    }
}
