import Capacitor
import Foundation
import NetworkExtension
import Security

/**
 * Configures MENDELU's eduroam as a Wi-Fi network from the student's own IS
 * certificate, through NEHotspotConfigurationManager. One tap in reIS, then
 * Join in iOS's own alert. The iOS half of android/.../EduroamPlugin.java.
 *
 * The recipe follows geteduroam's open-source iOS app (BSD-3), which does
 * EAP-TLS with private institutional roots through this same API:
 *
 * 1. SecPKCS12Import opens the .p12 with the extraction password IS shows.
 * 2. The identity, its chain and the MENDELU root go into the keychain access
 *    group `<TeamID>.com.apple.networkextensionsharing` — the header for
 *    setIdentity / setTrustedServerCertificates says the API resolves them from
 *    exactly that group at authentication time. NEVER request persistent
 *    references (kSecReturnPersistentRef): iOS then rejects the profile as
 *    invalid EAP settings.
 * 3. Items are ADDED, never deleted first. The installed configuration holds a
 *    persistent reference to each item (see setIdentity in the SDK header) and
 *    resolves it at EAP time. Deleting and re-adding even an unchanged item
 *    mints a new reference and kills the old one — measured in the simulator
 *    keychain, 2026-10-03. When the device is on eduroam, `apply` answers
 *    `alreadyAssociated` and replaces nothing, so the configuration it kept was
 *    left pointing at deleted items, and the next full re-authentication
 *    failed: eduroam dropped. A re-add of an unchanged item returns
 *    errSecDuplicateItem and keeps the live reference instead.
 * 4. A superseded identity (the 366-day renewal) is deleted only after `apply`
 *    saved a configuration that uses the new one, and a new identity that no
 *    configuration took is rolled back — so the keychain never holds an
 *    identity whose presence would misreport what is installed.
 *
 * Every failure names its stage, mirroring the Android plugin: "rejected" is
 * only actionable if we know whether the PKCS#12, the keychain, the settings or
 * the system alert rejected it.
 *
 * Trade-off, disclosed in the sheet: a configuration added this way is removed
 * when reIS is deleted (Apple DTS, forums thread 719422).
 */
@objc(EduroamPlugin)
public class EduroamPlugin: CAPPlugin, CAPBridgedPlugin {
    public let identifier = "EduroamPlugin"
    public let jsName = "Eduroam"
    public let pluginMethods: [CAPPluginMethod] = [
        CAPPluginMethod(name: "configure", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "isAvailable", returnType: CAPPluginReturnPromise),
    ]

    /**
     * Whether this device's OS will take a Wi-Fi configuration from the app.
     *
     * False on a Mac. reIS ships to Macs as this same iOS app under "Designed
     * for iPad", so `Capacitor.getPlatform()` answers `ios` and the JS gate used
     * to offer the one-tap path there. It cannot work: every type in this file's
     * `import NetworkExtension` is declared
     * `API_AVAILABLE(ios(11.0)) API_UNAVAILABLE(macos, ...)`. The classes DO
     * resolve in the iOS-on-Mac runtime — which is what made this look supported
     * when it was first probed — but the system refuses the configuration, and a
     * student on a MacBook saw a red error banner from a build that worked on
     * their iPhone.
     *
     * `isiOSAppOnMac` rather than a user-agent test on the JS side: a WKWebView
     * calls itself `Macintosh` in more than one situation, which is the guess
     * `eduroamNative.ts` has always refused to make.
     */
    private static var supported: Bool {
        !ProcessInfo.processInfo.isiOSAppOnMac
    }

    @objc func isAvailable(_ call: CAPPluginCall) {
        call.resolve(["available": Self.supported])
    }

