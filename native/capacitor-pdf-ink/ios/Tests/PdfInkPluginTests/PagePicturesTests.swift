import XCTest
@testable import PdfInkPlugin

final class PagePicturesTests: XCTestCase {
    private let page = CGSize(width: 600, height: 800)

    func testANewPictureIsAtMostHalfThePageAndKeepsItsShape() {
        let frame = PagePictures.initialFrame(
            imageSize: CGSize(width: 2048, height: 1536), pageSize: page,
            around: CGPoint(x: 300, y: 400))
        XCTAssertEqual(frame.width, 300, accuracy: 0.01)
        XCTAssertEqual(frame.height, 225, accuracy: 0.01)
        XCTAssertEqual(frame.midX, 300, accuracy: 0.01)
        XCTAssertEqual(frame.midY, 400, accuracy: 0.01)
    }

    func testASmallPictureIsNotBlownUp() {
        let frame = PagePictures.initialFrame(
            imageSize: CGSize(width: 120, height: 80), pageSize: page, around: CGPoint(x: 300, y: 400))
        XCTAssertEqual(frame.size, CGSize(width: 120, height: 80))
    }

    func testANewPictureNearTheEdgeIsPushedOntoThePage() {
        let frame = PagePictures.initialFrame(
            imageSize: CGSize(width: 2000, height: 2000), pageSize: page, around: CGPoint(x: 590, y: -50))
        XCTAssertEqual(frame.maxX, 600, accuracy: 0.01)
        XCTAssertEqual(frame.minY, 0, accuracy: 0.01)
    }

    func testMovingStopsAtThePageEdge() {
        let start = CGRect(x: 100, y: 100, width: 200, height: 100)
        let moved = PagePictures.moved(start, by: CGPoint(x: 1000, y: -1000), in: page)
        XCTAssertEqual(moved, CGRect(x: 400, y: 0, width: 200, height: 100))
    }

    func testResizingFromACornerKeepsTheOppositeCornerAndTheShape() {
        let start = CGRect(x: 100, y: 100, width: 200, height: 100)
        let resized = PagePictures.resized(
            start, dragging: .bottomRight, to: CGPoint(x: 500, y: 150), in: page)
        XCTAssertEqual(resized.origin, start.origin)
        XCTAssertEqual(resized.width / resized.height, 2, accuracy: 0.001)
        XCTAssertEqual(resized.width, 400, accuracy: 0.01, "the bigger stretch wins")
    }

    func testResizingFromTheTopLeftGrowsUpAndLeft() {
        let start = CGRect(x: 200, y: 200, width: 100, height: 100)
        let resized = PagePictures.resized(
            start, dragging: .topLeft, to: CGPoint(x: 100, y: 150), in: page)
        XCTAssertEqual(resized.maxX, 300, accuracy: 0.01)
        XCTAssertEqual(resized.maxY, 300, accuracy: 0.01)
        XCTAssertEqual(resized.width, 200, accuracy: 0.01)
    }

    func testResizingNeverGoesBelowTheMinimumOrOffThePage() {
        let start = CGRect(x: 100, y: 100, width: 200, height: 100)
        let tiny = PagePictures.resized(start, dragging: .bottomRight, to: CGPoint(x: 101, y: 101), in: page)
        XCTAssertEqual(min(tiny.width, tiny.height), PagePictures.minimumSide, accuracy: 0.01)
        let huge = PagePictures.resized(start, dragging: .bottomRight, to: CGPoint(x: 5000, y: 5000), in: page)
        XCTAssertLessThanOrEqual(huge.maxX, 600.001)
        XCTAssertLessThanOrEqual(huge.maxY, 800.001)
        XCTAssertEqual(huge.origin, start.origin)
    }

    func testPinchingScalesAboutTheCentre() {
        let start = CGRect(x: 200, y: 200, width: 100, height: 50)
        let scaled = PagePictures.scaled(start, by: 2, in: page)
        XCTAssertEqual(scaled, CGRect(x: 150, y: 175, width: 200, height: 100))
    }

    func testTheTopmostPictureWinsATouch() {
        let under = PagePicture(id: "a", frame: CGRect(x: 0, y: 0, width: 100, height: 100), jpeg: Data())
        let over = PagePicture(id: "b", frame: CGRect(x: 50, y: 50, width: 100, height: 100), jpeg: Data())
        XCTAssertEqual(PagePictures.topmost(at: CGPoint(x: 75, y: 75), in: [under, over])?.id, "b")
        XCTAssertEqual(PagePictures.topmost(at: CGPoint(x: 10, y: 10), in: [under, over])?.id, "a")
        XCTAssertNil(PagePictures.topmost(at: CGPoint(x: 400, y: 400), in: [under, over]))
    }
}
