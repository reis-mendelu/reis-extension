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

    /// Over-the-ink pictures are drawn above every under-the-ink one, whatever
    /// the array order, so they win a touch there too.
    func testAPictureOverTheInkWinsATouchOverOneUnderIt() {
        let over = PagePicture(id: "over", frame: CGRect(x: 0, y: 0, width: 100, height: 100), jpeg: Data())
        let under = PagePicture(
            id: "under", frame: CGRect(x: 0, y: 0, width: 100, height: 100), jpeg: Data(), aboveInk: false)
        XCTAssertEqual(PagePictures.topmost(at: CGPoint(x: 50, y: 50), in: [over, under])?.id, "over")
        XCTAssertEqual(PagePictures.stackingOrder([over, under]).map(\.id), ["under", "over"])
    }

    func testANewPictureSitsOverTheInk() {
        XCTAssertTrue(PagePicture(id: "p", frame: .zero, jpeg: Data()).aboveInk)
    }

    /// Pictures saved before the choice existed were all under the ink.
    func testAPictureSavedWithoutTheChoiceReadsAsUnderTheInk() throws {
        let old: [String: Any] = ["id": "p", "frame": [[1.0, 2.0], [3.0, 4.0]], "jpeg": Data([1])]
        let data = try PropertyListSerialization.data(fromPropertyList: old, format: .binary, options: 0)
        let decoded = try PropertyListDecoder().decode(PagePicture.self, from: data)
        XCTAssertFalse(decoded.aboveInk)
        XCTAssertEqual(decoded.frame, CGRect(x: 1, y: 2, width: 3, height: 4))
    }

    /// A handle is drawn and grabbed in the same place, and that place is on
    /// the page: off it, PDFKit delivers no touch, so a handle half off the edge
    /// of a full-width picture only answered on its inner half (Dominik, device).
    func testAHandleAtThePageEdgeIsPulledOntoThePage() {
        let full = CGRect(x: 0, y: 0, width: 600, height: 300)
        let radius: CGFloat = 15
        XCTAssertEqual(
            PagePictures.handleCenter(of: .topLeft, in: full, pageSize: page, radius: radius),
            CGPoint(x: 15, y: 15))
        XCTAssertEqual(
            PagePictures.handleCenter(of: .bottomRight, in: full, pageSize: page, radius: radius),
            CGPoint(x: 585, y: 300))
    }

    func testAHandleAwayFromTheEdgeSitsOnTheCorner() {
        let frame = CGRect(x: 100, y: 100, width: 200, height: 100)
        XCTAssertEqual(
            PagePictures.handleCenter(of: .topRight, in: frame, pageSize: page, radius: 15),
            CGPoint(x: 300, y: 100))
    }

    func testTheTopmostPictureWinsATouch() {
        let under = PagePicture(id: "a", frame: CGRect(x: 0, y: 0, width: 100, height: 100), jpeg: Data())
        let over = PagePicture(id: "b", frame: CGRect(x: 50, y: 50, width: 100, height: 100), jpeg: Data())
        XCTAssertEqual(PagePictures.topmost(at: CGPoint(x: 75, y: 75), in: [under, over])?.id, "b")
        XCTAssertEqual(PagePictures.topmost(at: CGPoint(x: 10, y: 10), in: [under, over])?.id, "a")
        XCTAssertNil(PagePictures.topmost(at: CGPoint(x: 400, y: 400), in: [under, over]))
    }
}
