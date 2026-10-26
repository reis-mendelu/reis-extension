import PDFKit
import PencilKit
import XCTest

@testable import PdfInkPlugin

/**
 * The exported ink is as sharp as the page it is baked into.
 *
 * The export redraws the page's text as text, but the ink can only be an
 * image, and it was baked at 2 pixels per page point. An iPad shows an A4 at
 * 2.72 px/pt just fitting it in portrait, so the shared file's notes were as
 * soft as the reader's used to be (fixed in the same PR). 4 px/pt is ~288 dpi:
 * sharp on a screen at a moderate zoom, and close to print resolution.
 */
final class InkExportResolutionTests: XCTestCase {
    func testInkIsBakedAtFourPixelsPerPoint() throws {
        let size = CGSize(width: 200, height: 200)
        let url = try export(page: size)

        let widths = try inkImageWidths(url)
        XCTAssertEqual(widths, [800], "ink baked \(widths) px wide for a 200 pt page")
    }

    /// A page too big for 4x within the reader's pixel budget gets less, but
    /// never less than the 2x every export used before.
    func testABigPageStaysWithinTheBudgetButNeverBelowTwo() {
        XCTAssertEqual(InkExport.inkScale(for: CGSize(width: 595, height: 842)), 4)
        let a2 = InkExport.inkScale(for: CGSize(width: 1191, height: 1684))
        XCTAssertLessThan(a2, 4)
        XCTAssertLessThanOrEqual(1191 * 1684 * a2 * a2, InkPages.maxInkPixels + 1)
        XCTAssertEqual(InkExport.inkScale(for: CGSize(width: 2384, height: 3370)), 2)
    }

    // MARK: - Helpers

    private func export(page size: CGSize) throws -> URL {
        let data = UIGraphicsPDFRenderer(bounds: CGRect(origin: .zero, size: size)).pdfData {
            $0.beginPage()
        }
        let document = try XCTUnwrap(PDFDocument(data: data))
        let points = stride(from: 40.0, through: 160.0, by: 4).map { x in
            PKStrokePoint(
                location: CGPoint(x: x, y: 100), timeOffset: 0, size: CGSize(width: 8, height: 8),
                opacity: 1, force: 1, azimuth: 0, altitude: .pi / 2)
        }
        let drawing = PKDrawing(strokes: [
            PKStroke(ink: PKInk(.pen, color: .black), path: PKStrokePath(controlPoints: points, creationDate: Date()))
        ])
        let url = FileManager.default.temporaryDirectory.appendingPathComponent("\(UUID().uuidString).pdf")
        try InkExport.flatten(document, drawings: [0: drawing], to: url)
        return url
    }

    /// Pixel widths of the images on the first page: the baked ink is the only one.
    private func inkImageWidths(_ url: URL) throws -> [Int] {
        let page = try XCTUnwrap(CGPDFDocument(url as CFURL)?.page(at: 1))
        var resources: CGPDFDictionaryRef?
        var xobjects: CGPDFDictionaryRef?
        guard let pageDictionary = page.dictionary,
            CGPDFDictionaryGetDictionary(pageDictionary, "Resources", &resources), let resources,
            CGPDFDictionaryGetDictionary(resources, "XObject", &xobjects), let xobjects
        else { return [] }
        var widths: [Int] = []
        withUnsafeMutablePointer(to: &widths) { box in
            CGPDFDictionaryApplyFunction(xobjects, { _, object, info in
                var stream: CGPDFStreamRef?
                guard CGPDFObjectGetValue(object, .stream, &stream), let stream,
                    let dictionary = CGPDFStreamGetDictionary(stream)
                else { return }
                var subtype: UnsafePointer<CChar>?
                var width: CGPDFInteger = 0
                guard CGPDFDictionaryGetName(dictionary, "Subtype", &subtype), let subtype,
                    String(cString: subtype) == "Image",
                    CGPDFDictionaryGetInteger(dictionary, "Width", &width)
                else { return }
                info!.assumingMemoryBound(to: [Int].self).pointee.append(width)
            }, box)
        }
        return widths
    }
}