    private static let ssid = "eduroam"
    /// The anchor the working .mobileconfig has pinned since June. Matched
    /// against the RADIUS certificate's CN / DNSName; not Android's suffix rule.
    private static let trustedServerNames = ["aleph.mendelu.cz"]
    private static let identityLabel = "reIS eduroam identity"
    private static let chainLabel = "reIS eduroam chain"
    private static let rootLabel = "reIS eduroam root"
    private static let accessGroupSuffix = "com.apple.networkextensionsharing"

    private struct StageError: Error {
        let stage: String
        let reason: String
        var message: String { "FAILED at stage=\(stage): \(reason)" }
    }

    @objc func configure(_ call: CAPPluginCall) {
        // Belt to isAvailable's braces: the JS gate should never route a Mac
        // here, and if it ever does the student gets a sentence that names the
        // reason rather than whatever NEHotspotConfigurationManager throws.
        guard Self.supported else {
            call.reject(
                "FAILED at stage=platform: macOS cannot be configured by the app; install the eduroam profile instead",
                "unavailable")
            return
        }
        guard let p12Base64 = call.getString("p12Base64"),
            let passphrase = call.getString("passphrase"),
            let caDerBase64 = call.getString("caDerBase64")
        else {
            call.reject("configure requires p12Base64, passphrase and caDerBase64")
            return
        }

        // iOS 15.0 and 15.1 reject any profile that pins server certificates
        // (Apple forums 688323, fixed in 15.2). Say so rather than silently
        // dropping root pinning.
        if #available(iOS 15.2, *) {
            // supported
        } else {
            call.reject(
                "FAILED at stage=platform: iOS 15.0 and 15.1 cannot pin the MENDELU root; update iOS and try again"
            )
            return
        }

