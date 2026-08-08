import Capacitor
import Foundation
import Security

/**
 * Encrypted storage for the IS session token — the iOS half of the Android
 * Keystore plugin (`android/.../SecureStorePlugin.java`).
 *
 * The app persists UISAuth, which authenticates as the student on its own and
 * never rotates. @capacitor/preferences is UserDefaults — a plist in the app
 * container, in the clear — so anything able to read app storage could act as
 * that student.
 *
 * Where Android had to hand-roll AES-256-GCM under a Keystore key, iOS already
 * has the primitive: the Keychain encrypts at rest under a key held by the
 * Secure Enclave / effaceable storage, outside this process. So there is no
 * cipher code here, and that is the point — the crypto that is not written is
 * the crypto that cannot be got wrong.
 *
 * `kSecAttrAccessibleAfterFirstUnlockThisDeviceOnly` is the deliberate choice:
 *
 * - **AfterFirstUnlock**, not WhenUnlocked, because the token is read at cold
 *   start to restore the session and by background sync. WhenUnlocked would
 *   fail those reads on a locked device, which the app would correctly read as
 *   a lapsed session and prompt a needless sign-in.
 * - **ThisDeviceOnly** so the item never travels in an encrypted backup or to a
 *   restored device. That matches the Android side, where the Keystore key is
 *   non-exportable and a restore onto new hardware invalidates it — and
 *   `tokenStore.loadStoredToken` already treats that as a lapsed session.
 *
 * No `kSecAccessControl` / biometric gate, for the same reason Android does not
 * set `setUserAuthenticationRequired`: demanding a device unlock on the
 * cold-start read would break launch-time sync for a credential the OS already
 * protects at rest.
 */
@objc(SecureStorePlugin)
public class SecureStorePlugin: CAPPlugin, CAPBridgedPlugin {
    public let identifier = "SecureStorePlugin"
    public let jsName = "SecureStore"
    public let pluginMethods: [CAPPluginMethod] = [
        CAPPluginMethod(name: "set", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "get", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "remove", returnType: CAPPluginReturnPromise),
    ]

    /// Namespaced so the entry cannot collide with a Keychain item written by a
    /// dependency; the JS-supplied key becomes the account within it.
    private static let service = "cz.reis.app.securestore"

    private func query(for key: String) -> [String: Any] {
        [
            kSecClass as String: kSecClassGenericPassword,
            kSecAttrService as String: Self.service,
            kSecAttrAccount as String: key,
        ]
    }

    /**
     * Add, and fall back to an in-place update when the item already exists.
     *
     * **Never delete-then-add.** That reads as the simpler single path, but if
     * the add then fails the student is left with NO token — logged out by a
     * write whose only job was to refresh a value they already had. Updating in
     * place keeps the previous credential intact through a failure.
     *
     * A failure REJECTS. Resolving on a failed credential write is the worst
     * outcome available here — login would report success while nothing
     * persisted, and the student would be bounced back to the login sheet on
     * every cold start with no indication why.
     */
    @objc func set(_ call: CAPPluginCall) {
        guard let key = call.getString("key"), let value = call.getString("value") else {
            call.reject("key and value are required")
            return
        }
        guard let data = value.data(using: .utf8) else {
            call.reject("value is not valid UTF-8")
            return
        }

        var attributes = query(for: key)
        attributes[kSecValueData as String] = data
        attributes[kSecAttrAccessible as String] = kSecAttrAccessibleAfterFirstUnlockThisDeviceOnly

        var status = SecItemAdd(attributes as CFDictionary, nil)
        if status == errSecDuplicateItem {
            // The accessibility attribute is re-applied here too, so an item
            // written by an older build cannot keep a weaker one forever.
            status = SecItemUpdate(
                query(for: key) as CFDictionary,
                [
                    kSecValueData as String: data,
                    kSecAttrAccessible as String: kSecAttrAccessibleAfterFirstUnlockThisDeviceOnly,
                ] as CFDictionary)
        }

        if status == errSecSuccess {
            call.resolve()
        } else {
            call.reject("secure set failed: OSStatus \(status)")
        }
    }

    /**
     * Resolves `{value: null}` for "not stored" AND for "stored but unreadable",
     * matching the Android plugin. Both mean the same thing to the app: no
     * session, present login. Rejecting would turn a recoverable lapse into a
     * boot failure.
     *
     * ⚠️ **A failed read must not delete the item.** Several Keychain statuses are
     * TRANSIENT — `errSecInteractionNotAllowed` for a read before the first
     * unlock, `errSecNotAvailable` when the service is not up yet. Deleting on
     * those converts "try again in a moment" into "sign in again, permanently".
     * Only a value that is present and *not decodable as UTF-8* is genuinely
     * unusable, and that is the one case that clears the entry.
     *
     * This is where iOS deliberately diverges from the Android plugin, which
     * deletes on any decrypt failure. There it is correct: a Keystore key
     * invalidated by a credential change makes the ciphertext permanently
     * unrecoverable. iOS holds no app-side key, so it has no equivalent of that
     * permanent case — which is why copying Android's behaviour here would be a
     * bug rather than symmetry.
     */
    @objc func get(_ call: CAPPluginCall) {
        guard let key = call.getString("key") else {
            call.reject("key is required")
            return
        }

        var lookup = query(for: key)
        lookup[kSecReturnData as String] = true
        lookup[kSecMatchLimit as String] = kSecMatchLimitOne

        var item: CFTypeRef?
        let status = SecItemCopyMatching(lookup as CFDictionary, &item)

        if status == errSecSuccess {
            guard let data = item as? Data,
                let value = String(data: data, encoding: .utf8)
            else {
                // Present but not a string: no retry will fix it, so clear it
                // and let the next write start from a known state.
                SecItemDelete(query(for: key) as CFDictionary)
                call.resolve(["value": NSNull()])
                return
            }
            call.resolve(["value": value])
            return
        }

        // errSecItemNotFound and every transient status land here: no session
        // for now, and the stored item — if any — is left untouched so a later
        // read can still succeed.
        call.resolve(["value": NSNull()])
    }

    /// `errSecItemNotFound` is success: the caller asked for the key to be gone,
    /// and it is. `clearStoredToken` runs on paths where a missing token is the
    /// normal case (a lapsed session that was never stored).
    @objc func remove(_ call: CAPPluginCall) {
        guard let key = call.getString("key") else {
            call.reject("key is required")
            return
        }
        let status = SecItemDelete(query(for: key) as CFDictionary)
        if status == errSecSuccess || status == errSecItemNotFound {
            call.resolve()
        } else {
            call.reject("secure remove failed: OSStatus \(status)")
        }
    }
}
