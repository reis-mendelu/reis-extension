import PDFKit
import UIKit
import XCTest

@testable import PdfInkPlugin

/**
 * A reader in a real key window, the way the space shows one, for tests that
 * drive it. Call `closeAll()` from tearDown: a reader left open takes the
 * responder back (#485's re-assert) from whatever test runs next, which broke
 * `ToolPickerResponderTests` in #492.
 *
 * The same show / open / picture that `ReaderPictureTests` keeps privately,
 * shared by the cover and recall tests.
 */
@available(iOS 16.0, *)
final class ReaderTestHost {
    let strings = PdfInkStrings(nil)
    private var windows: [UIWindow] = []
    private var readers: [PdfInkViewController] = []

    func show(pages: Int) throws -> (PdfInkViewController, URL) {
        let reader = PdfInkViewController(strings: strings)
        let window = UIWindow(frame: CGRect(x: 0, y: 0, width: 820, height: 1000))
        window.rootViewController = UINavigationController(rootViewController: reader)
        window.makeKeyAndVisible()
        window.layoutIfNeeded()
        windows.append(window)
        readers.append(reader)
        let ink = Self.tempInk()
        try open(reader, pages: pages, ink: ink)
        return (reader, ink)
    }

    /// Opens a blank `pages`-page PDF titled "t" with its ink at `ink`. Leaving
    /// the previous file saves it, as a switch in the sidebar does.
    func open(_ reader: PdfInkViewController, pages: Int, ink: URL) throws {
        let size = CGSize(width: 400, height: 500)
        let data = UIGraphicsPDFRenderer(bounds: CGRect(origin: .zero, size: size)).pdfData { ctx in
            for _ in 0..<pages {
                ctx.beginPage()
                UIColor.white.setFill()
                ctx.cgContext.fill(CGRect(origin: .zero, size: size))
            }
        }
        XCTAssertTrue(
            reader.load(document: try XCTUnwrap(PDFDocument(data: data)), inkURL: ink, title: "t"))
        reader.view.layoutIfNeeded()
    }

    static func tempInk() -> URL {
        FileManager.default.temporaryDirectory.appendingPathComponent("\(UUID().uuidString).ink")
    }

    static func picture() throws -> PictureIngest.Picture {
        let format = UIGraphicsImageRendererFormat()
        format.scale = 1
        let png = UIGraphicsImageRenderer(size: CGSize(width: 80, height: 60), format: format)
            .pngData { ctx in
                UIColor.orange.setFill()
                ctx.fill(CGRect(x: 0, y: 0, width: 80, height: 60))
            }
        return try XCTUnwrap(PictureIngest.picture(from: png))
    }

    func closeAll() {
        for reader in readers { reader.willClose() }
        readers = []
        for window in windows { window.isHidden = true }
        windows = []
    }
}