        // The API requires the app in the foreground and presents a system alert.
        DispatchQueue.main.async {
            do {
                let prepared = try self.buildConfiguration(
                    p12Base64: p12Base64, passphrase: passphrase, caDerBase64: caDerBase64)
                NEHotspotConfigurationManager.shared.apply(prepared.configuration) { error in
                    self.finish(call, error: error, prepared: prepared)
                }
            } catch let e as StageError {
                call.reject(e.message)
            } catch {
                call.reject("FAILED at stage=unknown: \(error.localizedDescription)")
            }
        }
    }

    // MARK: - Building the configuration

    /// The configuration to apply, plus what `finish` needs to settle the
    /// keychain once iOS has said what it did with it.
    private struct Prepared {
        let configuration: NEHotspotConfiguration
        /// The keychain's own reference (not the PKCS#12 import's), so the
        /// rollback and cleanup delete exactly the item the setters resolved.
        let identity: SecIdentity
        /// False when this exact identity was already in the keychain — the
        /// same certificate as a previous run, not a renewal.
        let identityIsNew: Bool
        let group: String
    }

    private func buildConfiguration(p12Base64: String, passphrase: String, caDerBase64: String)
        throws -> Prepared
    {
        // decode
        guard let p12 = Data(base64Encoded: p12Base64), !p12.isEmpty else {
            throw StageError(stage: "decode", reason: "p12Base64 is not base64 or is empty")
        }
        guard let caDer = Data(base64Encoded: caDerBase64), !caDer.isEmpty else {
            throw StageError(stage: "decode", reason: "caDerBase64 is not base64 or is empty")
        }

        // keystore
        var rawItems: CFArray?
        let importStatus = SecPKCS12Import(
            p12 as CFData, [kSecImportExportPassphrase as String: passphrase] as CFDictionary,
            &rawItems)
        guard importStatus == errSecSuccess else {
            throw StageError(
                stage: "keystore", reason: "SecPKCS12Import returned OSStatus \(importStatus)")
        }
        guard let items = rawItems as? [[String: Any]], let first = items.first,
            let identityRef = first[kSecImportItemIdentity as String]
        else {
            throw StageError(stage: "keystore", reason: "the PKCS#12 contains no identity")
        }
        // CF types do not bridge through `as?`; the import dictionary's value is a
        // SecIdentity by contract, so the forced cast is the documented form.
        let identity = identityRef as! SecIdentity
        let chain = (first[kSecImportItemCertChain as String] as? [SecCertificate]) ?? []

        // ca
        guard let root = SecCertificateCreateWithData(nil, caDer as CFData) else {
            throw StageError(stage: "ca", reason: "root DER is not an X.509 certificate")
        }

        let group = try accessGroup()

        // keychain — add only; see the file header, point 3.
        let identityIsNew =
            try add(
                [
                    kSecValueRef as String: identity,
                    kSecAttrLabel as String: Self.identityLabel,
                ], group: group, stage: "keychain", what: "identity") == errSecSuccess
        for cert in chain {
            try add(
                [
                    kSecClass as String: kSecClassCertificate,
                    kSecValueRef as String: cert,
                    kSecAttrLabel as String: Self.chainLabel,
                ], group: group, stage: "keychain", what: "chain certificate")
        }
        try add(
            [
                kSecClass as String: kSecClassCertificate,
                kSecValueRef as String: root,
                kSecAttrLabel as String: Self.rootLabel,
            ], group: group, stage: "keychain", what: "root certificate")

        // The setters resolve keychain-backed references, so read both back.
        let storedIdentity = try storedIdentity(matching: identity, group: group)
        let storedRoot: SecCertificate = try copyMatching(
            [
                kSecClass as String: kSecClassCertificate,
                kSecValueRef as String: root,
                kSecAttrAccessGroup as String: group,
                kSecReturnRef as String: true,
            ], stage: "keychain", what: "root certificate")

        // eapSettings
        let eap = NEHotspotEAPSettings()
        eap.supportedEAPTypes = [NSNumber(value: NEHotspotEAPSettings.EAPType.EAPTLS.rawValue)]
        eap.isTLSClientCertificateRequired = true
        eap.trustedServerNames = Self.trustedServerNames
        guard eap.setIdentity(storedIdentity) else {
            throw StageError(
                stage: "eapSettings",
                reason: "setIdentity returned false (identity not resolvable in the access group)")
        }
        guard eap.setTrustedServerCertificates([storedRoot]) else {
            throw StageError(
                stage: "eapSettings",
                reason:
                    "setTrustedServerCertificates returned false (root not resolvable in the access group)"
            )
        }

        // apply — joinOnce stays false (unsupported for EAP anyway); no
        // lifeTimeInDays (does not apply to enterprise networks).
        return Prepared(
            configuration: NEHotspotConfiguration(ssid: Self.ssid, eapSettings: eap),
            identity: storedIdentity, identityIsNew: identityIsNew, group: group)
    }

    // MARK: - Outcome mapping

    private func finish(_ call: CAPPluginCall, error: Error?, prepared: Prepared) {
        guard let error = error else {
            // The configuration now references the identity just added, so a
            // renewal's predecessor has nothing left pointing at it.
            deleteIdentities(group: prepared.group, except: prepared.identity)
            call.resolve(["outcome": "saved"])
            return
        }
        // Nothing was installed on these paths, so a new identity is referenced
        // by nothing. Leaving it would make the next run's add a duplicate and
        // read a renewal that never took as "the same certificate".
        let rollBack = {
            if prepared.identityIsNew {
                self.deleteIdentity(prepared.identity, group: prepared.group)
            }
        }
        let ns = error as NSError
        guard ns.domain == NEHotspotConfigurationErrorDomain else {
            call.resolve(["outcome": "failed", "detail": "\(ns.domain) \(ns.code)"])
            return
        }
        switch ns.code {
        case NEHotspotConfigurationError.userDenied.rawValue:
            // The student tapped Cancel. A choice, not a fault.
            rollBack()
            call.resolve(["outcome": "cancelled"])
        case NEHotspotConfigurationError.alreadyAssociated.rawValue:
            // The device is on eduroam right now — and that is ALL this code
            // means. It does not say a configuration exists (#261). Deleting the
            // app removes the configuration but leaves the association up, so a
            // reinstall-and-retap on campus lands here with nothing installed.
            // Reporting it as success sent students to campus believing eduroam
            // was set up. Ask what is actually configured instead of inferring.
            //
            // Nothing was replaced either way, and because the items were only
            // added, the configuration iOS kept still resolves its references.
            rollBack()
            NEHotspotConfigurationManager.shared.getConfiguredSSIDs { ssids in
                if ssids.contains(Self.ssid) {
                    // A new identity means IS holds a renewed certificate that
                    // the kept configuration does not use. Saying "already
                    // set up" here is how a renewal looked done and was not.
                    call.resolve([
                        "outcome": prepared.identityIsNew ? "renewal-blocked" : "already-configured"
                    ])
                } else {
                    // Associated, but nothing of ours backs it. iOS will keep
                    // short-circuiting every apply until the student forgets
                    // the network, which is the one step the JS side names.
                    call.resolve(["outcome": "stale-association"])
                }
            }
        case NEHotspotConfigurationError.pending.rawValue:
            rollBack()
            call.reject("FAILED at stage=apply: a previous eduroam request is still open")
        default:
            // invalidEAPSettings (4), internal (8), systemConfiguration (10),
            // unknown (11) and anything newer: a real failure, fail closed.
            //
            // This branch briefly asked `getConfiguredSSIDs` here and reported
            // success when eduroam was configured, on the theory that an
            // out-of-range `apply` errors over a configuration that installed
            // anyway. Both halves of that were wrong.
            //
            // It masks real failures. `getConfiguredSSIDs` lists what this app
            // installed at any point, and nothing removes the old
            // configuration before `apply`. So a genuine invalidEAPSettings —
            // a renewed certificate that will not install — arrives over a
            // configuration from the last successful run, and the student is
            // told the new one took. That is inferring from state instead of
            // from the operation, which is exactly the #261 mistake in a new
            // place.
            //
            // And it was not needed. Measured on the device: setting eduroam
            // up off campus completes with NO error, reports plain `saved`,
            // and iOS raises its own "Unable to join the network" alert
            // separately. So the case this was written for never reaches here;
            // the sheet's copy handles it instead.
            //
            // No rollback here, deliberately. An earlier note held that `apply`
            // can error over a configuration that did persist; if any code in
            // this branch ever does, deleting the new identity would recreate
            // the dead-reference bug. A leftover identity costs only precision
            // on the next run's duplicate check; a dead reference costs the
            // network.
            call.resolve([
                "outcome": "failed",
                "detail": "NEHotspotConfigurationError \(ns.code)",
            ])
        }
    }

    // MARK: - Keychain helpers

    /// `<TeamID>.com.apple.networkextensionsharing`. The prefix comes from
    /// Info.plist's `AppIdentifierPrefix`, which Xcode expands from
    /// $(AppIdentifierPrefix) at build time — so it follows whichever team signs,
    /// and is never a constant in source.
    private func accessGroup() throws -> String {
        guard
            let prefix = Bundle.main.object(forInfoDictionaryKey: "AppIdentifierPrefix")
                as? String,
            !prefix.isEmpty
        else {
            throw StageError(
                stage: "keychain",
                reason: "Info.plist has no AppIdentifierPrefix; see ios/App/App/Info.plist")
        }
        return prefix + Self.accessGroupSuffix
    }

    /// The keychain's own reference to `identity`, matched by certificate.
    ///
    /// Not a label query on its own: across a renewal two identities share the
    /// label until `finish` removes the old one, and a single-result label
    /// query returns the OLD one (measured), which would configure the expired
    /// certificate. Not `kSecValueRef` either: for an identity that query
    /// reports errSecSuccess and returns no reference at all (measured).
    private func storedIdentity(matching identity: SecIdentity, group: String) throws
        -> SecIdentity
    {
        var found: CFTypeRef?
        let status = SecItemCopyMatching(
            [
                kSecClass as String: kSecClassIdentity,
                kSecAttrLabel as String: Self.identityLabel,
                kSecAttrAccessGroup as String: group,
                kSecReturnRef as String: true,
                kSecMatchLimit as String: kSecMatchLimitAll,
            ] as CFDictionary, &found)
        let want = certificateData(identity)
        guard status == errSecSuccess, let all = found as? [SecIdentity],
            let match = all.first(where: { certificateData($0) == want })
        else {
            throw StageError(
                stage: "keychain",
                reason: "SecItemCopyMatching(identity) returned OSStatus \(status) without this certificate")
        }
        return match
    }

    /// Deletes one identity (its certificate and private key) by value.
    private func deleteIdentity(_ identity: SecIdentity, group: String) {
        // errSecItemNotFound is success: the caller asked for it to be gone.
        SecItemDelete(
            [
                kSecClass as String: kSecClassIdentity,
                kSecValueRef as String: identity,
                kSecAttrAccessGroup as String: group,
            ] as CFDictionary)
    }

    /// Deletes every reIS identity but `keep`. Identities only: certificates
    /// are unique by issuer and serial, so the root and chain sit under
    /// whichever label added them first (the root usually under the chain
    /// label, measured), and a label-based sweep could delete the root the new
    /// configuration pins. Those never change across a renewal anyway.
    private func deleteIdentities(group: String, except keep: SecIdentity) {
        var found: CFTypeRef?
        let status = SecItemCopyMatching(
            [
                kSecClass as String: kSecClassIdentity,
                kSecAttrLabel as String: Self.identityLabel,
                kSecAttrAccessGroup as String: group,
                kSecReturnRef as String: true,
                kSecMatchLimit as String: kSecMatchLimitAll,
            ] as CFDictionary, &found)
        guard status == errSecSuccess, let identities = found as? [SecIdentity] else { return }
        let kept = certificateData(keep)
        for identity in identities where certificateData(identity) != kept {
            deleteIdentity(identity, group: group)
        }
    }

    private func certificateData(_ identity: SecIdentity) -> Data? {
        var cert: SecCertificate?
        guard SecIdentityCopyCertificate(identity, &cert) == errSecSuccess, let cert = cert else {
            return nil
        }
        return SecCertificateCopyData(cert) as Data
    }

    /// SecItemAdd into the access group. `errSecDuplicateItem` is tolerated —
    /// the chain usually contains the root too, and a re-run adds the same
    /// items again — and returned, so the caller can tell a renewal from a
    /// repeat. A duplicate keeps the existing item and its live reference.
    @discardableResult
    private func add(_ attributes: [String: Any], group: String, stage: String, what: String)
        throws -> OSStatus
    {
        var attrs = attributes
        attrs[kSecAttrAccessGroup as String] = group
        attrs[kSecAttrAccessible as String] = kSecAttrAccessibleAfterFirstUnlock
        let status = SecItemAdd(attrs as CFDictionary, nil)
        guard status == errSecSuccess || status == errSecDuplicateItem else {
            // -34018 errSecMissingEntitlement = keychain-access-groups lacks the
            // networkextensionsharing group; see ios/App/App/App.entitlements.
            throw StageError(
                stage: stage, reason: "SecItemAdd(\(what)) returned OSStatus \(status)")
        }
        return status
    }

    private func copyMatching<T>(_ query: [String: Any], stage: String, what: String) throws -> T
    {
        var ref: CFTypeRef?
        let status = SecItemCopyMatching(query as CFDictionary, &ref)
        guard status == errSecSuccess, let value = ref else {
            throw StageError(
                stage: stage, reason: "SecItemCopyMatching(\(what)) returned OSStatus \(status)")
        }
        return value as! T
    }
}
