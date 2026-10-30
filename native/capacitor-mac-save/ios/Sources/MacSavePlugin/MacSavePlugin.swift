import Capacitor
import Foundation
import UIKit

/**
 * How a file leaves reIS on a Mac. JS side: src/mobile/macSave.ts.
 *
 * reIS reaches a Mac as its iPad app ("Designed for iPad"), so it is an iOS
 * process there: `Capacitor.getPlatform()` answers `ios` and `@capacitor/share`
 * opens the iOS share sheet (AirDrop, Messages, Notes…) for every download.
 * That is the right flow on an iPhone or iPad and the wrong one on a desktop.
 *
 * Measured on the Mac app (macOS 26, M3, 2026-10-26):
 *
 * 1. **The app cannot write into ~/Downloads.** `.downloadsDirectory` is the
 *    sandbox container's `Data/Downloads`, a symlink to the real ~/Downloads,
 *    and writing through it (or to the literal path) fails with
 *    NSCocoaErrorDomain 513 / EPERM. Adding
 *    `com.apple.security.files.downloads.read-write` to the entitlements does
 *    not help: an iOS-SDK build is signed without it.
 * 2. **`UIDocumentPickerViewController(forExporting:asCopy:)` is the macOS
 *    Save panel**: presenting it starts
 *    `com.apple.appkit.xpc.openAndSavePanelService`. `directoryURL` asks it
 *    to open in the student's Downloads.
 * 3. **`UIApplication.open` on a `.mobileconfig` the app wrote hands it to
 *    macOS** (ProfileHelper → mdmclient "Profile Downloaded"), and on an
 *    `x-apple.systempreferences:` link it opens System Settings.
 *
 * `save` and `open` refuse to run off a Mac: iPhone and iPad keep the share
 * sheet.
 */
@objc(MacSavePlugin)
public class MacSavePlugin: CAPPlugin, CAPBridgedPlugin, UIDocumentPickerDelegate,
    UIAdaptivePresentationControllerDelegate
{
    public let identifier = "MacSavePlugin"
    public let jsName = "MacSave"
    public let pluginMethods: [CAPPluginMethod] = [
        CAPPluginMethod(name: "isMac", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "save", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "open", returnType: CAPPluginReturnPromise),
    ]

    /// `isiOSAppOnMac`, not a user-agent test: an iPad's WKWebView also calls
    /// itself Macintosh. Same reasoning as EduroamPlugin.supported.
    private static var isMac: Bool { ProcessInfo.processInfo.isiOSAppOnMac }

    /// The picker's delegate is weak and the call must outlive this method, so
    /// both are held here until the panel settles. A promise that never settles
    /// would leave the student's download row locked.
    private var pendingCall: CAPPluginCall?
    private var picker: UIDocumentPickerViewController?

    @objc func isMac(_ call: CAPPluginCall) {
        call.resolve(["mac": Self.isMac])
    }

    /// Offers a file the app already wrote to the Save panel. Resolves with the
    /// saved copy's URL; rejects with code `cancelled` when the panel is closed.
    @objc func save(_ call: CAPPluginCall) {
        guard Self.isMac else {
            call.reject("the Save panel is for a Mac only", "unavailable")
            return
        }
        guard let raw = call.getString("url"), let source = Self.fileURL(raw) else {
            call.reject("save requires the file:// url of a file the app wrote")
            return
        }
        guard FileManager.default.fileExists(atPath: source.path) else {
            call.reject("nothing to save at \(source.path)")
            return
        }
        DispatchQueue.main.async {
            if self.pendingCall != nil {
                call.reject("a Save panel is already open", "busy")
                return
            }
            guard let presenter = self.bridge?.viewController else {
                call.reject("no view controller to present the Save panel from")
                return
            }
            let picker = UIDocumentPickerViewController(forExporting: [source], asCopy: true)
            picker.delegate = self
            picker.presentationController?.delegate = self
            // Open where a Mac download goes. The container's Downloads is a
            // symlink to the real folder; the panel needs the real path.
            picker.directoryURL = FileManager.default
                .urls(for: .downloadsDirectory, in: .userDomainMask).first?
                .resolvingSymlinksInPath()
            self.pendingCall = call
            self.picker = picker
            presenter.present(picker, animated: true)
        }
    }

    /// Hands a file the app wrote, or a system URL, to macOS.
    @objc func open(_ call: CAPPluginCall) {
        guard Self.isMac else {
            call.reject("opening files with macOS is for a Mac only", "unavailable")
            return
        }
        guard let raw = call.getString("url"), let url = Self.fileURL(raw) ?? URL(string: raw)
        else {
            call.reject("open requires a url")
            return
        }
        DispatchQueue.main.async {
            UIApplication.shared.open(url, options: [:]) { opened in
                call.resolve(["opened": opened])
            }
        }
    }

    public func documentPicker(
        _ controller: UIDocumentPickerViewController, didPickDocumentsAt urls: [URL]
    ) {
        settle { call in call.resolve(["url": urls.first?.absoluteString ?? ""]) }
    }

    public func documentPickerWasCancelled(_ controller: UIDocumentPickerViewController) {
        settle { call in call.reject("Save panel cancelled", "cancelled") }
    }

    public func presentationControllerDidDismiss(
        _ presentationController: UIPresentationController
    ) {
        settle { call in call.reject("Save panel cancelled", "cancelled") }
    }

    private func settle(_ finish: (CAPPluginCall) -> Void) {
        guard let call = pendingCall else { return }
        pendingCall = nil
        picker = nil
        finish(call)
    }

    private static func fileURL(_ raw: String) -> URL? {
        if raw.hasPrefix("file://") { return URL(string: raw) }
        if raw.hasPrefix("/") { return URL(fileURLWithPath: raw) }
        return nil
    }
}
