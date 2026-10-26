import CoreGraphics
import Foundation

/**
 * A block a student puts over part of a page with the tape, to hide what is
 * under it until they tap it open (spec 2026-10-03-ipad-recall-covers-design.md).
 *
 * `rect` is in page points, the space the drawing and the pictures are in.
 * Which covers are open right now is NOT here, on purpose: that is never saved,
 * because reopening a file is exactly when the answers should be hidden again.
 */
struct PageCover: Codable, Equatable {
    var id: String
    var rect: CGRect

    init(id: String = UUID().uuidString, rect: CGRect) {
        self.id = id
        self.rect = rect
    }
}
