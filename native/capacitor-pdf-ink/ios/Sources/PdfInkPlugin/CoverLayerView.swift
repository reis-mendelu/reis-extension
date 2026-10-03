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
final class CoverLayerView: UIView, UIGestureRecognizerDelegate {
    var covers: [PageCover] = [] { didSet { setNeedsDisplay() } }
    /// The covers being looked under right now. Never saved.
    var revealed: Set<String> = [] { didSet { setNeedsDisplay() } }
    /// The cover "Vyzkoušet se" is asking about, outlined in `currentColor`.
    var currentID: String? { didSet { setNeedsDisplay() } }
    var currentColor: UIColor = .tintColor { didSet { setNeedsDisplay() } }
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

    /// The tape's stroke: drags out a new cover. Installed on the page overlay.
    let dragRecognizer = UIPanGestureRecognizer()
    /// Opens or shuts a cover; a drawing tap with the tape takes it away.
    let tapRecognizer = UITapGestureRecognizer()

    private var lastTapType: UITouch.TouchType = .direct
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
        dragRecognizer.maximumNumberOfTouches = 1
        dragRecognizer.isEnabled = false
        dragRecognizer.delegate = self
        tapRecognizer.addTarget(self, action: #selector(tapped(_:)))
        tapRecognizer.delegate = self
        addGestureRecognizer(tapRecognizer)
    }

    required init?(coder: NSCoder) { fatalError("CoverLayerView is code-only") }

    override func hitTest(_ point: CGPoint, with event: UIEvent?) -> UIView? {
        guard isUserInteractionEnabled, !isHidden, alpha > 0.01 else { return nil }
        return PageCovers.cover(at: point, in: covers) != nil ? self : nil
    }

    // MARK: - Gestures

    /// Everything else on the page waits for the tape's drag: PDFKit's scroll
    /// and its markup gestures, and the canvas's own. The drag only exists
    /// while the tape is selected and only takes drawing touches, so this
    /// holds up nothing else. The tap makes only the scrollers wait, as the
    /// picture layer's does (#492).
    func gestureRecognizer(
        _ gestureRecognizer: UIGestureRecognizer,
        shouldBeRequiredToFailBy otherGestureRecognizer: UIGestureRecognizer
    ) -> Bool {
        if gestureRecognizer === dragRecognizer { return otherGestureRecognizer !== tapRecognizer }
        return otherGestureRecognizer.view is UIScrollView
    }

    func gestureRecognizer(
        _ gestureRecognizer: UIGestureRecognizer, shouldReceive touch: UITouch
    ) -> Bool {
        if gestureRecognizer === tapRecognizer {
            lastTapType = touch.type
            return true
        }
        return draws(touch.type)
    }

    func gestureRecognizer(
        _ gestureRecognizer: UIGestureRecognizer,
        shouldRecognizeSimultaneouslyWith otherGestureRecognizer: UIGestureRecognizer
    ) -> Bool {
        otherGestureRecognizer.view === self
    }

    @objc private func dragged(_ pan: UIPanGestureRecognizer) {
        let location = pan.location(in: self)
        switch pan.state {
        case .began:
            let moved = pan.translation(in: self)
            dragStart = CGPoint(x: location.x - moved.x, y: location.y - moved.y)
            dragEnd = location
        case .changed:
            dragEnd = location
        case .ended:
            if let start = dragStart, let rect = PageCovers.rect(from: start, to: location) {
                onCreate?(rect)
            }
            dragStart = nil
            dragEnd = nil
        default:
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
            onRemove?(cover.id)
        } else {
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
                // Open: the answer shows through, with just enough outline left
                // that the student can shut it again.
                context.setStrokeColor(UIColor.systemGray2.cgColor)
                context.setLineDash(phase: 0, lengths: [4, 4])
                context.stroke(cover.rect.insetBy(dx: 0.5, dy: 0.5), width: 1)
                context.setLineDash(phase: 0, lengths: [])
            } else {
                context.setFillColor(UIColor.systemGray4.cgColor)
                context.fill(cover.rect)
            }
            if cover.id == currentID {
                context.setStrokeColor(currentColor.cgColor)
                context.stroke(cover.rect.insetBy(dx: -1, dy: -1), width: 2)
            }
        }
        guard isMakingCovers, let start = dragStart, let end = dragEnd else { return }
        context.setStrokeColor(UIColor.systemGray.cgColor)
        context.setLineDash(phase: 0, lengths: [6, 4])
        context.stroke(
            CGRect(
                x: min(start.x, end.x), y: min(start.y, end.y),
                width: abs(end.x - start.x), height: abs(end.y - start.y)), width: 1)
    }
}
