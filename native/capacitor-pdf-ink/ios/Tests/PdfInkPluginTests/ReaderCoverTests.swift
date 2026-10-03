import PDFKit
import PencilKit
import XCTest

@testable import PdfInkPlugin

/// Covers in the reader: kept like ink, shut on every open, moved with their
/// page, made in a mode of their own, and on top of pictures.
@available(iOS 16.0, *)
final class ReaderCoverTests: XCTestCase {
    private let host = ReaderTestHost()
    private let block = CGRect(x: 10, y: 10, width: 60, height: 30)

    override func tearDown() {
        host.closeAll()
        super.tearDown()
    }

    func testACoverComesBackAndComesBackShut() throws {
        let (reader, ink) = try host.show(pages: 1)
        reader.addCover(block, onPage: 0)
        let id = try XCTUnwrap(reader.covers[0]?.first?.id)
        reader.toggleCover(id, onPage: 0)
        XCTAssertEqual(reader.revealedCovers, [id], "tapping it did not open it")

        try host.open(reader, pages: 1, ink: ReaderTestHost.tempInk())  // leaving saves
        try host.open(reader, pages: 1, ink: ink)

        XCTAssertEqual(reader.covers[0]?.map(\.rect), [block], "the cover was not kept")
        XCTAssertTrue(reader.revealedCovers.isEmpty, "it came back already open")
    }

    func testAFileWithOnlyCoversKeepsItsArchive() throws {
        let (reader, ink) = try host.show(pages: 1)
        reader.addCover(block, onPage: 0)
        XCTAssertTrue(reader.persistNow())
        XCTAssertEqual(InkStore.load(from: ink)?.coverCards[0]?.count, 1)
    }

    func testCoversMoveWithAnAddedPage() throws {
        let (reader, _) = try host.show(pages: 2)
        reader.addCover(block, onPage: 1)
        reader.pdfView.go(to: try XCTUnwrap(reader.document?.page(at: 0)))

        XCTAssertTrue(reader.addBlankPage())  // inserted at 1, after page 0

        XCTAssertNil(reader.covers[1])
        XCTAssertEqual(reader.covers[2]?.map(\.rect), [block])
    }

    func testMakingCoversTakesThePensAndTheBarUntilDone() throws {
        let (reader, _) = try host.show(pages: 1)

        reader.beginCovering()
        reader.restoreToolPicker()  // #485's re-assert must leave the mode alone

        XCTAssertTrue(reader.makingCovers)
        XCTAssertEqual(reader.navigationItem.rightBarButtonItems, [reader.doneCoveringItem])

        reader.endCovering()
        XCTAssertFalse(reader.makingCovers)
        XCTAssertEqual(reader.navigationItem.rightBarButtonItems, reader.fileToolItems)
    }

    func testCoveringAndArrangingPicturesAreExclusive() throws {
        let (reader, _) = try host.show(pages: 1)

        reader.beginArrangingPictures()
        reader.beginCovering()
        XCTAssertFalse(reader.arrangingPictures)
        XCTAssertTrue(reader.makingCovers)

        reader.beginArrangingPictures()
        XCTAssertFalse(reader.makingCovers)
        XCTAssertTrue(reader.arrangingPictures)
    }

    /// The cover is on top. A finger tap on it opens the cover and does not
    /// also pick the picture underneath up: the pick-up recognizer sits on the
    /// overlay and would otherwise fire for the same tap.
    func testATapOnACoverOverAPictureIsTheCoversNotThePictures() throws {
        let (reader, _) = try host.show(pages: 1)
        reader.fingerDraws = { false }
        XCTAssertTrue(reader.insertPicture(try ReaderTestHost.picture()))
        reader.endArrangingPictures()
        let frame = try XCTUnwrap(reader.pictures[0]?.first?.frame)
        let middle = CGPoint(x: frame.midX, y: frame.midY)
        reader.addCover(frame.insetBy(dx: -4, dy: -4), onPage: 0)

        XCTAssertFalse(reader.pickUpPicture(at: middle, onPage: 0))
        XCTAssertFalse(reader.arrangingPictures)
    }

    /// The same routing question as CoverTouchRoutingTests, asked of the
    /// overlay a real reader hands PDFKit (restored from ed7016e4).
    func testTheOverlayPdfkitIsGivenRoutesACreatedCoverToTheCoverLayer() throws {
        let (reader, _) = try host.show(pages: 1)
        let page = try XCTUnwrap(reader.document?.page(at: 0))
        let overlay = try XCTUnwrap(
            reader.pdfView(PDFView(), overlayViewFor: page) as? PageOverlayView)
        overlay.frame = CGRect(x: 0, y: 0, width: 400, height: 500)
        overlay.layoutIfNeeded()

        overlay.coverLayer.onCreate?(CGRect(x: 50, y: 50, width: 120, height: 60))

        XCTAssertTrue(
            overlay.hitTest(CGPoint(x: 80, y: 70), with: nil) === overlay.coverLayer,
            "the created cover is not tappable")
    }
}
