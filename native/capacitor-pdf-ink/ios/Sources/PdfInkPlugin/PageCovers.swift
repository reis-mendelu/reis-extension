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
    static let tapSlop: CGFloat = 3

    /// The thinnest a cover gets: a stroke drawn as one line along the text
    /// becomes a strip this tall, centred on the line. Dominik on the device
    /// (2026-10-03): 24 pt in both directions made no box for a line; 16 was
    /// still too tall.
    static let minimumThickness: CGFloat = 8

    /// The strip under the Pencil while it moves: from the touch-down to where
    /// it is now, never thinner than `minimumThickness` — so it shows, and
    /// grows, from the first point of movement.
    static func growingRect(from start: CGPoint, to end: CGPoint) -> CGRect {
        let width = abs(end.x - start.x)
        let height = abs(end.y - start.y)
        let rect = CGRect(x: min(start.x, end.x), y: min(start.y, end.y), width: width, height: height)
        return rect.insetBy(
            dx: -max(0, minimumThickness - width) / 2, dy: -max(0, minimumThickness - height) / 2)
    }

    /// The cover a finished stroke leaves: the growing strip, or nil when the
    /// Pencil hardly moved — that was a tap.
    static func rect(from start: CGPoint, to end: CGPoint) -> CGRect? {
        guard max(abs(end.x - start.x), abs(end.y - start.y)) > tapSlop else { return nil }
        return growingRect(from: start, to: end)
    }

    /// A strip moved by a held finger: shifted by the finger's travel, and
    /// kept inside the page — it stops at the edge rather than leaving.
    static func moved(_ rect: CGRect, by offset: CGPoint, within page: CGRect) -> CGRect {
        var moved = rect.offsetBy(dx: offset.x, dy: offset.y)
        moved.origin.x = min(max(moved.minX, page.minX), page.maxX - moved.width)
        moved.origin.y = min(max(moved.minY, page.minY), page.maxY - moved.height)
        return moved
    }

    /// The cover under a point. The last one made wins: it is drawn on top.
    static func cover(at point: CGPoint, in covers: [PageCover]) -> PageCover? {
        covers.last { $0.rect.contains(point) }
    }

    /// A fingertip, in screen points: Apple's minimum touch target.
    static let fingerReach: CGFloat = 44

    /// The cover a finger means. On a cover, that one; beside a cover thinner
    /// than `reach`, the nearest such — a strip is 8 pt and a fingertip is not,
    /// so a hold on a thin strip landed beside it and nothing happened
    /// ("cannot be removed when too small", Dominik, 2026-10-09). A cover
    /// already `reach` wide reaches no further than its edge.
    static func cover(near point: CGPoint, in covers: [PageCover], reach: CGFloat) -> PageCover? {
        if let on = cover(at: point, in: covers) { return on }
        // Newest first, so a tie goes to the strip on top, as on a strip itself.
        return covers.reversed()
            .filter { grown($0.rect, to: reach).contains(point) }
            .min { distance(from: point, to: $0.rect) < distance(from: point, to: $1.rect) }
    }

    private static func grown(_ rect: CGRect, to size: CGFloat) -> CGRect {
        rect.insetBy(dx: -max(0, size - rect.width) / 2, dy: -max(0, size - rect.height) / 2)
    }

    private static func distance(from point: CGPoint, to rect: CGRect) -> CGFloat {
        hypot(
            max(rect.minX - point.x, 0, point.x - rect.maxX),
            max(rect.minY - point.y, 0, point.y - rect.maxY))
    }
}
