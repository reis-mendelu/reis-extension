import CoreGraphics
import XCTest

@testable import PdfInkPlugin

/// The geometry a drag and a tap are judged by.
final class PageCoversTests: XCTestCase {
    private let big = PageCover(id: "big", rect: CGRect(x: 0, y: 0, width: 100, height: 100))

    func testADragMakesTheSameBlockWhicheverCornerItStartedFrom() {
        let downhill = PageCovers.rect(from: CGPoint(x: 10, y: 10), to: CGPoint(x: 90, y: 70))
        let uphill = PageCovers.rect(from: CGPoint(x: 90, y: 70), to: CGPoint(x: 10, y: 10))

        XCTAssertEqual(downhill, CGRect(x: 10, y: 10, width: 80, height: 60))
        XCTAssertEqual(downhill, uphill)
    }

    func testADragTooShortInEitherDirectionIsNotACover() {
        // Nothing to hide behind a sliver, and a sliver is usually a slipped tap.
        XCTAssertNil(PageCovers.rect(from: .zero, to: CGPoint(x: 200, y: 4)))
        XCTAssertNil(PageCovers.rect(from: .zero, to: CGPoint(x: 4, y: 200)))
        XCTAssertNotNil(PageCovers.rect(from: .zero, to: CGPoint(x: 24, y: 24)))
    }

    func testTheCoverUnderAPointIsTheOneOnTop() {
        let small = PageCover(id: "small", rect: CGRect(x: 20, y: 20, width: 40, height: 40))

        XCTAssertEqual(PageCovers.cover(at: CGPoint(x: 30, y: 30), in: [big, small])?.id, "small")
        XCTAssertEqual(PageCovers.cover(at: CGPoint(x: 80, y: 80), in: [big, small])?.id, "big")
        XCTAssertNil(PageCovers.cover(at: CGPoint(x: 500, y: 500), in: [big, small]))
    }
}
