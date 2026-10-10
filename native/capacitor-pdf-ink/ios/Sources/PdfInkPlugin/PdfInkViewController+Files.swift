import UIKit
import UniformTypeIdentifiers

/**
 * Pictures from Files.
 *
 * Students save pictures to Downloads as often as to Photos — a slide someone
 * shared, a scan from a web page — and the photo picker cannot see Files. The
 * document picker can, and like the photo picker it runs out of process: no
 * permission, and the app only ever sees the one file the student picked.
 *
 * It hands over a copy (`asCopy`) inside the app's own temporary folder, so
 * there is no security-scoped bookmark to keep. The copy is read once,
 * ingested exactly like a photo (`PictureIngest`) and deleted: the student's
 * file stays theirs, and only the downscaled JPEG lives in the ink archive.
 */
@available(iOS 16.0, *)
extension PdfInkViewController: UIDocumentPickerDelegate {
    func presentFilePicker() {
        let picker = UIDocumentPickerViewController(forOpeningContentTypes: [.image], asCopy: true)
        picker.allowsMultipleSelection = false
        picker.delegate = self
        presentPicking(picker)
    }

    /// The picker dismisses itself; the pens and the file check are ours, the
    /// same as for a photo (`finishPicking`).
    func documentPicker(
        _ controller: UIDocumentPickerViewController, didPickDocumentsAt urls: [URL]
    ) {
        guard let url = urls.first else { return showToolPicker() }
        let target = pickingFor
        DispatchQueue.global(qos: .userInitiated).async { [weak self] in
            let picture = PictureIngest.picture(at: url)
            try? FileManager.default.removeItem(at: url)
            DispatchQueue.main.async { self?.finishPicking(picture, error: nil, for: target) }
        }
    }

    func documentPickerWasCancelled(_ controller: UIDocumentPickerViewController) {
        showToolPicker()
    }
}
