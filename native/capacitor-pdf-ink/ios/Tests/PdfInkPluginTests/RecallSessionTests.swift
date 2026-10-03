import CoreGraphics
import XCTest

@testable import PdfInkPlugin

/// "Vyzkoušet se" asks the covers in the order a page is read, records each
/// answer, and can run again over just the ones not known yet.
final class RecallSessionTests: XCTestCase {
    private func cover(_ id: String, x: CGFloat, y: CGFloat) -> PageCover {
        PageCover(id: id, rect: CGRect(x: x, y: y, width: 60, height: 30))
    }

    func testAsksInReadingOrderAcrossPagesAndWithinAPage() throws {
        let covers: [Int: [PageCover]] = [
            2: [cover("p2-top", x: 0, y: 0)],
            0: [
                cover("p0-below", x: 0, y: 300),
                // Same row as p0-left (minY 100 vs 104), so left to right decides.
                cover("p0-right", x: 300, y: 100),
                cover("p0-left", x: 50, y: 104),
            ],
        ]

        let session = try XCTUnwrap(RecallSession(covers: covers))

        XCTAssertEqual(session.steps.map(\.id), ["p0-left", "p0-right", "p0-below", "p2-top"])
        XCTAssertEqual(session.steps.map(\.page), [0, 0, 0, 2])
    }

    func testAnAnswerReturnsTheReviewForTheCurrentCoverAndMovesOn() throws {
        var session = try XCTUnwrap(
            RecallSession(covers: [0: [cover("a", x: 0, y: 0), cover("b", x: 0, y: 100)]]))
        let when = Date(timeIntervalSince1970: 42)

        XCTAssertEqual(session.number, 1)
        let first = try XCTUnwrap(session.answer(knew: true, at: when))

        XCTAssertEqual(first.step, RecallStep(page: 0, id: "a"))
        XCTAssertEqual(first.review, CoverReview(date: when, knew: true))
        XCTAssertEqual(session.current, RecallStep(page: 0, id: "b"))
        XCTAssertEqual(session.number, 2)
    }

    func testFinishesAfterTheLastAnswerAndCounts() throws {
        var session = try XCTUnwrap(
            RecallSession(covers: [0: [cover("a", x: 0, y: 0), cover("b", x: 0, y: 100)]]))

        session.answer(knew: true, at: Date())
        session.answer(knew: false, at: Date())

        XCTAssertTrue(session.isFinished)
        XCTAssertNil(session.answer(knew: true, at: Date()), "nothing left to answer")
        XCTAssertEqual(session.number, 2, "the counter never reads 3 of 2")
        XCTAssertEqual(session.knownCount, 1)
        XCTAssertEqual(session.notYetIDs, ["b"])
    }

    func testTheRetryHoldsExactlyTheNotYetCoversInOrder() throws {
        let covers: [Int: [PageCover]] = [
            0: [cover("a", x: 0, y: 0), cover("b", x: 0, y: 100), cover("c", x: 0, y: 200)]
        ]
        var session = try XCTUnwrap(RecallSession(covers: covers))
        session.answer(knew: false, at: Date())
        session.answer(knew: true, at: Date())
        session.answer(knew: false, at: Date())

        let retry = try XCTUnwrap(session.retry(over: covers))

        XCTAssertEqual(retry.steps.map(\.id), ["a", "c"])
        XCTAssertEqual(retry.number, 1)
    }

    func testNoCoversNoSessionAndNothingToRetryWhenAllWereKnown() throws {
        XCTAssertNil(RecallSession(covers: [:]))
        XCTAssertNil(RecallSession(covers: [0: []]))

        let covers: [Int: [PageCover]] = [0: [cover("a", x: 0, y: 0)]]
        var session = try XCTUnwrap(RecallSession(covers: covers))
        session.answer(knew: true, at: Date())
        XCTAssertNil(session.retry(over: covers))
    }
}
