import PDFKit
import PencilKit
import XCTest

@testable import PdfInkPlugin

/**
 * Pictures in the reader: kept like ink, arranged in a mode of their own, and
 * undone on the same stack as strokes.
 */
@available(iOS 16.0, *)
final class ReaderPictureTests: XCTestCase {
    private var windows: [UIWindow] = []
    private var readers: [PdfInkViewController] = []
    private let strings = PdfInkStrings(nil)

    func testAPictureSurvivesClosingAndReopeningTheFile() throws {
        let (reader, ink) = try show(pages: 2)
        XCTAssertTrue(reader.insertPicture(try picture()))
        let placed = reader.pictures[0]

        try open(reader, pages: 1, ink: tempInk())  // leaving the file saves it
        XCTAssertEqual(reader.pictures[0], nil)
        try open(reader, pages: 2, ink: ink)

        XCTAssertEqual(reader.pictures[0], placed)
    }

    /// `persistNow` deletes an archive with nothing in it; pictures are something.
    func testAFileWithOnlyAPictureKeepsItsArchive() throws {
        let (reader, ink) = try show(pages: 1)
        XCTAssertTrue(reader.insertPicture(try picture()))
        XCTAssertTrue(reader.persistNow())
        XCTAssertTrue(FileManager.default.fileExists(atPath: ink.path))
    }

    func testANewPictureIsSelectedAndArrangingTakesThePensAway() throws {
        let (reader, _) = try show(pages: 1)
        reader.view.layoutIfNeeded()
        XCTAssertTrue(reader.insertPicture(try picture()))

        XCTAssertTrue(reader.arrangingPictures)
        XCTAssertEqual(reader.navigationItem.rightBarButtonItems, [reader.doneArrangingItem])
        XCTAssertEqual(reader.canvas(onPage: 0)?.isUserInteractionEnabled, false)
    }

    /// #485's re-assert brings the pens back whenever they go — except here,
    /// where taking them away is the point.
    func testTheToolPickerReassertLeavesArrangingAlone() throws {
        let (reader, _) = try show(pages: 1)
        reader.beginArrangingPictures()
        reader.restoreToolPicker()
        XCTAssertTrue(reader.arrangingPictures)
        XCTAssertEqual(reader.navigationItem.rightBarButtonItems, [reader.doneArrangingItem])
    }

    /// `setVisible(false)` alone left the pens over the photo picker on the
    /// simulator: the picker runs out of process and takes no responder, so
    /// nothing made PencilKit re-read it. Arranging and picking let the
    /// responder go; Done (or a dismissal) takes it back.
    func testArrangingLetsTheResponderGoAndDoneTakesItBack() throws {
        let (reader, _) = try show(pages: 1)
        reader.showToolPicker()
        XCTAssertTrue(reader.pdfView.isFirstResponder)

        reader.beginArrangingPictures()
        XCTAssertFalse(reader.pdfView.isFirstResponder, "the pens would stay over the page")

        reader.endArrangingPictures()
        XCTAssertTrue(reader.pdfView.isFirstResponder)
    }

    /// The menu closes before UIKit presents the photo picker, and in that gap
    /// nothing is presented — #485's re-assert brought the pens straight back
    /// over the picker (seen on the simulator, probed: page first responder,
    /// pens visible, PHPicker on screen). Picking holds them off until it ends.
    func testThePensStayAwayWhilePickingAndComeBackAfter() throws {
        let (reader, _) = try show(pages: 1)
        reader.showToolPicker()

        reader.beginPicking()
        reader.restoreToolPicker()  // the gap: no presented controller yet
        XCTAssertFalse(reader.pdfView.isFirstResponder, "the pens came back over the picker")

        reader.showToolPicker()  // a cancel
        XCTAssertFalse(reader.pickingPicture)
        XCTAssertTrue(reader.pdfView.isFirstResponder)
    }

    /// "Move pictures" with nothing selected looked exactly like drawing but
    /// for the bar (seen on the simulator). It selects the top picture on the
    /// page on screen, so it is plain what will move.
    func testMovePicturesSelectsTheTopPictureOnThePageOnScreen() throws {
        let (reader, _) = try show(pages: 1)
        let jpeg = try picture().jpeg
        let under = PagePicture(id: "under", frame: CGRect(x: 0, y: 0, width: 50, height: 50), jpeg: jpeg)
        let over = PagePicture(id: "over", frame: CGRect(x: 10, y: 10, width: 50, height: 50), jpeg: jpeg)
        reader.setPictures([under, over], onPage: 0)

        reader.arrangePicturesOnPageOnScreen()

        XCTAssertTrue(reader.arrangingPictures)
        XCTAssertEqual(reader.selectedPicture?.page, 0)
        XCTAssertEqual(reader.selectedPicture?.id, "over")
    }

    func testDoneWearsTheThemeTint() throws {
        let tint = UIColor.systemGreen
        let reader = PdfInkViewController(strings: strings, tint: tint)
        XCTAssertEqual(reader.doneArrangingItem.tintColor, tint)
        XCTAssertEqual(reader.doneArrangingItem.style, .plain, "a filled pill puts white on lime")
    }

