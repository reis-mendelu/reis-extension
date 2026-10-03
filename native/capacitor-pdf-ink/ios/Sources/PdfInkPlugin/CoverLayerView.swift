import UIKit

/**
 * The covers over one page, and the gestures that make and open them.
 *
 * On top of everything else on the page, and invisible to touches that are
 * not about covers: outside a cover `hitTest` returns nothing, so drawing,
 * scrolling and picking a picture up reach the views below exactly as before.
 * Inside a cover it takes the touch — which is also why a covered patch cannot
 * be drawn on. It is covered.
 *
 * Covers are made with the tape, a tool in the pen palette (`CoverTool`).
 * Its drag is not on this layer but on the page overlay (`PageOverlayView`),
 * so it sees strokes that land on the canvas, whose own drawing PencilKit
 * switches off while the tape is selected. It takes only touches that draw —
 * the Pencil, and the finger only when the finger draws — so with a Pencil a
 * finger still scrolls.
 *
 * Gesture recognizers, not raw touches. The withdrawn layer (d5026aaef) used
 * touchesBegan/Ended, and on a real iPad PDFKit's scroller took the drag and
 * the page slid under the finger (ed7016e4). Every other recognizer on the
 * page waits for the tape's drag, and the scrollers wait for the tap. A tap
 * fails the moment the finger travels, so a scroll that starts on a cover
 * never opens it on the way past.
 */
@available(iOS 16.0, *)
final class CoverLayerView: UIView, UIGestureRecognizerDelegate {
    var covers: [PageCover] = [] { didSet { setNeedsDisplay() } }
    /// The covers being looked under right now. Never saved.
    var revealed: Set<String> = [] { didSet { setNeedsDisplay() } }
    /// The tape is selected: the drag is on, and a drawing tap takes a cover away.
    var isMakingCovers = false {
        didSet {
            dragRecognizer.isEnabled = isMakingCovers
            setNeedsDisplay()
        }
    }

    var onCreate: ((CGRect) -> Void)?
    var onRemove: ((String) -> Void)?
    var onToggle: ((String) -> Void)?

    /// Whether the finger draws (no Pencil paired, or "Draw with finger" on).
    /// Asked per touch, because the palette's switch can change it any time.
    var fingerDraws: () -> Bool = { false }

    /// The tape's stroke: drags out a new cover from its first movement.
    /// Installed on the page overlay.
    let dragRecognizer = ImmediateDragRecognizer()
    /// Opens or shuts a cover; a drawing tap with the tape takes it away.
    let tapRecognizer = UITapGestureRecognizer()
    /// A finger held on a strip offers to delete it (`+Hold`).
    let holdRecognizer = UILongPressGestureRecognizer()
    /// "Smazat pásku", from the app's strings.
    var deleteLabel = "Delete tape"
    lazy var deleteMenuInteraction = UIEditMenuInteraction(delegate: self)
    var heldCoverID: String?

    private var lastTapType: UITouch.TouchType = .direct
    /// Where the stroke's touch came down: the strip grows from here. (With
    /// UIKit's pan the start was ~10 pt late and small strokes made nothing —
    /// simulator log, 2026-10-03.)
    private var touchDown: CGPoint?
    private var dragStart: CGPoint?
    private var dragEnd: CGPoint?

