import CoreGraphics

/**
 * The geometry of covers, kept out of the view. Restored from the withdrawn
 * tool (d5026aaef) with covers named by id instead of position. Telling a drag
 * (create) from a tap (open, or remove) is UIKit's job now, in CoverLayerView's
 * recognizers — the withdrawn tool did it by distance in raw touches, and on a
 * real iPad PDFKit's scroller took those first.
 */
enum PageCovers {
    /// A drag that moved no further than this either way was a tap.
    static let tapSlop: CGFloat = 6

    /// The thinnest a cover gets. A stroke drawn as one line along the text
    /// becomes a strip this tall, centred on the line: about a line of slide
    /// text. Dominik on the device (2026-10-03): the first version needed 24 pt
    /// in BOTH directions, and a line made no box at all.
    static let minimumThickness: CGFloat = 16

    /// The block a drag covers, whichever corner it started from, never
    /// thinner than `minimumThickness`. Nil when the drag was a tap.
    static func rect(from start: CGPoint, to end: CGPoint) -> CGRect? {
        let width = abs(end.x - start.x)
        let height = abs(end.y - start.y)
        guard max(width, height) > tapSlop else { return nil }
        let rect = CGRect(x: min(start.x, end.x), y: min(start.y, end.y), width: width, height: height)
        return rect.insetBy(
            dx: -max(0, minimumThickness - width) / 2, dy: -max(0, minimumThickness - height) / 2)
    }

    /// The cover under a point. The last one made wins: it is drawn on top.
    static func cover(at point: CGPoint, in covers: [PageCover]) -> PageCover? {
        covers.last { $0.rect.contains(point) }
    }
}
