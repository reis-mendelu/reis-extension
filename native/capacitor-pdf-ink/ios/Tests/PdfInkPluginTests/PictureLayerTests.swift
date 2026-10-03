import XCTest
@testable import PdfInkPlugin

final class PictureLayerTests: XCTestCase {
    private func layer(arranging: Bool) -> PictureLayerView {
        let layer = PictureLayerView(frame: CGRect(x: 0, y: 0, width: 600, height: 800))
        layer.pictures = [
            PagePicture(id: "a", frame: CGRect(x: 100, y: 100, width: 200, height: 100), jpeg: Data())
        ]
        layer.arranging = arranging
        return layer
    }

    /// Drawing mode: the layer is part of the page and never takes a touch.
    func testWhileDrawingAPictureTakesNoTouch() {
        let layer = layer(arranging: false)
        XCTAssertFalse(layer.isUserInteractionEnabled)
        XCTAssertFalse(layer.takesTouch(at: CGPoint(x: 150, y: 150)))
    }

    /// Arranging: a picture takes its touch, empty page does not — so a finger
    /// there still scrolls the document.
    func testWhileArrangingOnlyPicturesTakeATouch() {
        let layer = layer(arranging: true)
        XCTAssertNotNil(layer.hitTest(CGPoint(x: 150, y: 150), with: nil))
        XCTAssertNil(layer.hitTest(CGPoint(x: 500, y: 600), with: nil))
    }

    func testASelectedPictureCanBeGrabbedByItsCornerHandle() {
        let layer = layer(arranging: true)
        layer.selectedID = "a"
        layer.layoutIfNeeded()
        XCTAssertTrue(layer.takesTouch(at: CGPoint(x: 299 + 10, y: 199 + 10)), "a handle pokes past the corner")
    }

    func testDeleteRemovesTheSelectedPictureAndCommits() {
        let layer = layer(arranging: true)
        layer.selectedID = "a"
        var committed: [PagePicture]?
        layer.onCommit = { committed = $0 }
        layer.deleteSelected()
        XCTAssertEqual(committed, [])
        XCTAssertNil(layer.selectedID)
    }

    /// Each picture is drawn on its own side of the ink: the layer itself sits
    /// over the canvas, `belowInk` under it.
    func testEachPictureIsDrawnOnItsSideOfTheInk() {
        let layer = PictureLayerView(frame: CGRect(x: 0, y: 0, width: 600, height: 800))
        layer.pictures = [
            PagePicture(id: "over", frame: CGRect(x: 0, y: 0, width: 50, height: 50), jpeg: Data()),
            PagePicture(
                id: "under", frame: CGRect(x: 100, y: 0, width: 50, height: 50), jpeg: Data(),
                aboveInk: false),
        ]
        XCTAssertEqual(layer.aboveInk.shownIDs, ["over"])
        XCTAssertEqual(layer.belowInk.shownIDs, ["under"])
    }

    func testTheLayerButtonMovesTheSelectedPictureUnderOrOverTheInk() {
        let layer = layer(arranging: true)
        layer.selectedID = "a"
        var committed: [PagePicture]?
        layer.onCommit = { committed = $0 }

        layer.toggleSelectedInkSide()
        XCTAssertEqual(committed?.first?.aboveInk, false)
        layer.toggleSelectedInkSide()
        XCTAssertEqual(committed?.first?.aboveInk, true)
        XCTAssertEqual(layer.selectedID, "a", "the picture stays selected")
    }

    func testLeavingArrangingDropsTheSelection() {
        let layer = layer(arranging: true)
        layer.selectedID = "a"
        layer.arranging = false
        XCTAssertNil(layer.selectedID)
    }
}