    override init(frame: CGRect) {
        super.init(frame: frame)
        backgroundColor = .clear
        isOpaque = false
        contentMode = .redraw
        // PDF paper is white in any appearance, the same reason the canvas
        // under this one is forced light.
        overrideUserInterfaceStyle = .light
        dragRecognizer.addTarget(self, action: #selector(dragged(_:)))
        dragRecognizer.isEnabled = false
        dragRecognizer.delegate = self
        tapRecognizer.addTarget(self, action: #selector(tapped(_:)))
        tapRecognizer.delegate = self
        addGestureRecognizer(tapRecognizer)
        installHold()
    }

    required init?(coder: NSCoder) { fatalError("CoverLayerView is code-only") }

    override func hitTest(_ point: CGPoint, with event: UIEvent?) -> UIView? {
        guard isUserInteractionEnabled, !isHidden, alpha > 0.01 else { return nil }
        return PageCovers.cover(at: point, in: covers) != nil ? self : nil
    }

    // MARK: - Gestures

    /// Everything else on the page waits for ours. For the tape's drag:
    /// PDFKit's scroll and markup gestures and the canvas's own; it only exists
    /// while the tape is picked and only takes drawing touches, so this holds
    /// up nothing else. For the tap: everything too, not just the scrollers —
    /// PDFKit's double tap (word selection) took every second fast tap on a
    /// cover and the taps after it landed on its selection (device, 2026-10-03).
    /// The tap only ever sees touches that land on a cover (`hitTest`). The
    /// hold likewise, so PDFKit's own long press (text selection) waits for
    /// it. The tap waits for the hold to fail instead (`installHold`), so the
    /// pair is left out here — both ways round would deadlock.
    func gestureRecognizer(
        _ gestureRecognizer: UIGestureRecognizer,
        shouldBeRequiredToFailBy otherGestureRecognizer: UIGestureRecognizer
    ) -> Bool {
        let ours: [UIGestureRecognizer] = [dragRecognizer, tapRecognizer, holdRecognizer]
        return !ours.contains { $0 === otherGestureRecognizer }
    }

    func gestureRecognizer(
        _ gestureRecognizer: UIGestureRecognizer, shouldReceive touch: UITouch
    ) -> Bool {
        if gestureRecognizer === tapRecognizer {
            lastTapType = touch.type
            return true
        }
        if gestureRecognizer === holdRecognizer { return true }
        if draws(touch.type) { touchDown = touch.location(in: self) }
        // One line per stroke start: whether the tape took it, and why not.
        if isMakingCovers {
            NSLog("PdfInk: tape touch \(touch.type == .pencil ? "pencil" : "finger") taken=\(draws(touch.type))")
        }
        return draws(touch.type)
    }

    func gestureRecognizer(
        _ gestureRecognizer: UIGestureRecognizer,
        shouldRecognizeSimultaneouslyWith otherGestureRecognizer: UIGestureRecognizer
    ) -> Bool {
        otherGestureRecognizer.view === self
    }

    @objc private func dragged(_ pan: ImmediateDragRecognizer) {
        let location = pan.location(in: self)
        switch pan.state {
        case .began:
            dragStart = touchDown ?? location
            dragEnd = location
        case .changed:
            dragEnd = location
        case .ended:
            if let start = dragStart, let rect = PageCovers.rect(from: start, to: location) {
                NSLog("PdfInk: tape made a cover \(Int(rect.width))x\(Int(rect.height))")
                onCreate?(rect)
            } else {
                NSLog("PdfInk: tape stroke too small for a cover")
            }
            dragStart = nil
            dragEnd = nil
        default:
            // Cancelled or failed: something else on the page took the stroke.
            NSLog("PdfInk: tape stroke lost (state \(pan.state.rawValue))")
            dragStart = nil
            dragEnd = nil
        }
        setNeedsDisplay()
    }

    @objc private func tapped(_ tap: UITapGestureRecognizer) {
        guard tap.state == .ended,
            let cover = PageCovers.cover(at: tap.location(in: self), in: covers)
        else { return }
        // The tape in hand: a tap with what draws takes the cover away (and the
        // palette's undo brings it back). Any other tap looks under it.
        if isMakingCovers, draws(lastTapType) {
            NSLog("PdfInk: tape tap removed a cover")
            onRemove?(cover.id)
        } else {
            NSLog("PdfInk: cover tapped open/shut")
            onToggle?(cover.id)
        }
    }

    /// A touch that would put ink down: the Pencil, or a finger that draws.
    func draws(_ type: UITouch.TouchType) -> Bool {
        type == .pencil || (type == .direct && fingerDraws())
    }

    // MARK: - Drawing

    override func draw(_ rect: CGRect) {
        guard let context = UIGraphicsGetCurrentContext() else { return }
        for cover in covers {
            if revealed.contains(cover.id) {
                TapeStyle.drawOpen(cover.rect, in: context)
            } else {
                TapeStyle.drawShut(cover.rect, in: context)
            }
        }
        // The strip growing under the Pencil, from where it came down.
        guard isMakingCovers, let start = dragStart, let end = dragEnd else { return }
        TapeStyle.drawPreview(PageCovers.growingRect(from: start, to: end), in: context)
    }
}
