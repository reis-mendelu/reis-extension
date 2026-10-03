import PencilKit
import UIKit
import XCTest

@testable import PdfInkPlugin

/**
 * Whether a touch on the page can actually reach the cover layer, and whether
 * PDFKit's scroller lets it keep the touch (restored from ed7016e4, by id).
 *
 * The layer's own `hitTest` proves nothing about the hierarchy it lives in:
 * the canvas and the picture layer are siblings, PDFKit sets the frames, and a
 * layer that is never laid out is a layer of zero size that no touch lands on.
 * These ask the container the question a real touch asks it.
 */
@available(iOS 16.0, *)
final class CoverTouchRoutingTests: XCTestCase {
    private let page = CGRect(x: 0, y: 0, width: 595, height: 842)
    private let cover = PageCover(id: "a", rect: CGRect(x: 100, y: 100, width: 200, height: 80))

    private func overlay() -> PageOverlayView {
        let overlay = PageOverlayView()
        overlay.frame = page  // all PDFKit does
        overlay.layoutIfNeeded()
        return overlay
    }

    func testTheCoverLayerIsOnTopAndSizedByPdfkitSettingTheFrame() {
        let overlay = overlay()

        XCTAssertTrue(overlay.subviews.last === overlay.coverLayer)
        XCTAssertEqual(overlay.coverLayer.frame, overlay.bounds)
        XCTAssertEqual(overlay.canvas.frame, overlay.bounds)
    }

    func testATouchOnACoverReachesTheCoverLayerAndNotTheCanvas() {
        let overlay = overlay()
        overlay.coverLayer.covers = [cover]

        let hit = overlay.hitTest(CGPoint(x: 150, y: 140), with: nil)

        XCTAssertTrue(
            hit === overlay.coverLayer, "a tap on a cover landed on \(String(describing: hit))")
    }

    func testATouchOnBarePageReachesTheCanvasSoDrawingStillWorks() {
        let overlay = overlay()
        overlay.coverLayer.covers = [cover]

        let hit = overlay.hitTest(CGPoint(x: 450, y: 600), with: nil)

        XCTAssertFalse(hit === overlay.coverLayer, "the cover layer swallowed a touch on bare page")
    }

    /// With the tape in hand a stroke lands on the canvas, not on the cover
    /// layer: the drag that makes covers has to sit above both, on the overlay.
    func testTheTapesDragSitsOnTheOverlayAboveTheCanvas() {
        let overlay = overlay()
        overlay.coverLayer.isMakingCovers = true

        XCTAssertTrue(overlay.gestureRecognizers?.contains(overlay.coverLayer.dragRecognizer) ?? false)
        XCTAssertFalse(
            overlay.hitTest(CGPoint(x: 450, y: 600), with: nil) === overlay.coverLayer,
            "bare page is the canvas's even with the tape: the drag is not a hit view")
    }

    /// The device failure of 2026-09-07: PDFKit's scroller took the drag and
    /// the page slid instead. Its recognizers must wait for ours, the way they
    /// wait for the picture layer's (#492).
    func testPdfkitsScrollerWaitsForTheCoverLayersGestures() {
        let layer = CoverLayerView()
        let scroller = UIScrollView()

        for ours in [layer.dragRecognizer, layer.tapRecognizer] as [UIGestureRecognizer] {
            XCTAssertTrue(
                layer.gestureRecognizer(
                    ours, shouldBeRequiredToFailBy: scroller.panGestureRecognizer))
        }
    }

    /// PDFKit's markup gestures over text are not on a scroll view; they must
    /// wait for the tape too, or a stroke over text goes to them.
    func testEveryOtherPageGestureWaitsForTheTape() {
        let layer = CoverLayerView()
        let textGesture = UILongPressGestureRecognizer()
        UIView().addGestureRecognizer(textGesture)

        XCTAssertTrue(layer.gestureRecognizer(layer.dragRecognizer, shouldBeRequiredToFailBy: textGesture))
        XCTAssertFalse(layer.gestureRecognizer(layer.dragRecognizer, shouldBeRequiredToFailBy: layer.tapRecognizer))
    }

    /// With a Pencil, the tape answers only to the Pencil: a finger still scrolls.
    func testOnlyTouchesThatDrawMakeCovers() {
        let layer = CoverLayerView()
        XCTAssertTrue(layer.draws(.pencil))
        XCTAssertFalse(layer.draws(.direct))

        layer.fingerDraws = { true }
        XCTAssertTrue(layer.draws(.direct))
    }

    /// Outside cover mode the drag must not exist: a scroll that starts on a
    /// cover would otherwise be held up waiting for it.
    func testTheDragExistsOnlyInCoverMode() {
        let layer = CoverLayerView()
        XCTAssertFalse(layer.dragRecognizer.isEnabled)

        layer.isMakingCovers = true
        XCTAssertTrue(layer.dragRecognizer.isEnabled)

        layer.isMakingCovers = false
        XCTAssertFalse(layer.dragRecognizer.isEnabled)
    }

    func testAnInertLayerTakesNothing() {
        let overlay = overlay()
        overlay.coverLayer.covers = [cover]
        overlay.coverLayer.isUserInteractionEnabled = false  // what arranging pictures sets

        XCTAssertFalse(overlay.hitTest(CGPoint(x: 150, y: 140), with: nil) === overlay.coverLayer)
    }
}
