import CoreGraphics
import Foundation

/**
 * A picture the student put on a page.
 *
 * `frame` is in the page's displayed points, top-left origin — the space the
 * page's `PKDrawing` is in (PageOverlayView), so ink drawn over a picture stays
 * over it. Points, not fractions of the page, for the same reason. `jpeg` is
 * what `PictureIngest` produced once, at insert; nothing re-encodes it.
 *
 * Foundation and CoreGraphics only, like the archive that stores it.
 */
struct PagePicture: Codable, Equatable {
    var id: String
    var frame: CGRect
    var jpeg: Data
}

enum PictureCorner: CaseIterable {
    case topLeft, topRight, bottomLeft, bottomRight

    var isLeft: Bool { self == .topLeft || self == .bottomLeft }
    var isTop: Bool { self == .topLeft || self == .topRight }
}

/**
 * Where pictures go and how they move. Pure, so the part that decides whether a
 * picture can end up off the page or a pixel wide is tested without a view.
 * Every result is inside the page.
 */
enum PagePictures {
    /// The smallest side a picture can be resized to: still big enough to grab.
    static let minimumSide: CGFloat = 24

    /// A new picture: at most half the page each way, never larger than its own
    /// pixels, aspect kept, centred on `center` and then pushed onto the page.
    static func initialFrame(imageSize: CGSize, pageSize: CGSize, around center: CGPoint) -> CGRect {
        guard imageSize.width > 0, imageSize.height > 0 else { return .zero }
        let scale = min(
            1, pageSize.width / 2 / imageSize.width, pageSize.height / 2 / imageSize.height)
        let size = CGSize(width: imageSize.width * scale, height: imageSize.height * scale)
        return clamped(
            CGRect(
                x: center.x - size.width / 2, y: center.y - size.height / 2,
                width: size.width, height: size.height),
            in: pageSize)
    }

    /// Shrunk (aspect kept) if bigger than the page, then moved onto it.
    static func clamped(_ frame: CGRect, in pageSize: CGSize) -> CGRect {
        var rect = frame.standardized
        let shrink = min(1, pageSize.width / rect.width, pageSize.height / rect.height)
        if shrink < 1 {
            rect.size = CGSize(width: rect.width * shrink, height: rect.height * shrink)
        }
        rect.origin.x = min(max(rect.minX, 0), pageSize.width - rect.width)
        rect.origin.y = min(max(rect.minY, 0), pageSize.height - rect.height)
        return rect
    }

    static func moved(_ frame: CGRect, by translation: CGPoint, in pageSize: CGSize) -> CGRect {
        clamped(frame.offsetBy(dx: translation.x, dy: translation.y), in: pageSize)
    }

    /// A corner dragged to `point`: the opposite corner stays put, the aspect is
    /// kept, and the bigger of the two stretches wins so the corner follows the
    /// finger along either axis.
    static func resized(
        _ frame: CGRect, dragging corner: PictureCorner, to point: CGPoint, in pageSize: CGSize
    ) -> CGRect {
        guard frame.width > 0, frame.height > 0 else { return frame }
        let anchor = CGPoint(
            x: corner.isLeft ? frame.maxX : frame.minX, y: corner.isTop ? frame.maxY : frame.minY)
        let stretch = max(
            abs(point.x - anchor.x) / frame.width, abs(point.y - anchor.y) / frame.height)
        let roomX = corner.isLeft ? anchor.x : pageSize.width - anchor.x
        let roomY = corner.isTop ? anchor.y : pageSize.height - anchor.y
        let largest = min(roomX / frame.width, roomY / frame.height)
        let smallest = minimumSide / min(frame.width, frame.height)
        let scale = min(max(stretch, smallest), max(largest, smallest))
        let size = CGSize(width: frame.width * scale, height: frame.height * scale)
        let origin = CGPoint(
            x: corner.isLeft ? anchor.x - size.width : anchor.x,
            y: corner.isTop ? anchor.y - size.height : anchor.y)
        return clamped(CGRect(origin: origin, size: size), in: pageSize)
    }

    /// A pinch: scaled about the centre, never below the minimum.
    static func scaled(_ frame: CGRect, by factor: CGFloat, in pageSize: CGSize) -> CGRect {
        guard frame.width > 0, frame.height > 0 else { return frame }
        let scale = max(factor, minimumSide / min(frame.width, frame.height))
        let size = CGSize(width: frame.width * scale, height: frame.height * scale)
        return clamped(
            CGRect(
                x: frame.midX - size.width / 2, y: frame.midY - size.height / 2,
                width: size.width, height: size.height),
            in: pageSize)
    }

    static func point(of corner: PictureCorner, in frame: CGRect) -> CGPoint {
        CGPoint(x: corner.isLeft ? frame.minX : frame.maxX, y: corner.isTop ? frame.minY : frame.maxY)
    }

    /// Array order is stacking order, so the last one under the point is on top.
    static func topmost(at point: CGPoint, in pictures: [PagePicture]) -> PagePicture? {
        pictures.last { $0.frame.contains(point) }
    }
}
