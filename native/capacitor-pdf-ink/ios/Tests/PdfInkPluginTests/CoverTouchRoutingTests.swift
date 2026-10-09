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

    /// Dominik on the device: tapping a cover quickly several times missed
    /// taps. Reproduced in the simulator (4 fast taps, 2 reached the cover):
    /// PDFKit's own taps on the text under the cover — a double tap selects a
    /// word — did not wait for the cover's tap, took the second tap, and the
    /// taps after it landed on PDFKit's selection instead. Every other gesture
    /// must wait for a tap that lands on a cover. After the fix: 6 of 6 at
    /// 67 ms apart.
    func testPdfkitsTextTapsWaitForATapOnACover() {
        let layer = CoverLayerView()
        let wordSelection = UITapGestureRecognizer()
        wordSelection.numberOfTapsRequired = 2
        UIView().addGestureRecognizer(wordSelection)

        XCTAssertTrue(
            layer.gestureRecognizer(layer.tapRecognizer, shouldBeRequiredToFailBy: wordSelection))
        XCTAssertFalse(
            layer.gestureRecognizer(layer.tapRecognizer, shouldBeRequiredToFailBy: layer.dragRecognizer),
            "the tape's stroke must not wait for a tap")
    }

    /// Holding a finger on a strip offers to delete it. PDFKit's own long
    /// press (text selection) must wait for it, and the tap must not fire for
    /// a hold, nor the hold wait on the tap.
    func testAHoldOnAStripIsTheStripsAndOffersDelete() {
        let layer = CoverLayerView()
        let textHold = UILongPressGestureRecognizer()
        UIView().addGestureRecognizer(textHold)

        XCTAssertTrue(
            layer.gestureRecognizer(layer.holdRecognizer, shouldBeRequiredToFailBy: textHold))
        XCTAssertFalse(
            layer.gestureRecognizer(layer.holdRecognizer, shouldBeRequiredToFailBy: layer.tapRecognizer))
        XCTAssertFalse(
            layer.gestureRecognizer(layer.tapRecognizer, shouldBeRequiredToFailBy: layer.holdRecognizer),
            "tap and hold waiting on each other would deadlock")

        XCTAssertLessThanOrEqual(layer.holdRecognizer.minimumPressDuration, 0.3, "the menu felt slow at 0.45 s")

        layer.deleteLabel = "Smazat pásku"
        let menu = layer.deleteMenu(for: "a")
        let action = try? XCTUnwrap(menu.children.first as? UIAction)
        XCTAssertEqual(action?.title, "Smazat pásku")
        XCTAssertTrue(action?.attributes.contains(.destructive) ?? false)
    }

    /// The tape's stroke begins on the first movement, not after UIKit's pan
    /// threshold, so the strip grows under the Pencil from the start.
    func testTheTapesDragBeginsOnTheFirstMovement() {
        XCTAssertTrue(CoverLayerView().dragRecognizer is ImmediateDragRecognizer)
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

    /// The hold sits on the overlay, like the tape's drag: a finger beside a
    /// thin strip lands on the canvas, never on the cover layer, so a hold on
    /// the layer could not see it (Dominik, 2026-10-09: "cannot be removed
    /// when too small").
    func testTheHoldSitsOnTheOverlay() {
        let overlay = overlay()

        XCTAssertTrue(overlay.gestureRecognizers?.contains(overlay.coverLayer.holdRecognizer) ?? false)
    }

    /// Which strip a hold is about. A finger that does not draw reaches a thin
    /// strip from beside it; the Pencil, and a finger that draws, only on it —
    /// ink written next to a strip must stay ink.
    func testOnlyAFingerThatDoesNotDrawReachesAStripFromBesideIt() {
        let overlay = overlay()
        let layer = overlay.coverLayer
        layer.covers = [PageCover(id: "strip", rect: CGRect(x: 100, y: 100, width: 200, height: 8))]
        let beside = CGPoint(x: 150, y: 116)
        let on = CGPoint(x: 150, y: 104)

        XCTAssertEqual(layer.heldCover(at: beside, by: .direct), "strip")
        XCTAssertNil(layer.heldCover(at: beside, by: .pencil))
        XCTAssertEqual(layer.heldCover(at: on, by: .pencil), "strip")
        XCTAssertNil(layer.heldCover(at: CGPoint(x: 150, y: 300), by: .direct), "bare page is not a hold")

        layer.fingerDraws = { true }
        XCTAssertNil(layer.heldCover(at: beside, by: .direct))
        XCTAssertEqual(layer.heldCover(at: on, by: .direct), "strip")
    }

    /// Arranging pictures turns the layer off; the hold, now on the overlay,
    /// has to go off with it or a hold near a strip would carry it.
    func testAnInertLayerHoldsNothing() {
        let overlay = overlay()
        overlay.coverLayer.isUserInteractionEnabled = false

        XCTAssertFalse(overlay.coverLayer.holdRecognizer.isEnabled)

        overlay.coverLayer.isUserInteractionEnabled = true
        XCTAssertTrue(overlay.coverLayer.holdRecognizer.isEnabled)
    }
}
