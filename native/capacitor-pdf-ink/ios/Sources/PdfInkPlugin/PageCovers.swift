import CoreGraphics

/**
 * The geometry of covers, kept out of the view. Restored from the withdrawn
 * tool (d5026aaef) with covers named by id instead of position. Telling a drag
 * (create) from a tap (open, or remove) is UIKit's job now, in CoverLayerView's
 * recognizers — the withdrawn tool did it by distance in raw touches, and on a
 * real iPad PDFKit's scroller took those first.
 */
enum PageCovers {
    /// A drag shorter than this in either direction makes no cover: there is
    /// nothing to hide behind a sliver, and a sliver is usually a slipped tap.
    static let minimumSide: CGFloat = 24

    /// The block a drag covers, whichever corner it started from. Nil when it
    /// is too small to have been meant as one.
    static func rect(from start: CGPoint, to end: CGPoint) -> CGRect? {
        let rect = CGRect(
            x: min(start.x, end.x), y: min(start.y, end.y),
            width: abs(end.x - start.x), height: abs(end.y - start.y))
        guard rect.width >= minimumSide, rect.height >= minimumSide else { return nil }
        return rect
    }

    /// The cover under a point. The last one made wins: it is drawn on top.
    static func cover(at point: CGPoint, in covers: [PageCover]) -> PageCover? {
        covers.last { $0.rect.contains(point) }
    }
}
