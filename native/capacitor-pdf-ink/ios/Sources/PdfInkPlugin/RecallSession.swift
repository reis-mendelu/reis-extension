import CoreGraphics
import Foundation

/// One cover to ask about: which page it is on and which cover it is.
struct RecallStep: Equatable {
    let page: Int
    let id: String
}

/**
 * One run of "Vyzkoušet se" over a file's covers: the order they are asked in,
 * where the test is, and the answers given so far.
 *
 * No UIKit. The reader shows `current` and calls `answer`; what to save (the
 * returned `CoverReview`) and what to draw stay with the reader.
 *
 * The order is reading order: page, then rows top to bottom, then left to
 * right within a row. A "row" is a 16 pt band of the cover's top edge, so two
 * covers dragged out side by side a few points apart still read left to right
 * rather than by a few points of height.
 */
struct RecallSession {
    static let rowHeight: CGFloat = 16

    let steps: [RecallStep]
    private(set) var position = 0
    private(set) var answers: [String: Bool] = [:]

    /// Nil when there is nothing to ask. `only` limits the session to those
    /// cover ids (the retry).
    init?(covers: [Int: [PageCover]], only ids: Set<String>? = nil) {
        let ordered =
            covers
            .flatMap { page, list in list.map { (page: page, cover: $0) } }
            .filter { ids?.contains($0.cover.id) ?? true }
            .sorted { Self.readingKey($0.page, $0.cover) < Self.readingKey($1.page, $1.cover) }
            .map { RecallStep(page: $0.page, id: $0.cover.id) }
        guard !ordered.isEmpty else { return nil }
        steps = ordered
    }

    private static func readingKey(_ page: Int, _ cover: PageCover)
        -> (Int, Int, CGFloat, CGFloat, String)
    {
        let row = Int((cover.rect.minY / rowHeight).rounded(.down))
        return (page, row, cover.rect.minX, cover.rect.minY, cover.id)
    }

    var current: RecallStep? { steps.indices.contains(position) ? steps[position] : nil }
    var isFinished: Bool { current == nil }
    /// The cover being asked, 1-based, for "3 z 10". Stays at `total` once finished.
    var number: Int { min(position + 1, steps.count) }
    var total: Int { steps.count }
    var knownCount: Int { answers.values.filter { $0 }.count }
    var notYetIDs: Set<String> { Set(answers.compactMap { $0.value ? nil : $0.key }) }

    /// Records the answer for the current cover and moves on. Returns the step
    /// it was for and the review to append to that cover; nil once finished.
    @discardableResult
    mutating func answer(knew: Bool, at date: Date) -> (step: RecallStep, review: CoverReview)? {
        guard let step = current else { return nil }
        answers[step.id] = knew
        position += 1
        return (step, CoverReview(date: date, knew: knew))
    }

    /// The same test over just the covers answered *Ještě ne*. Nil when there are none.
    func retry(over covers: [Int: [PageCover]]) -> RecallSession? {
        let ids = notYetIDs
        guard !ids.isEmpty else { return nil }
        return RecallSession(covers: covers, only: ids)
    }
}
