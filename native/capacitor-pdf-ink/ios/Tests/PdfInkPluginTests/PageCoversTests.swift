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

    /// Dominik on the device: a stroke drawn as one line along the text made
    /// no box at all — the first minimum was 24 pt in BOTH directions; then 16
    /// was still too tall. A line is now a strip 8 pt tall, centred on it.
    func testAStrokeAlongALineMakesAThinStripCentredOnIt() {
        let strip = PageCovers.rect(from: CGPoint(x: 10, y: 100), to: CGPoint(x: 210, y: 102))

        XCTAssertEqual(strip, CGRect(x: 10, y: 97, width: 200, height: 8))
    }

    func testASmallDragStillMakesABox() {
        let box = PageCovers.rect(from: CGPoint(x: 50, y: 50), to: CGPoint(x: 60, y: 58))

        XCTAssertEqual(box, CGRect(x: 50, y: 50, width: 10, height: 8))
    }

    /// Below the slop it was a tap, and a tap makes no box.
    func testATapMakesNoBox() {
        XCTAssertNil(PageCovers.rect(from: CGPoint(x: 50, y: 50), to: CGPoint(x: 52, y: 52)))
    }

    /// "Start expanding directly when I drag": the strip on screen grows from
    /// the point the Pencil came down, from the first point of movement.
    func testTheGrowingStripStartsAtTheTouchDown() {
        XCTAssertEqual(
            PageCovers.growingRect(from: CGPoint(x: 50, y: 50), to: CGPoint(x: 51, y: 50)),
            CGRect(x: 46.5, y: 46, width: 8, height: 8))
        XCTAssertEqual(
            PageCovers.growingRect(from: CGPoint(x: 50, y: 50), to: CGPoint(x: 90, y: 50)),
            CGRect(x: 50, y: 46, width: 40, height: 8))
    }

    func testTheCoverUnderAPointIsTheOneOnTop() {
        let small = PageCover(id: "small", rect: CGRect(x: 20, y: 20, width: 40, height: 40))

        XCTAssertEqual(PageCovers.cover(at: CGPoint(x: 30, y: 30), in: [big, small])?.id, "small")
        XCTAssertEqual(PageCovers.cover(at: CGPoint(x: 80, y: 80), in: [big, small])?.id, "big")
        XCTAssertNil(PageCovers.cover(at: CGPoint(x: 500, y: 500), in: [big, small]))
    }
}
