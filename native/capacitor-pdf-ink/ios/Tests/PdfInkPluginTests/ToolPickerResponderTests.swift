import PDFKit
import UIKit
import XCTest

@testable import PdfInkPlugin

/**
 * The pens stay on screen.
 *
 * `PKToolPicker` is only visible while a responder it was told about is first
 * responder, and the reader only ever told it about the page. Reported as "the
 * drawing tool palette disappears"; reproduced on the simulator 2026-10-03 with
 * two triggers, neither of which put anything on screen to explain it:
 *
 * - Tapping a row in the sidebar makes the list cell first responder. Tapping the
 *   file that is already open loads nothing, so nothing took it back, and closing
 *   the sidebar left the responder nowhere. The pens were gone for good.
 * - A long-press or double-tap on the ink makes a view inside that page's canvas
 *   first responder (PencilKit's own menu and selection). Scrolling the page away
 *   releases the canvas, and the responder falls to PDFKit's document view.
 *
 * Both are "something that is not the page took the responder while nothing was
 * presented over the reader", so that is what these tests do. They assert on
 * the responder, not on `PKToolPicker.isVisible`: a hostless test process has
 * no app scene for the picker to appear in, so its visibility there means
 * nothing. On a device the picker follows the responder — that is its contract,
 * and the simulator host app is where the pens were seen to come back.
 */
@available(iOS 16.0, *)
final class ToolPickerResponderTests: XCTestCase {
    private var windows: [UIWindow] = []

    override func tearDown() {
        windows.forEach { $0.isHidden = true }
        windows = []
        super.tearDown()
    }

    func testThePageTakesTheResponderBackFromTheSidebar() throws {
        let (space, reader) = try show()

        let cell = Responder()
        space.split.view.addSubview(cell)
        XCTAssertTrue(cell.becomeFirstResponder())
        spin()

        XCTAssertTrue(page(of: reader).isFirstResponder, "the pens stayed away")
    }

    func testThePageTakesTheResponderBackWhenAPageReleasesIt() throws {
        let (_, reader) = try show()

        // Where the responder lands when a page whose canvas held it scrolls away.
        let documentView = try XCTUnwrap(page(of: reader).documentView)
        XCTAssertTrue(documentView.becomeFirstResponder())
        spin()

        XCTAssertTrue(page(of: reader).isFirstResponder, "the pens stayed away")
    }

    /// The other half: a sheet over the reader owns the responder (its search
    /// field, say) and the pens are deliberately put away for it. Taking the
    /// responder back here would close the keyboard under the student's fingers.
    func testASheetOverTheReaderKeepsItsResponder() throws {
        let (space, reader) = try show()
        let sheet = UIViewController()
        reader.present(sheet, animated: false)
        spin()
        XCTAssertNotNil(reader.presentedViewController)

        let field = Responder()
        space.split.view.addSubview(field)
        XCTAssertTrue(field.becomeFirstResponder())
        spin()

        XCTAssertTrue(field.isFirstResponder, "the reader took the responder from a sheet")
        sheet.dismiss(animated: false)
    }

    /// Closing puts the pens away on purpose; they must not come back over the
    /// app the student is returning to.
    func testClosingKeepsThePensAway() throws {
        let (space, reader) = try show()
        reader.willClose()

        let cell = Responder()
        space.split.view.addSubview(cell)
        XCTAssertTrue(cell.becomeFirstResponder())
        spin()

        XCTAssertTrue(cell.isFirstResponder)
    }

    // MARK: - Helpers

    /// Stands in for the sidebar's list cell: anything outside the page that can
    /// take the responder.
    private final class Responder: UIView {
        override var canBecomeFirstResponder: Bool { true }
    }

    private func show() throws -> (PdfInkSpace, PdfInkViewController) {
        let ink = FileManager.default.temporaryDirectory
            .appendingPathComponent("\(UUID().uuidString).ink")
        let space = PdfInkSpace(
            courseTitle: "Matematika",
            files: [.init(link: "a", name: "Přednáška 09", date: "12. 3. 2026", pdfURL: nil, inkURL: ink)],
            currentLink: "a", strings: PdfInkStrings(nil))
        let size = CGSize(width: 600, height: 800)
        let data = UIGraphicsPDFRenderer(bounds: CGRect(origin: .zero, size: size)).pdfData { ctx in
            ctx.beginPage()
            UIColor.white.setFill()
            ctx.cgContext.fill(CGRect(origin: .zero, size: size))
        }
        space.start(with: try XCTUnwrap(PDFDocument(data: data)))

        let window = UIWindow(frame: CGRect(x: 0, y: 0, width: 820, height: 1180))
        window.rootViewController = space.split
        window.makeKeyAndVisible()
        windows.append(window)
        spin()

        let nav = try XCTUnwrap(space.split.viewController(for: .secondary) as? UINavigationController)
        let reader = try XCTUnwrap(nav.viewControllers.first as? PdfInkViewController)
        XCTAssertTrue(page(of: reader).isFirstResponder, "the reader did not start with the pens")
        return (space, reader)
    }

    private func page(of reader: PdfInkViewController) -> PDFView {
        reader.view.subviews.compactMap { $0 as? PDFView }.first!
    }

    private func spin() {
        RunLoop.main.run(until: Date().addingTimeInterval(0.3))
    }
}
