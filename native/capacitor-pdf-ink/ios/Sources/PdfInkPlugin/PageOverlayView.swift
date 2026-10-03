import PencilKit
import UIKit

/**
 * What PDFKit puts over one page.
 *
 * The canvas used to be handed to PDFKit directly. It is wrapped now, and the
 * wrapper does exactly one job: keep the canvas the same size as the page.
 *
 * The cover layer it was introduced for is gone, so the canvas is alone under it
 * again and the wrapper looks pointless. It stays anyway, and the reason is
 * plain caution, not a constraint: `willEndDisplayingOverlayView` would
 * identity-match bare canvases just as well, but unwrapping means touching the
 * one thing in this plugin that must not move (see below) for no gain.
 *
 * That size is load-bearing — and it is the canvas's FRAME, not its bounds:
 * the canvas is zoomed for sharpness (`inkScale`), which leaves its frame and
 * its content coordinates alone. A `PKDrawing`'s coordinates are the canvas's
 * coordinates, and every archive ever written assumed those are the page's — an
 * inset of a single point here moves the ink in every file on the device.
 */
final class PageOverlayView: UIView {
    let canvas = PKCanvasView()

    /**
     * How much finer than the page's own points the ink is rendered: the scale
     * PDFKit is showing the page at, so a stroke is as sharp as the text under
     * it. PencilKit renders its tiles at the screen scale of the canvas's own
     * coordinates, and PDFKit magnifies the whole page view, ink included —
     * at 1.0 the ink went soft the moment the page was drawn any bigger.
     *
     * The canvas is zoomed by this much and shrunk back by a transform. Its
     * frame is still exactly the page, and its content coordinates — the
     * drawing's — are still the page's points.
     */
    var inkScale: CGFloat = 1 {
        didSet { if inkScale != oldValue { setNeedsLayout() } }
    }

    override init(frame: CGRect) {
        super.init(frame: frame)
        backgroundColor = .clear
        isOpaque = false
        addSubview(canvas)
    }

    required init?(coder: NSCoder) { fatalError("PageOverlayView is code-only") }

    override func layoutSubviews() {
        super.layoutSubviews()
        // Bounds and center, never `frame`: the canvas carries a transform.
        canvas.bounds = CGRect(
            origin: .zero,
            size: CGSize(width: bounds.width * inkScale, height: bounds.height * inkScale))
        canvas.center = CGPoint(x: bounds.midX, y: bounds.midY)
        canvas.transform = CGAffineTransform(scaleX: 1 / inkScale, y: 1 / inkScale)
        canvas.minimumZoomScale = inkScale
        canvas.maximumZoomScale = inkScale
        canvas.zoomScale = inkScale
        canvas.contentOffset = .zero
    }
}
