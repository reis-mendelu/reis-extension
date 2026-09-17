import PDFKit
import PencilKit
import XCTest

@testable import PdfInkPlugin

/**
 * Exporting a document that has been EDITED, not merely inked.
 *
 * `InkExportTests` covers one square page of uniform size. The reader also lets
 * a student INSERT blank pages and REMOVE pages, and IS serves plenty of
 * scanned PDFs that are rotated or whose crop box is inset from the media box.
 * None of those shapes was exercised anywhere, so none of them was known to
 * work. They all do — this file is here to keep it that way.
 */
final class InkExportEditedTests: XCTestCase {

    // MARK: - Inserted blank pages

    func testAnInsertedBlankPageSurvivesTheExport() throws {
        let document = try whitePage(size: CGSize(width: 200, height: 200), pages: 2)
        document.insert(InkPages.blank(size: CGSize(width: 200, height: 200)), at: 1)
        let url = tempURL()

        try InkExport.flatten(document, drawings: [:], to: url)

        let out = try XCTUnwrap(PDFDocument(url: url))
        XCTAssertEqual(out.pageCount, 3, "the inserted page did not reach the export")
    }

    func testInkOnAnInsertedBlankPageLandsWhereItWasDrawn() throws {
        let document = try whitePage(size: CGSize(width: 200, height: 200), pages: 1)
        document.insert(InkPages.blank(size: CGSize(width: 200, height: 200)), at: 1)
        let url = tempURL()

        try InkExport.flatten(document, drawings: [1: horizontalStroke(y: 100, from: 40, to: 160)], to: url)

        let out = try XCTUnwrap(PDFDocument(url: url))
        let pixels = try render(out.page(at: 1), size: CGSize(width: 200, height: 200))
        XCTAssertLessThan(pixels(CGPoint(x: 100, y: 100)), 128, "no ink on the inserted page")
        XCTAssertGreaterThan(pixels(CGPoint(x: 10, y: 10)), 200, "ink bled into an untouched corner")
    }

    // MARK: - Mixed page sizes

    /// The renderer is constructed from page 0's rect. Every page then calls
    /// `beginPage(withBounds:)` with its own. This asks whether that holds.
    func testAPageOfADifferentSizeKeepsItsOwnSize() throws {
        let document = try whitePage(size: CGSize(width: 200, height: 200), pages: 1)
        let tall = try whitePage(size: CGSize(width: 300, height: 500), pages: 1)
        document.insert(try XCTUnwrap(tall.page(at: 0)), at: 1)
        let url = tempURL()

        try InkExport.flatten(document, drawings: [:], to: url)

        let out = try XCTUnwrap(PDFDocument(url: url))
        XCTAssertEqual(out.pageCount, 2)
        let second = try XCTUnwrap(out.page(at: 1)).bounds(for: .mediaBox)
        XCTAssertEqual(second.width, 300, accuracy: 1, "second page took page 0's width")
        XCTAssertEqual(second.height, 500, accuracy: 1, "second page took page 0's height")
    }

    func testAnInsertedPageTallerThanTheFirstKeepsItsSize() throws {
        // What `InkPages.apply` actually builds: the blank is sized from its
        // NEIGHBOUR, so in a mixed document it need not match page 0.
        let document = try whitePage(size: CGSize(width: 200, height: 200), pages: 1)
        document.insert(InkPages.blank(size: CGSize(width: 400, height: 900)), at: 1)
        let url = tempURL()

        try InkExport.flatten(document, drawings: [:], to: url)

        let out = try XCTUnwrap(PDFDocument(url: url))
        let second = try XCTUnwrap(out.page(at: 1)).bounds(for: .mediaBox)
        XCTAssertEqual(second.width, 400, accuracy: 1)
        XCTAssertEqual(second.height, 900, accuracy: 1)
    }

    // MARK: - Rotation

    func testARotatedPageKeepsItsUprightSize() throws {
        let document = try whitePage(size: CGSize(width: 300, height: 500), pages: 1)
        try XCTUnwrap(document.page(at: 0)).rotation = 90
        let url = tempURL()

        try InkExport.flatten(document, drawings: [:], to: url)

        let out = try XCTUnwrap(PDFDocument(url: url))
        let bounds = try XCTUnwrap(out.page(at: 0)).bounds(for: .mediaBox)
        XCTAssertEqual(bounds.width, 500, accuracy: 1, "a quarter-turned page should export landscape")
        XCTAssertEqual(bounds.height, 300, accuracy: 1)
    }

