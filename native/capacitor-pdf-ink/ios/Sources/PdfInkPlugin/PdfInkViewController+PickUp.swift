import UIKit

/**
 * Picking a placed picture up again with a finger.
 *
 * Dominik placed a picture, pressed Hotovo, and could not move it again: the
 * only way back was the + menu's "Upravit obrázky" (device, 2026-10-03). With
 * an Apple Pencil drawing, the finger does not draw — it scrolls — so a finger
 * TAP on a picture is free to mean "this one": it starts arranging with that
 * picture selected. When the finger draws ("Draw with finger" on, or no Pencil
 * ever paired) a tap is ink, and the menu stays the way in.
 *
 * The tap recognizer sits on each page's overlay and only ever begins over a
 * picture, so a tap anywhere else, and every Pencil touch, is the page's as
 * before.
 */
@available(iOS 16.0, *)
extension PdfInkViewController: UIGestureRecognizerDelegate {
    /// What the system says about the finger. PencilKit's `.default` policy
    /// follows the same setting the tool picker's "Draw with finger" switches.
    static var systemFingerDraws: Bool { !UIPencilInteraction.prefersPencilOnlyDrawing }

    /// Picks up the topmost picture at `point` (page points) when the finger
    /// is not drawing. False — and nothing changes — otherwise.
    @discardableResult
    func pickUpPicture(at point: CGPoint, onPage index: Int) -> Bool {
        guard let picture = pictureToPickUp(at: point, onPage: index) else { return false }
        beginArrangingPictures(selecting: (index, picture.id))
        return true
    }

    func addPickUpTap(to overlay: PageOverlayView) {
        let tap = UITapGestureRecognizer(target: self, action: #selector(pickUpTapped(_:)))
        tap.allowedTouchTypes = [NSNumber(value: UITouch.TouchType.direct.rawValue)]
        tap.cancelsTouchesInView = false
        tap.delegate = self
        overlay.addGestureRecognizer(tap)
    }

    @objc private func pickUpTapped(_ tap: UITapGestureRecognizer) {
        guard tap.state == .ended, let (overlay, index) = overlay(of: tap) else { return }
        pickUpPicture(at: tap.location(in: overlay), onPage: index)
    }

    /// Only touches that come down over a picture it could pick up. Decided at
    /// touch-down, not at the end of the tap: every other page gesture waits
    /// for this one (below), so it must never so much as track a touch
    /// anywhere else — a stroke or a scroll on bare page is held up by nothing.
    public func gestureRecognizer(
        _ gestureRecognizer: UIGestureRecognizer, shouldReceive touch: UITouch
    ) -> Bool {
        guard let (overlay, index) = overlay(of: gestureRecognizer) else { return false }
        return pictureToPickUp(at: touch.location(in: overlay), onPage: index) != nil
    }

    /// Only over a picture, so it never competes for any other touch.
    public func gestureRecognizerShouldBegin(_ gestureRecognizer: UIGestureRecognizer) -> Bool {
        guard let (overlay, index) = overlay(of: gestureRecognizer) else { return false }
        return pictureToPickUp(at: gestureRecognizer.location(in: overlay), onPage: index) != nil
    }

    public func gestureRecognizer(
        _ gestureRecognizer: UIGestureRecognizer,
        shouldRecognizeSimultaneouslyWith otherGestureRecognizer: UIGestureRecognizer
    ) -> Bool { true }

    /// Everything else on the page waits for a tap that picks a picture up,
    /// the way it waits for a tap on a cover (`CoverLayerView`): PDFKit's
    /// double tap would otherwise also select the text under the picture.
    /// Not the cover layer's gestures — they already make everything wait for
    /// them, and both ways round would deadlock. A cover is never under a
    /// pick-up anyway (`pictureToPickUp`).
    public func gestureRecognizer(
        _ gestureRecognizer: UIGestureRecognizer,
        shouldBeRequiredToFailBy otherGestureRecognizer: UIGestureRecognizer
    ) -> Bool {
        !(otherGestureRecognizer.delegate is CoverLayerView)
            && otherGestureRecognizer.delegate !== self
    }

    private func pictureToPickUp(at point: CGPoint, onPage index: Int) -> PagePicture? {
        guard !arrangingPictures, !makingCovers, !fingerDraws() else { return nil }
        // A cover is on top: a tap on one opens the cover (CoverLayerView), and
        // this recognizer, on the overlay, would otherwise fire for it too.
        guard PageCovers.cover(at: point, in: covers[index] ?? []) == nil else { return nil }
        return PagePictures.topmost(at: point, in: pictures[index] ?? [])
    }

    private func overlay(of recognizer: UIGestureRecognizer) -> (PageOverlayView, Int)? {
        guard let overlay = recognizer.view as? PageOverlayView,
            let index = overlays.first(where: { $0.value === overlay })?.key
        else { return nil }
        return (overlay, index)
    }
}
