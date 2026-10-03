import PencilKit
import UIKit

/**
 * What PDFKit puts over one page.
 *
 * Four things, bottom to top: the pictures under the ink
 * (`pictureLayer.belowInk`), the canvas, `pictureLayer` itself — the pictures
 * over the ink, with the handles and the gestures (2026-10-03) — and
 * `coverLayer` on top of all of them: the covers a student puts over an answer
 * (2026-10-03), which hide pictures too. The picture levels and the covers are
 * exactly the page with no transform: their coordinates are the page's points,
 * the same ones the drawing is in.
 *
 * The wrapper's other job is to keep the canvas the same size as the page.
 *
 * That size is load-bearing — and it is the canvas's FRAME, not its bounds:
 * the canvas is zoomed for sharpness (`inkScale`), which leaves its frame and
 * its content coordinates alone. A `PKDrawing`'s coordinates are the canvas's
 * coordinates, and every archive ever written assumed those are the page's — an
 * inset of a single point here moves the ink in every file on the device.
 */
final class PageOverlayView: UIView {
    let canvas = PKCanvasView()
    let pictureLayer = PictureLayerView()
    let coverLayer = CoverLayerView()

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
        addSubview(pictureLayer.belowInk)
        addSubview(canvas)
        addSubview(pictureLayer)
        addSubview(coverLayer)
    }

    required init?(coder: NSCoder) { fatalError("PageOverlayView is code-only") }

    override func layoutSubviews() {
        super.layoutSubviews()
        pictureLayer.belowInk.frame = bounds
        pictureLayer.frame = bounds
        coverLayer.frame = bounds
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
