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

    /// The visible handle of a picture flush with the page edge takes the touch
    /// — all of it is on the page now.
    func testAHandleOfAFullWidthPictureTakesTouchesWhereItIsDrawn() {
        let layer = PictureLayerView(frame: CGRect(x: 0, y: 0, width: 600, height: 800))
        layer.pictures = [
            PagePicture(id: "a", frame: CGRect(x: 0, y: 100, width: 600, height: 300), jpeg: Data())
        ]
        layer.arranging = true
        layer.selectedID = "a"
        let radius = PictureLayerView.handleSide / 2
        // The inner edge of the bottom-right handle, now pulled onto the page:
        // outside the picture, inside the handle.
        XCTAssertTrue(layer.takesTouch(at: CGPoint(x: 600 - radius, y: 400 + radius - 1)))
        XCTAssertEqual(layer.handleCorner(at: CGPoint(x: 600 - radius, y: 400)), .bottomRight)
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
            PagePicture(
                id: "over", frame: CGRect(x: 0, y: 0, width: 50, height: 50), jpeg: Data(),
                aboveInk: true),
            PagePicture(id: "under", frame: CGRect(x: 100, y: 0, width: 50, height: 50), jpeg: Data()),
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
        XCTAssertEqual(committed?.first?.aboveInk, true)
        layer.toggleSelectedInkSide()
        XCTAssertEqual(committed?.first?.aboveInk, false)
        XCTAssertEqual(layer.selectedID, "a", "the picture stays selected")
    }

    /// The side of the ink is not a main button — it read as unintuitive on the
    /// device. It is one entry in the selected picture's … menu, as GoodNotes
    /// and Notability keep their Bring to Front / Send to Back.
    func testTheMoreMenuOffersTheOtherSideOfTheInk() throws {
        let layer = layer(arranging: true)
        layer.overInkLabel = "Přes poznámky"
        layer.underInkLabel = "Pod poznámky"
        layer.selectedID = "a"
        layer.layoutIfNeeded()

        XCTAssertTrue(layer.moreButton.showsMenuAsPrimaryAction)
        let titles = { layer.moreButton.menu?.children.compactMap { ($0 as? UIAction)?.title } }
        XCTAssertEqual(titles(), ["Přes poznámky"], "under the ink, it offers to cover")

        layer.toggleSelectedInkSide()
        layer.layoutIfNeeded()
        XCTAssertEqual(titles(), ["Pod poznámky"])
    }

    func testLeavingArrangingDropsTheSelection() {
        let layer = layer(arranging: true)
        layer.selectedID = "a"
        layer.arranging = false
        XCTAssertNil(layer.selectedID)
    }
}
