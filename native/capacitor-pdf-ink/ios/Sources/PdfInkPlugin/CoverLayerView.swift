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
 * Gesture recognizers, not raw touches. The withdrawn layer (d5026aaef) used
 * touchesBegan/Ended, and on a real iPad PDFKit's scroller took the drag and
 * the page slid under the finger (ed7016e4). PDFKit's recognizers wait for
 * these to fail, the way they wait for the picture layer's (#492). A tap fails
 * the moment the finger travels, so a scroll that starts on a cover never
 * opens it on the way past.
 */
final class CoverLayerView: UIView, UIGestureRecognizerDelegate {
    var covers: [PageCover] = [] { didSet { setNeedsDisplay() } }
    /// The covers being looked under right now. Never saved.
    var revealed: Set<String> = [] { didSet { setNeedsDisplay() } }
    /// The cover "Vyzkoušet se" is asking about, outlined in `currentColor`.
    var currentID: String? { didSet { setNeedsDisplay() } }
    var currentColor: UIColor = .tintColor { didSet { setNeedsDisplay() } }
    /// Cover mode: the layer takes every touch on the page, and the drag is on.
    var isMakingCovers = false {
        didSet {
            dragRecognizer.isEnabled = isMakingCovers
            setNeedsDisplay()
        }
    }

    var onCreate: ((CGRect) -> Void)?
    var onRemove: ((String) -> Void)?
    var onToggle: ((String) -> Void)?

    /// One finger drags out a new cover; two fingers still scroll and zoom.
    let dragRecognizer = UIPanGestureRecognizer()
    /// Opens or shuts a cover; in cover mode, takes it away.
    let tapRecognizer = UITapGestureRecognizer()

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
        tapRecognizer.addTarget(self, action: #selector(tapped(_:)))
        for recognizer in [dragRecognizer, tapRecognizer] as [UIGestureRecognizer] {
            recognizer.delegate = self
            addGestureRecognizer(recognizer)
        }
    }

    required init?(coder: NSCoder) { fatalError("CoverLayerView is code-only") }

    override func hitTest(_ point: CGPoint, with event: UIEvent?) -> UIView? {
        guard isUserInteractionEnabled, !isHidden, alpha > 0.01 else { return nil }
        if isMakingCovers { return bounds.contains(point) ? self : nil }
        return PageCovers.cover(at: point, in: covers) != nil ? self : nil
    }

    // MARK: - Gestures

    /// PDFView's scroll and zoom wait for ours to fail, so dragging out a cover
    /// never scrolls the page under it. Ours only ever see touches the layer
    /// took in `hitTest`.
    func gestureRecognizer(
        _ gestureRecognizer: UIGestureRecognizer,
        shouldBeRequiredToFailBy otherGestureRecognizer: UIGestureRecognizer
    ) -> Bool {
        otherGestureRecognizer.view is UIScrollView
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
        if isMakingCovers { onRemove?(cover.id) } else { onToggle?(cover.id) }
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