    func testInkOnARotatedPageLandsWhereItWasDrawn() throws {
        let document = try whitePage(size: CGSize(width: 300, height: 500), pages: 1)
        try XCTUnwrap(document.page(at: 0)).rotation = 90
        let url = tempURL()

        // The canvas over a turned page is 500x300, so the student's stroke is
        // in that space.
        try InkExport.flatten(document, drawings: [0: horizontalStroke(y: 150, from: 200, to: 300)], to: url)

        let out = try XCTUnwrap(PDFDocument(url: url))
        let pixels = try render(out.page(at: 0), size: CGSize(width: 500, height: 300))
        XCTAssertLessThan(pixels(CGPoint(x: 250, y: 150)), 128, "no ink where the stroke was drawn")
    }

    // MARK: - Crop box inset from the media box

    /// IS serves scans whose crop box is inset. The reader lays canvases out in
    /// the CROP box, so the ink is in crop-box space; the export must agree.
    func testAnInsetCropBoxExportsTheCroppedPageAndPutsInkOnIt() throws {
        let document = try whitePage(size: CGSize(width: 400, height: 400), pages: 1)
        let page = try XCTUnwrap(document.page(at: 0))
        page.setBounds(CGRect(x: 50, y: 50, width: 300, height: 300), for: .cropBox)
        let url = tempURL()

        try InkExport.flatten(document, drawings: [0: horizontalStroke(y: 150, from: 100, to: 200)], to: url)

        let out = try XCTUnwrap(PDFDocument(url: url))
        let bounds = try XCTUnwrap(out.page(at: 0)).bounds(for: .mediaBox)
        XCTAssertEqual(bounds.width, 300, accuracy: 1, "export should be the cropped size")
        XCTAssertEqual(bounds.height, 300, accuracy: 1)
        let pixels = try render(out.page(at: 0), size: CGSize(width: 300, height: 300))
        XCTAssertLessThan(pixels(CGPoint(x: 150, y: 150)), 128, "no ink where the stroke was drawn")
    }

    // MARK: - Helpers (copied from InkExportTests; diagnostics stand alone)

    private func tempURL() -> URL {
        FileManager.default.temporaryDirectory.appendingPathComponent("\(UUID().uuidString).pdf")
    }

    private func whitePage(size: CGSize, pages: Int = 1) throws -> PDFDocument {
        let data = UIGraphicsPDFRenderer(bounds: CGRect(origin: .zero, size: size)).pdfData { ctx in
            for _ in 0..<pages {
                ctx.beginPage()
                UIColor.white.setFill()
                ctx.cgContext.fill(CGRect(origin: .zero, size: size))
            }
        }
        return try XCTUnwrap(PDFDocument(data: data))
    }

    private func horizontalStroke(y: CGFloat, from: CGFloat, to: CGFloat) -> PKDrawing {
        let points = stride(from: from, through: to, by: 4).map { x in
            PKStrokePoint(
                location: CGPoint(x: x, y: y), timeOffset: 0, size: CGSize(width: 8, height: 8),
                opacity: 1, force: 1, azimuth: 0, altitude: .pi / 2)
        }
        let path = PKStrokePath(controlPoints: points, creationDate: Date())
        return PKDrawing(strokes: [PKStroke(ink: PKInk(.pen, color: .black), path: path)])
    }

    private func render(_ page: PDFPage?, size: CGSize) throws -> (CGPoint) -> Int {
        let image = try XCTUnwrap(page).thumbnail(of: size, for: .mediaBox)
        let width = Int(size.width), height = Int(size.height)
        var buffer = [UInt8](repeating: 0, count: width * height * 4)
        let context = try XCTUnwrap(
            CGContext(
                data: &buffer, width: width, height: height, bitsPerComponent: 8,
                bytesPerRow: width * 4, space: CGColorSpaceCreateDeviceRGB(),
                bitmapInfo: CGImageAlphaInfo.premultipliedLast.rawValue))
        context.setFillColor(UIColor.white.cgColor)
        context.fill(CGRect(origin: .zero, size: size))
        context.draw(try XCTUnwrap(image.cgImage), in: CGRect(origin: .zero, size: size))
        return { point in
            let x = Int(point.x), y = height - 1 - Int(point.y)
            let offset = (y * width + x) * 4
            return (Int(buffer[offset]) + Int(buffer[offset + 1]) + Int(buffer[offset + 2])) / 3
        }
    }
}
