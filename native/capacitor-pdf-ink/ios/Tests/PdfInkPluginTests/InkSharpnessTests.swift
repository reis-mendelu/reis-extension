import PDFKit
import PencilKit
import XCTest

@testable import PdfInkPlugin

/**
 * Ink as sharp as the page under it.
 *
 * Reported as "the handwriting looks blurry while editing". PencilKit renders a
 * canvas's strokes into tiles at the screen scale of the canvas's OWN
 * coordinates, and the canvas is page-sized: its coordinates are PDF points.
 * PDFKit then draws the page bigger than that — 1.36x just fitting an A4 to an
 * iPad in portrait, more when pinched — by magnifying the whole page view, ink
 * tiles included, while it re-renders its own text sharp. Measured in a
 * simulator host on 2026-10-03: tiles at contentsScale 2 shown at 2.72 pixels
 * per point at fit, and at 8.2 at 3x.
 *
 * The fix renders the canvas zoomed by the page's on-screen scale and shrinks
 * it back with a transform, so it still covers exactly the page and the
 * drawing's coordinates are still the page's — every archive on a device
 * depends on that — while PencilKit draws its tiles at the scale they are seen.
 */
@available(iOS 16.0, *)
final class InkSharpnessTests: XCTestCase {
    func testAZoomedCanvasStillCoversExactlyThePage() {
        let overlay = PageOverlayView()
        overlay.frame = CGRect(x: 0, y: 0, width: 300, height: 500)

        overlay.inkScale = 2.5
        overlay.layoutIfNeeded()

        XCTAssertEqual(overlay.canvas.frame, overlay.bounds)
        XCTAssertEqual(overlay.canvas.zoomScale, 2.5, accuracy: 0.001, "the ink is not rendered any finer")
    }

    /// The drawing's coordinates are the page's at any scale: a stroke saved at
    /// (100, 200) is drawn at (100, 200) on the page, as it was before.
    func testTheDrawingKeepsThePagesCoordinates() {
        let overlay = PageOverlayView()
        overlay.frame = CGRect(x: 0, y: 0, width: 300, height: 500)
        overlay.inkScale = 2.5
        overlay.layoutIfNeeded()

        let canvas = overlay.canvas
        XCTAssertEqual(canvas.contentOffset, .zero)
        // A content point is at zoomScale times itself in the canvas's bounds.
        let onPage = canvas.convert(
            CGPoint(x: 100 * canvas.zoomScale, y: 200 * canvas.zoomScale), to: overlay)
        XCTAssertEqual(onPage.x, 100, accuracy: 0.01)
        XCTAssertEqual(onPage.y, 200, accuracy: 0.01)
    }

    /// Fitting the page is already a magnification on an iPad.
    func testTheInkFollowsThePageScale() {
        XCTAssertEqual(
            PdfInkViewController.inkScale(
                pageScale: 1.36, pageSize: CGSize(width: 595, height: 842), screenScale: 2),
            1.36, accuracy: 0.001)
    }

    /// A page drawn smaller than its own size is no reason to render coarser
    /// than before.
    func testTheInkIsNeverRenderedCoarserThanThePage() {
        XCTAssertEqual(
            PdfInkViewController.inkScale(
                pageScale: 0.5, pageSize: CGSize(width: 595, height: 842), screenScale: 2),
            1)
    }

    /// Every pixel of a fully inked page costs four bytes, and PDFKit keeps
    /// several pages alive. An iPad 8 has 3 GB, so the scale stops where one
    /// page could cost 64 MB: 2.9x for an A4, less for a poster.
    func testTheInkStopsAtAPixelBudget() {
        let a4 = PdfInkViewController.inkScale(
            pageScale: 8, pageSize: CGSize(width: 595, height: 842), screenScale: 2)
        XCTAssertEqual(a4, 2.89, accuracy: 0.01)
        let poster = PdfInkViewController.inkScale(
            pageScale: 8, pageSize: CGSize(width: 2384, height: 3370), screenScale: 2)
        XCTAssertEqual(poster, 1, "a page that big is not rendered finer than itself")
    }

    /// The reader hands the scale to every canvas it gives PDFKit, and again
    /// when the student pinches.
    func testTheReaderRendersInkAtTheScaleThePageIsShown() throws {
        let reader = PdfInkViewController(strings: PdfInkStrings(nil))
        let window = UIWindow(frame: CGRect(x: 0, y: 0, width: 820, height: 1180))
        window.rootViewController = reader
        window.isHidden = false
        window.layoutIfNeeded()
        defer { window.isHidden = true }
        let data = UIGraphicsPDFRenderer(bounds: CGRect(x: 0, y: 0, width: 595, height: 842)).pdfData {
            $0.beginPage()
        }
        let document = try XCTUnwrap(PDFDocument(data: data))
        let ink = FileManager.default.temporaryDirectory.appendingPathComponent("\(UUID().uuidString).ink")
        XCTAssertTrue(reader.load(document: document, inkURL: ink, title: "test"))
        reader.view.layoutIfNeeded()
        let page = try XCTUnwrap(document.page(at: 0))

        let overlay = try XCTUnwrap(reader.pdfView(PDFView(), overlayViewFor: page) as? PageOverlayView)
        XCTAssertGreaterThan(reader.pageScale, 1, "the page is not shown bigger than itself")
        XCTAssertEqual(overlay.inkScale, reader.pageScale, accuracy: 0.01)

        reader.pageScale = 2.5
        RunLoop.main.run(until: Date().addingTimeInterval(0.5))

        XCTAssertEqual(overlay.inkScale, 2.5, accuracy: 0.01, "a pinch left the ink at the old scale")
    }
}
