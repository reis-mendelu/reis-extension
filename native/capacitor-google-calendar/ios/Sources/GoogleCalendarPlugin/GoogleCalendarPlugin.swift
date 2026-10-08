import Capacitor
import Foundation
import GoogleSignIn
import UIKit

/// Google sign-in for the "Rozvrh" calendar sync — sign-in and token ONLY. The
/// sync itself is TypeScript (src/mobile/googleCalendar) and runs while the app
/// is open; there is no background task (spec 2026-10-08, "Phase 2").
///
/// GoogleSignIn holds the grant in the keychain, under an iOS OAuth client
/// ("reIS iOS", project reis-479320) named by GIDClientID in Info.plist. There is
/// no client secret anywhere, and reIS code only ever sees 1-hour access tokens.
///
/// Granular consent: Google's screen starts with the calendar boxes unticked, so
/// connect() reports what was actually granted, and asks only for what is missing
/// when the student connects again.
@objc(GoogleCalendarPlugin)
public class GoogleCalendarPlugin: CAPPlugin, CAPBridgedPlugin {
    public let identifier = "GoogleCalendarPlugin"
    public let jsName = "GoogleCalendar"
    public let pluginMethods: [CAPPluginMethod] = [
        CAPPluginMethod(name: "isAvailable", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "connect", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "accessToken", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "invalidateToken", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "disconnect", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "status", returnType: CAPPluginReturnPromise),
    ]

    static let appCreated = "https://www.googleapis.com/auth/calendar.app.created"
    static let calendarList = "https://www.googleapis.com/auth/calendar.calendarlist.readonly"
    static let scopes = [appCreated, calendarList]

    override public func load() {
        // ASWebAuthenticationSession returns on its own; this covers the URL-scheme
        // fallback GoogleSignIn may use. Observed here so SceneDelegate stays untouched.
        NotificationCenter.default.addObserver(forName: .capacitorOpenURL, object: nil, queue: .main) { note in
            if let url = (note.object as? [String: Any])?["url"] as? URL {
                _ = GIDSignIn.sharedInstance.handle(url)
            }
        }
    }

    /// Mac ("Designed for iPad") is unverified, so the row is hidden there until it is.
    @objc func isAvailable(_ call: CAPPluginCall) {
        call.resolve(["available": !ProcessInfo.processInfo.isiOSAppOnMac])
    }

    private func resolveUser(_ call: CAPPluginCall, _ user: GIDGoogleUser) {
        call.resolve([
            "email": user.profile?.email as Any,
            "scopes": user.grantedScopes ?? [],
        ])
    }

    private func rejectSignIn(_ call: CAPPluginCall, _ error: Error) {
        if (error as NSError).domain == kGIDSignInErrorDomain,
           (error as NSError).code == GIDSignInError.canceled.rawValue {
            call.reject("CANCELLED", "CANCELLED", error)
        } else {
            call.reject("AUTH_FAILED", "AUTH_FAILED", error)
        }
    }

    @objc func connect(_ call: CAPPluginCall) {
        DispatchQueue.main.async {
            guard let presenter = self.bridge?.viewController else {
                call.reject("NO_UI", "NO_UI")
                return
            }
            GIDSignIn.sharedInstance.restorePreviousSignIn { user, _ in
                guard let user else {
                    self.freshSignIn(call, presenter)
                    return
                }
                // A keychain grant can outlive its revocation (turned off on another
                // device, or in Google's settings). Prove it still works before reusing
                // it; otherwise connect would hand back a dead grant forever.
                user.refreshTokensIfNeeded { fresh, error in
                    guard let fresh, error == nil else {
                        GIDSignIn.sharedInstance.signOut()
                        self.freshSignIn(call, presenter)
                        return
                    }
                    let granted = Set(fresh.grantedScopes ?? [])
                    let missing = Self.scopes.filter { !granted.contains($0) }
                    if missing.isEmpty {
                        self.resolveUser(call, fresh)
                        return
                    }
                    fresh.addScopes(missing, presenting: presenter) { result, error in
                        if let error { self.rejectSignIn(call, error); return }
                        self.resolveUser(call, result?.user ?? fresh)
                    }
                }
            }
        }
    }

    private func freshSignIn(_ call: CAPPluginCall, _ presenter: UIViewController) {
        GIDSignIn.sharedInstance.signIn(
            withPresenting: presenter, hint: nil, additionalScopes: Self.scopes
        ) { result, error in
            if let error { self.rejectSignIn(call, error); return }
            guard let user = result?.user else {
                call.reject("AUTH_FAILED", "AUTH_FAILED")
                return
            }
            self.resolveUser(call, user)
        }
    }

    /// A refresh that Google refuses (invalid_grant: revoked at Google) or no
    /// stored grant means the student has to connect again.
    private static func isRevoked(_ error: Error) -> Bool {
        let e = error as NSError
        if e.domain == kGIDSignInErrorDomain, e.code == GIDSignInError.hasNoAuthInKeychain.rawValue {
            return true
        }
        return e.domain.contains("oauth_token") // AppAuth's OIDOAuthTokenErrorDomain: invalid_grant
    }

    private func withUser(_ body: @escaping (GIDGoogleUser?) -> Void) {
        DispatchQueue.main.async {
            if let user = GIDSignIn.sharedInstance.currentUser {
                body(user)
            } else {
                GIDSignIn.sharedInstance.restorePreviousSignIn { user, _ in body(user) }
            }
        }
    }

    @objc func accessToken(_ call: CAPPluginCall) {
        withUser { user in
            guard let user, (user.grantedScopes ?? []).contains(Self.appCreated) else {
                call.reject("REVOKED", "REVOKED")
                return
            }
            user.refreshTokensIfNeeded { fresh, error in
                if let error {
                    if Self.isRevoked(error) {
                        call.reject("REVOKED", "REVOKED", error)
                    } else {
                        call.reject("AUTH_FAILED", "AUTH_FAILED", error)
                    }
                    return
                }
                guard let token = fresh?.accessToken.tokenString else {
                    call.reject("REVOKED", "REVOKED")
                    return
                }
                call.resolve(["token": token])
            }
        }
    }

    /// GoogleSignIn refreshes on expiry by itself. A 401 on an unexpired token
    /// means the grant is gone, which the next refresh reports as REVOKED.
    @objc func invalidateToken(_ call: CAPPluginCall) {
        call.resolve()
    }

    /// Revokes at Google and forgets the keychain grant; resolves even if offline.
    @objc func disconnect(_ call: CAPPluginCall) {
        withUser { user in
            guard user != nil else {
                call.resolve()
                return
            }
            GIDSignIn.sharedInstance.disconnect { _ in
                GIDSignIn.sharedInstance.signOut()
                call.resolve()
            }
        }
    }

    @objc func status(_ call: CAPPluginCall) {
        withUser { user in
            call.resolve([
                "connected": (user?.grantedScopes ?? []).contains(Self.appCreated),
                "email": user?.profile?.email as Any,
            ])
        }
    }
}