    func testDoneGivesThePensBack() throws {
        let (reader, _) = try show(pages: 1)
        reader.view.layoutIfNeeded()
        reader.beginArrangingPictures()
        reader.endArrangingPictures()

        XCTAssertFalse(reader.arrangingPictures)
        XCTAssertEqual(reader.navigationItem.rightBarButtonItems, reader.fileToolItems)
        XCTAssertEqual(reader.canvas(onPage: 0)?.isUserInteractionEnabled, true)
    }

    func testAnAddedPageMovesPicturesWithTheirPage() throws {
        let (reader, _) = try show(pages: 2)
        let placed = PagePicture(id: "p", frame: CGRect(x: 0, y: 0, width: 10, height: 10), jpeg: try picture().jpeg)
        reader.setPictures([placed], onPage: 1)

        XCTAssertTrue(reader.addBlankPage())  // after page 0, the one on screen

        XCTAssertNil(reader.pictures[1])
        XCTAssertEqual(reader.pictures[2], [placed])
    }

    /// One undo stack: the palette's undo takes back a deleted picture.
    func testUndoBringsADeletedPictureBack() throws {
        let (reader, _) = try show(pages: 1)
        let undo = try XCTUnwrap(reader.undoManagerForPictures)
        let placed = PagePicture(id: "p", frame: CGRect(x: 0, y: 0, width: 10, height: 10), jpeg: try picture().jpeg)

        // The undo manager groups by run-loop turn, as it does for a student:
        // one turn per action, so each is its own undo.
        reader.setPictures([placed], onPage: 0)
        turnRunLoop()
        reader.setPictures([], onPage: 0)
        turnRunLoop()

        undo.undo()
        XCTAssertEqual(reader.pictures[0], [placed])
        undo.redo()
        XCTAssertNil(reader.pictures[0])
        undo.removeAllActions()
    }

    private func turnRunLoop() {
        RunLoop.current.run(until: Date().addingTimeInterval(0.05))
    }

    func testTheMenuOffersMovingOnlyOnceThereIsAPicture() throws {
        let (reader, _) = try show(pages: 1)
        let titles = { reader.addMenuItems().compactMap { ($0 as? UIAction)?.title } }
        XCTAssertEqual(titles().first, strings.addPage)
        XCTAssertTrue(titles().contains(strings.photoLibrary))
        XCTAssertFalse(titles().contains(strings.movePictures))

        reader.setPictures(
            [PagePicture(id: "p", frame: CGRect(x: 0, y: 0, width: 10, height: 10), jpeg: Data())],
            onPage: 0)

        XCTAssertTrue(titles().contains(strings.movePictures))
    }

    // MARK: - Helpers

    private func picture() throws -> PictureIngest.Picture {
        let format = UIGraphicsImageRendererFormat()
        format.scale = 1
        let png = UIGraphicsImageRenderer(size: CGSize(width: 80, height: 60), format: format).pngData { ctx in
            UIColor.orange.setFill()
            ctx.fill(CGRect(x: 0, y: 0, width: 80, height: 60))
        }
        return try XCTUnwrap(PictureIngest.picture(from: png))
    }

    private func tempInk() -> URL {
        FileManager.default.temporaryDirectory.appendingPathComponent("\(UUID().uuidString).ink")
    }

    private func show(pages: Int) throws -> (PdfInkViewController, URL) {
        let reader = PdfInkViewController(strings: strings)
        let window = UIWindow(frame: CGRect(x: 0, y: 0, width: 820, height: 1000))
        window.rootViewController = UINavigationController(rootViewController: reader)
        window.makeKeyAndVisible()
        window.layoutIfNeeded()
        windows.append(window)
        readers.append(reader)
        let ink = tempInk()
        try open(reader, pages: pages, ink: ink)
        return (reader, ink)
    }

    private func open(_ reader: PdfInkViewController, pages: Int, ink: URL) throws {
        let size = CGSize(width: 400, height: 500)
        let data = UIGraphicsPDFRenderer(bounds: CGRect(origin: .zero, size: size)).pdfData { ctx in
            for _ in 0..<pages {
                ctx.beginPage()
                UIColor.white.setFill()
                ctx.cgContext.fill(CGRect(origin: .zero, size: size))
            }
        }
        XCTAssertTrue(reader.load(document: try XCTUnwrap(PDFDocument(data: data)), inkURL: ink, title: "t"))
        reader.view.layoutIfNeeded()
    }

    /// Closed the way the space closes them. A hostless test process keeps the
    /// reader alive past its test, and an open one takes the responder back
    /// (#485's re-assert) from whatever test runs next — that failed
    /// `ToolPickerResponderTests` on origin/test too, given any reader in a key
    /// window before it.
    override func tearDown() {
        for reader in readers { reader.willClose() }
        readers = []
        for window in windows { window.isHidden = true }
        windows = []
        super.tearDown()
    }
}
