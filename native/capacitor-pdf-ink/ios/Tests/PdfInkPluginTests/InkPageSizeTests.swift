import PDFKit
import PencilKit
import XCTest

@testable import PdfInkPlugin

/**
 * How big a page the student ADDS comes out.
 *
 * "The size of the page it follows" is the rule, and the only honest reading of
 * it is the size that page is SHOWN at — the reader lays its canvases out in the
 * crop box (PDFView's default `displayBox`, never overridden), the export bakes
 * the crop box, and the page grid thumbnails the crop box. A blank sized from
 * the MEDIA box is a different page from the one it is supposed to match, on
 * every scan whose crop is inset, and a blank sized without regard to rotation
 * is portrait next to a landscape neighbour.
 *
 * Two paths, and both have to agree: `addBlankPage` while the file is open, and
 * `InkPages.apply` when it is reopened and the added pages are put back.
 */
@available(iOS 16.0, *)
final class InkPageSizeTests: XCTestCase {

    // MARK: - Reopening the file (InkPages.apply)

    func testAReappliedBlankMatchesAnInsetCropBoxNeighbour() throws {
        let document = try page(size: CGSize(width: 400, height: 600))
        try XCTUnwrap(document.page(at: 0))
            .setBounds(CGRect(x: 40, y: 60, width: 320, height: 480), for: .cropBox)

        InkPages.apply(inserts: [1], to: document)

        let added = try XCTUnwrap(document.page(at: 1)).bounds(for: .cropBox).size
        XCTAssertEqual(added.width, 320, accuracy: 1, "blank took the media width, not the crop")
        XCTAssertEqual(added.height, 480, accuracy: 1, "blank took the media height, not the crop")
    }

    func testAReappliedBlankMatchesARotatedNeighbourAsShown() throws {
        let document = try page(size: CGSize(width: 400, height: 600))
        try XCTUnwrap(document.page(at: 0)).rotation = 90

        InkPages.apply(inserts: [1], to: document)

        let added = try XCTUnwrap(document.page(at: 1)).bounds(for: .cropBox).size
        XCTAssertEqual(added.width, 600, accuracy: 1, "a landscape neighbour got a portrait blank")
        XCTAssertEqual(added.height, 400, accuracy: 1)
    }

    /// The property both of the above are instances of.
    func testAReappliedBlankIsTheNeighboursDisplayedSize() throws {
        let document = try page(size: CGSize(width: 400, height: 600))
        let first = try XCTUnwrap(document.page(at: 0))
        first.setBounds(CGRect(x: 20, y: 20, width: 360, height: 560), for: .cropBox)
        first.rotation = 270

        InkPages.apply(inserts: [1], to: document)

        let added = try XCTUnwrap(document.page(at: 1)).bounds(for: .cropBox).size
        XCTAssertEqual(added, InkExport.pageRect(first).size)
    }

    // MARK: - While the file is open (addBlankPage)

    func testAnAddedBlankMatchesAnInsetCropBoxNeighbour() throws {
        let reader = try show()
        let document = try page(size: CGSize(width: 400, height: 600))
        try XCTUnwrap(document.page(at: 0))
            .setBounds(CGRect(x: 40, y: 60, width: 320, height: 480), for: .cropBox)
        try open(reader, document)

        XCTAssertTrue(reader.addBlankPage())

        let added = try XCTUnwrap(document.page(at: 1)).bounds(for: .cropBox).size
        XCTAssertEqual(added.width, 320, accuracy: 1, "blank took the media width, not the crop")
        XCTAssertEqual(added.height, 480, accuracy: 1, "blank took the media height, not the crop")
    }

    func testAnAddedBlankMatchesARotatedNeighbourAsShown() throws {
        let reader = try show()
        let document = try page(size: CGSize(width: 400, height: 600))
        try XCTUnwrap(document.page(at: 0)).rotation = 90
        try open(reader, document)

        XCTAssertTrue(reader.addBlankPage())

        let added = try XCTUnwrap(document.page(at: 1)).bounds(for: .cropBox).size
        XCTAssertEqual(added.width, 600, accuracy: 1, "a landscape neighbour got a portrait blank")
        XCTAssertEqual(added.height, 400, accuracy: 1)
    }

    /// An ordinary PDF must be completely unaffected by the change.
    func testAnAddedBlankStillMatchesAPlainNeighbour() throws {
        let reader = try show()
        let document = try page(size: CGSize(width: 400, height: 600))
        try open(reader, document)

        XCTAssertTrue(reader.addBlankPage())

        let added = try XCTUnwrap(document.page(at: 1)).bounds(for: .cropBox).size
        XCTAssertEqual(added.width, 400, accuracy: 1)
        XCTAssertEqual(added.height, 600, accuracy: 1)
    }

    // MARK: - Helpers

    private var windows: [UIWindow] = []

    private func page(size: CGSize) throws -> PDFDocument {
        let data = UIGraphicsPDFRenderer(bounds: CGRect(origin: .zero, size: size)).pdfData { ctx in
            ctx.beginPage()
            UIColor.white.setFill()
            ctx.cgContext.fill(CGRect(origin: .zero, size: size))
        }
        return try XCTUnwrap(PDFDocument(data: data))
    }

    private func show() throws -> PdfInkViewController {
        let reader = PdfInkViewController(strings: PdfInkStrings(nil))
        let window = UIWindow(frame: CGRect(x: 0, y: 0, width: 820, height: 1000))
        let host = UIViewController()
        window.rootViewController = host
        host.addChild(reader)
        host.view.addSubview(reader.view)
        reader.view.frame = host.view.bounds
        reader.didMove(toParent: host)
        window.isHidden = false
        window.layoutIfNeeded()
        windows.append(window)
        return reader
    }

    private func open(_ reader: PdfInkViewController, _ document: PDFDocument) throws {
        let ink = FileManager.default.temporaryDirectory
            .appendingPathComponent("\(UUID().uuidString).ink")
        XCTAssertTrue(reader.load(document: document, inkURL: ink, title: "test"))
        reader.view.layoutIfNeeded()
    }

    override func tearDown() {
        for window in windows { window.isHidden = true }
        windows = []
        super.tearDown()
    }
}
