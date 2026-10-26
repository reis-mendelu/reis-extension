import UIKit

/**
 * What a cover looks like: a strip of masking tape stuck over the answer.
 *
 * Dominik on the first device build (2026-10-03): the flat grey block "is a bit
 * weird" — it read as a rendering hole, not as something put there. Paper-tone
 * tape with faint diagonal fibres reads as stuck on, and as something you can
 * lift. Fixed colours, not dynamic ones: the page is white in every appearance
 * (the layer is pinned light like the canvas), and the palette icon is the same
 * roll of tape.
 */
enum TapeStyle {
    static let fill = UIColor(red: 0.925, green: 0.890, blue: 0.800, alpha: 1)
    static let fibre = UIColor(red: 0.890, green: 0.850, blue: 0.745, alpha: 1)
    static let edge = UIColor(red: 0.800, green: 0.745, blue: 0.610, alpha: 1)
    static let cornerRadius: CGFloat = 3

    /// A shut cover: opaque, so nothing under it shows.
    static func drawShut(_ rect: CGRect, in context: CGContext) {
        let path = UIBezierPath(roundedRect: rect, cornerRadius: cornerRadius)
        context.saveGState()
        fill.setFill()
        path.fill()
        path.addClip()
        fibre.setStroke()
        let fibres = UIBezierPath()
        var x = rect.minX - rect.height
        while x < rect.maxX {
            fibres.move(to: CGPoint(x: x, y: rect.maxY))
            fibres.addLine(to: CGPoint(x: x + rect.height, y: rect.minY))
            x += 7
        }
        fibres.lineWidth = 2
        fibres.stroke()
        context.restoreGState()
        edge.setStroke()
        path.lineWidth = 0.75
        path.stroke()
    }

    /// An open cover: just its outline, so it can be found and shut again.
    static func drawOpen(_ rect: CGRect, in context: CGContext) {
        let path = UIBezierPath(
            roundedRect: rect.insetBy(dx: 0.5, dy: 0.5), cornerRadius: cornerRadius)
        path.lineWidth = 1
        path.setLineDash([4, 3], count: 2, phase: 0)
        edge.setStroke()
        path.stroke()
    }

    /// A strip carried by a held finger: lifted off the page by a soft shadow.
    static func drawLifted(_ rect: CGRect, in context: CGContext) {
        context.saveGState()
        context.setShadow(
            offset: CGSize(width: 0, height: 3), blur: 8,
            color: UIColor.black.withAlphaComponent(0.3).cgColor)
        drawShut(rect, in: context)
        context.restoreGState()
    }

    /// The block a stroke in progress will leave, half see-through so the
    /// student can see what they are covering.
    static func drawPreview(_ rect: CGRect, in context: CGContext) {
        context.saveGState()
        context.setAlpha(0.6)
        drawShut(rect, in: context)
        context.restoreGState()
    }
}
