import Capacitor
import Foundation
import GoogleSignIn
import UIKit

/**
 * SPIKE: read-only Google Calendar token, held by Google's SDK on the device.
 *
 * - `connect` always signs in interactively with the requested scopes. It never
 *   takes the restore-previous-sign-in shortcut, because that path does not ask
 *   for additional scopes and would hand back a token without Calendar access.
 * - `getAccessToken` is the silent path: restore the SDK's Keychain-held session
 *   and refresh the access token with the refresh token the SDK stores. No UI,
 *   no reIS server, no serverAuthCode.
 */
@objc(GoogleCalendarAuthPlugin)
public class GoogleCalendarAuthPlugin: CAPPlugin, CAPBridgedPlugin {
    public let identifier = "GoogleCalendarAuthPlugin"
    public let jsName = "GoogleCalendarAuth"
    public let pluginMethods: [CAPPluginMethod] = [
        CAPPluginMethod(name: "connect", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "getAccessToken", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "disconnect", returnType: CAPPluginReturnPromise),
    ]

    private func configure(_ call: CAPPluginCall) -> Bool {
        guard let clientId = call.getString("clientId"), !clientId.isEmpty else {
            call.reject("clientId is required")
            return false
        }
        GIDSignIn.sharedInstance.configuration = GIDConfiguration(clientID: clientId)
        return true
    }

    private func payload(_ user: GIDGoogleUser) -> JSObject {
        var out: JSObject = [
            "accessToken": user.accessToken.tokenString,
            "grantedScopes": user.grantedScopes ?? [],
        ]
        if let exp = user.accessToken.expirationDate {
            out["expiresAtMs"] = Int(exp.timeIntervalSince1970 * 1000)
        }
        if let email = user.profile?.email { out["email"] = email }
        return out
    }

    @objc func connect(_ call: CAPPluginCall) {
        guard configure(call) else { return }
        let scopes = call.getArray("scopes", String.self) ?? []
        DispatchQueue.main.async {
            guard let presenter = self.bridge?.viewController else {
                call.reject("no view controller")
                return
            }
            GIDSignIn.sharedInstance.signIn(
                withPresenting: presenter, hint: nil, additionalScopes: scopes
            ) { result, error in
                if let error = error {
                    call.reject(error.localizedDescription)
                    return
                }
                guard let user = result?.user else {
                    call.reject("no user")
                    return
                }
                call.resolve(self.payload(user))
            }
        }
    }

    @objc func getAccessToken(_ call: CAPPluginCall) {
        guard configure(call) else { return }
        DispatchQueue.main.async {
            let finish: (GIDGoogleUser?, Error?) -> Void = { user, error in
                if let error = error {
                    call.reject(error.localizedDescription)
                    return
                }
                guard let user = user else {
                    call.reject("not connected")
                    return
                }
                user.refreshTokensIfNeeded { refreshed, refreshError in
                    if let refreshError = refreshError {
                        call.reject(refreshError.localizedDescription)
                        return
                    }
                    call.resolve(self.payload(refreshed ?? user))
                }
            }
            if let current = GIDSignIn.sharedInstance.currentUser {
                finish(current, nil)
            } else if GIDSignIn.sharedInstance.hasPreviousSignIn() {
                GIDSignIn.sharedInstance.restorePreviousSignIn(completion: finish)
            } else {
                call.reject("not connected")
            }
        }
    }

    @objc func disconnect(_ call: CAPPluginCall) {
        DispatchQueue.main.async {
            GIDSignIn.sharedInstance.disconnect { error in
                if let error = error {
                    call.reject(error.localizedDescription)
                    return
                }
                call.resolve()
            }
        }
    }
}
