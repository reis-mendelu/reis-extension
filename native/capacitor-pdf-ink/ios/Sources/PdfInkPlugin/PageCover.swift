import CoreGraphics
import Foundation

/**
 * A block a student puts over part of a page to try to recall what is under it
 * (spec 2026-10-03-ipad-recall-covers-design.md).
 *
 * `rect` is in page points, the space the drawing and the pictures are in.
 * `reviews` is every answer given in "Vyzkoušet se", oldest first — the history
 * a later exam-date scheduler reads. Which covers are open right now is NOT
 * here, on purpose: that is never saved, because reopening a file is exactly
 * when the answers should be hidden again.
 */
struct PageCover: Codable, Equatable {
    var id: String
    var rect: CGRect
    var reviews: [CoverReview]

    init(id: String = UUID().uuidString, rect: CGRect, reviews: [CoverReview] = []) {
        self.id = id
        self.rect = rect
        self.reviews = reviews
    }
}

/// One answer in a test: *Znám* (`knew`) or *Ještě ne*.
struct CoverReview: Codable, Equatable {
    var date: Date
    var knew: Bool
}
