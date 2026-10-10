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

    /// The tape is a pen in the palette, beside the marker — not a menu entry
    /// and not a mode with a bar of its own (Dominik, first device build).
    func testThePaletteCarriesTheTapeAfterTheMarker() throws {
        guard #available(iOS 18.0, *) else { throw XCTSkip("custom palette items are iOS 18+") }
        let (reader, _) = try host.show(pages: 1)

        let ids = reader.toolPicker.toolItems.map(\.identifier)
        let marker = try XCTUnwrap(ids.firstIndex(of: "com.apple.ink.marker"))

        XCTAssertEqual(ids[marker + 1], CoverTool.identifier)
    }

    /// "It's not clear what it's for" — Dominik, 2026-10-09. The palette names
    /// the tape and nothing more, so picking it in a file with no tape yet says
    /// what it does; the first strip, or putting the tape down, takes it away.
    func testPickingTheTapeInAFileWithNoTapeSaysWhatItIsFor() throws {
        guard #available(iOS 18.0, *) else { throw XCTSkip("custom palette items are iOS 18+") }
        let (reader, _) = try host.show(pages: 1)
        // The palette's selection outlives a reader: start from the pen.
        reader.toolPicker.selectedToolItemIdentifier = "com.apple.ink.pen"
        reader.coverToolDidChange()
        XCTAssertTrue(reader.tapeHint.isHidden)

        reader.toolPicker.selectedToolItemIdentifier = CoverTool.identifier
        reader.coverToolDidChange()
        XCTAssertFalse(reader.tapeHint.isHidden, "picking the tape explained nothing")
        XCTAssertEqual(reader.tapeHint.text, reader.strings.tapeHint)

        reader.addCover(block, onPage: 0)
        XCTAssertTrue(reader.tapeHint.isHidden, "the hint outlived the first strip")

        reader.toolPicker.selectedToolItemIdentifier = "com.apple.ink.pen"
        reader.coverToolDidChange()
        reader.toolPicker.selectedToolItemIdentifier = CoverTool.identifier
        reader.coverToolDidChange()
        XCTAssertTrue(reader.tapeHint.isHidden, "a file with tape already knows what it is")
        putTheTapeDown(reader)
    }

    /// The tape stays in hand across a file switch, so the hint follows the
    /// file: back for one with no tape, gone for one that has some.
    func testTheHintFollowsAFileSwitchWithTheTapeInHand() throws {
        guard #available(iOS 18.0, *) else { throw XCTSkip("custom palette items are iOS 18+") }
        let (reader, taped) = try host.show(pages: 1)
        reader.toolPicker.selectedToolItemIdentifier = CoverTool.identifier
        reader.coverToolDidChange()
        reader.addCover(block, onPage: 0)
        XCTAssertTrue(reader.tapeHint.isHidden)

        try host.open(reader, pages: 1, ink: ReaderTestHost.tempInk())
        XCTAssertFalse(reader.tapeHint.isHidden, "a fresh file with the tape in hand explained nothing")

        try host.open(reader, pages: 1, ink: taped)
        XCTAssertTrue(reader.tapeHint.isHidden, "the hint stayed over a file that has tape")
        putTheTapeDown(reader)
    }

    /// The palette's selection outlives the reader: a test that ends with the
    /// tape in hand hands it to the next reader (ReaderPictureTests then could
    /// not pick a picture up).
    @available(iOS 18.0, *)
    private func putTheTapeDown(_ reader: PdfInkViewController) {
        reader.toolPicker.selectedToolItemIdentifier = "com.apple.ink.pen"
        reader.coverToolDidChange()
    }

    /// Focus mode puts the way back in the top trailing corner, at the same
    /// top edge the hint sits on. On a narrow reader (Split View, Slide Over)
    /// the hint spans nearly the width and sat over that button, the only way
    /// back to the bar (cubic, 5.4.0 release diff). With the bar showing the
    /// button is hidden and the hint keeps its place.
    func testTheHintNeverCoversTheWayBackOnANarrowReader() throws {
        for width: CGFloat in [320, 375, 507] {
            let (reader, _) = try host.show(pages: 1, width: width)
            reader.makingCovers = true
            reader.updateTapeHint()
            reader.view.layoutIfNeeded()
            XCTAssertFalse(reader.tapeHint.isHidden)
            XCTAssertEqual(
                reader.tapeHint.frame.minY - reader.view.safeAreaLayoutGuide.layoutFrame.minY, 12,
                accuracy: 1, "the hint moved with the bar showing")

            reader.setChromeHidden(true)
            reader.view.layoutIfNeeded()

            XCTAssertFalse(reader.restoreChromeButton.isHidden)
            XCTAssertFalse(
                reader.tapeHint.frame.intersects(reader.restoreChromeButton.frame),
                "at \(width) pt the hint \(reader.tapeHint.frame) covers the way back \(reader.restoreChromeButton.frame)")

            reader.setChromeHidden(false)
            reader.view.layoutIfNeeded()
            XCTAssertEqual(
                reader.tapeHint.frame.minY - reader.view.safeAreaLayoutGuide.layoutFrame.minY, 12,
                accuracy: 1, "the hint stayed down after the bar came back")
            reader.makingCovers = false
            reader.updateTapeHint()
        }
    }

    func testPuttingTheTapeDownTakesTheHintAway() throws {
        guard #available(iOS 18.0, *) else { throw XCTSkip("custom palette items are iOS 18+") }
        let (reader, _) = try host.show(pages: 1)

        reader.toolPicker.selectedToolItemIdentifier = CoverTool.identifier
        reader.coverToolDidChange()
        reader.toolPicker.selectedToolItemIdentifier = "com.apple.ink.pen"
        reader.coverToolDidChange()

        XCTAssertTrue(reader.tapeHint.isHidden)
    }

    func testPickingTheTapeMakesCoversAndKeepsThePensAndTheBar() throws {
        guard #available(iOS 18.0, *) else { throw XCTSkip("custom palette items are iOS 18+") }
        let (reader, _) = try host.show(pages: 1)
        let overlay = try XCTUnwrap(reader.overlays[0])

        reader.toolPicker.selectedToolItemIdentifier = CoverTool.identifier
        reader.coverToolDidChange()

        XCTAssertTrue(reader.makingCovers)
        XCTAssertTrue(overlay.coverLayer.isMakingCovers)
        XCTAssertTrue(overlay.coverLayer.dragRecognizer.isEnabled)
        XCTAssertEqual(reader.navigationItem.rightBarButtonItems, reader.fileToolItems)

        reader.toolPicker.selectedToolItemIdentifier = "com.apple.ink.pen"
        reader.coverToolDidChange()
        XCTAssertFalse(reader.makingCovers)
        XCTAssertFalse(overlay.coverLayer.dragRecognizer.isEnabled)
    }

    /// The trap the first suite run found: a canvas made while the tape is in
    /// hand was handed `selectedTool`, which PencilKit cannot put on a canvas
    /// ("Unknown PKTool type"). PencilKit also keeps the selection between
    /// readers, so it hit the next file opened, not only a page scrolled in.
    func testAReaderOpenedWithTheTapeInHandMakesCoversAndDoesNotCrash() throws {
        guard #available(iOS 18.0, *) else { throw XCTSkip("custom palette items are iOS 18+") }
        let (first, _) = try host.show(pages: 1)
        first.toolPicker.selectedToolItemIdentifier = CoverTool.identifier
        first.coverToolDidChange()

        try host.open(first, pages: 3, ink: ReaderTestHost.tempInk())  // new canvases
        let overlay = try XCTUnwrap(first.overlays[0])

        XCTAssertTrue(first.makingCovers)
        XCTAssertFalse(overlay.canvas.isDrawingEnabled, "the tape must not also draw ink")
        XCTAssertNil(CoverTool.canvasTool(of: first.toolPicker))
        first.toolPicker.selectedToolItemIdentifier = "com.apple.ink.pen"
        XCTAssertTrue(CoverTool.canvasTool(of: first.toolPicker) is PKInkingTool)
    }

    /// Arranging moves pictures with the finger: the tape keeps out of its way.
    func testArrangingPicturesPutsTheTapeAside() throws {
        guard #available(iOS 18.0, *) else { throw XCTSkip("custom palette items are iOS 18+") }
        let (reader, _) = try host.show(pages: 1)
        let overlay = try XCTUnwrap(reader.overlays[0])
        reader.toolPicker.selectedToolItemIdentifier = CoverTool.identifier
        reader.coverToolDidChange()

        reader.beginArrangingPictures()
        XCTAssertFalse(overlay.coverLayer.isMakingCovers)
        XCTAssertFalse(overlay.coverLayer.isUserInteractionEnabled)

        reader.endArrangingPictures()
        XCTAssertTrue(overlay.coverLayer.isMakingCovers)
        XCTAssertTrue(overlay.coverLayer.isUserInteractionEnabled)
    }

    func testAMovedStripIsKeptAndUndoPutsItBack() throws {
        let (reader, ink) = try host.show(pages: 1)
        let undo = try XCTUnwrap(reader.undoManagerForPictures)
        reader.addCover(block, onPage: 0)
        RunLoop.current.run(until: Date().addingTimeInterval(0.05))
        let id = try XCTUnwrap(reader.covers[0]?.first?.id)
        let moved = block.offsetBy(dx: 40, dy: 100)

        reader.moveCover(id, to: moved, onPage: 0)
        RunLoop.current.run(until: Date().addingTimeInterval(0.05))

        XCTAssertEqual(reader.covers[0]?.first?.rect, moved)
        XCTAssertEqual(InkStore.load(from: ink)?.coverCards[0]?.first?.rect, moved)
        XCTAssertEqual(reader.covers[0]?.first?.id, id, "a move keeps the strip, it does not make a new one")
        undo.undo()
        XCTAssertEqual(reader.covers[0]?.first?.rect, block)
        undo.removeAllActions()
    }

    /// One undo stack: the palette's undo takes back a cover put down or
    /// taken away by mistake.
    func testUndoTakesBackACover() throws {
        let (reader, _) = try host.show(pages: 1)
        let undo = try XCTUnwrap(reader.undoManagerForPictures)

        reader.addCover(block, onPage: 0)
        RunLoop.current.run(until: Date().addingTimeInterval(0.05))
        undo.undo()
        XCTAssertNil(reader.covers[0])
        undo.redo()
        XCTAssertEqual(reader.covers[0]?.map(\.rect), [block])
        undo.removeAllActions()
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
