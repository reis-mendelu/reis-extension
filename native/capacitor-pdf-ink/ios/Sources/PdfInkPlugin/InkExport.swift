import PDFKit
import PencilKit
import UIKit

/**
 * Baking the ink into a PDF the student can hand to anyone.
 *
 * Everywhere else reIS keeps the strokes beside the file, so the bytes stay the
 * ones IS served and a re-upload cannot orphan the ink. An export is the one
 * place that has to do the opposite: the recipient has no reIS, so the notes
 * must be in the page. The original copy is untouched — this writes a new file.
 *
 * The page content is redrawn through Core Graphics, so text stays text; only
 * the ink is an image, at `inkScale(for:)` so it does not look soft next to it.
 */
enum InkExport {
    /// The box PDFKit lays the reader's canvases out in, so the box the strokes
    /// are positioned against. It has to be the same one on both sides here —
    /// which is why it is `InkPages`' to define, not this file's: an added page
    /// is measured in it too.
    static let box = InkPages.displayBox

    /**
     * Pixels per page point the ink is baked at: 4, about 288 dpi — sharp on
     * an iPad at a moderate zoom (it shows an A4 at 2.72 px/pt just fitting it)
     * and close to print. It was 2, as soft as the reader used to be. A page
     * too big for 4 within `InkPages.maxInkPixels` gets less, but never less
     * than the 2 every export had before.
     */
    static func inkScale(for pageSize: CGSize) -> CGFloat {
        let area = pageSize.width * pageSize.height
        guard area > 0 else { return 2 }
        return max(2, min(4, (InkPages.maxInkPixels / area).squareRoot()))
    }

    static func flatten(
        _ document: PDFDocument, drawings: [Int: PKDrawing], pictures: [Int: [PagePicture]] = [:],
        to url: URL
    ) throws {
        let renderer = UIGraphicsPDFRenderer(bounds: pageRect(document.page(at: 0)))
        try renderer.writePDF(to: url) { context in
            for index in 0..<document.pageCount {
                guard let page = document.page(at: index) else { continue }
                let rect = pageRect(page)
                context.beginPage(withBounds: rect, pageInfo: [:])

                // UIKit's PDF context draws top-left down; a PDF page draws
                // bottom-up. Flip for the page, then put it back for the ink,
                // which was drawn in a canvas that is top-left down like UIKit.
                // `page.draw` applies the page's own box origin and rotation.
                let cg = context.cgContext
                cg.saveGState()
                cg.translateBy(x: 0, y: rect.height)
                cg.scaleBy(x: 1, y: -1)
                page.draw(with: box, to: cg)
                cg.restoreGState()

                // Page, pictures under the ink, the ink, pictures over it —
                // the order the reader shows.
                let onPage = PagePictures.stackingOrder(pictures[index] ?? [])
                drawPictures(onPage.filter { !$0.aboveInk })
                drawInk(drawings[index], in: rect)
                drawPictures(onPage.filter(\.aboveInk))
            }
        }
    }

    private static func drawInk(_ drawing: PKDrawing?, in rect: CGRect) {
        guard let drawing, !drawing.strokes.isEmpty else { return }
        // Rendered as if the app were in light mode, for the same
        // reason the reader pins every canvas to it: PencilKit adapts
        // ink to the appearance, and a black pen renders WHITE in dark
        // mode. `image(from:scale:)` reads UITraitCollection.current,
        // so with the app dark the strokes baked white onto white paper
        // and the export came out blank — "the ink is missing, or
        // dimmed". The paper is white in every appearance, so the ink
        // that goes on it is the light-mode ink, always.
        // (`performAsCurrent` hands back Void, so the image comes out
        // through a captured var rather than as the closure's value.)
        var ink: UIImage?
        UITraitCollection(userInterfaceStyle: .light).performAsCurrent {
            ink = drawing.image(from: rect, scale: inkScale(for: rect.size))
        }
        ink?.draw(in: rect)
    }

    /// From each JPEG's own data provider, so the PDF context embeds the JPEG
    /// rather than a bitmap.
    private static func drawPictures(_ pictures: [PagePicture]) {
        for picture in pictures {
            guard let provider = CGDataProvider(data: picture.jpeg as CFData),
                let image = CGImage(
                    jpegDataProviderSource: provider, decode: nil, shouldInterpolate: true,
                    intent: .defaultIntent)
            else { continue }
            UIImage(cgImage: image).draw(in: picture.frame)
        }
    }

    /// The page as the reader shows it, as a rect at the origin.
    static func pageRect(_ page: PDFPage?) -> CGRect {
        CGRect(origin: .zero, size: InkPages.displayedSize(of: page))
    }

    /**
     * A filename for the share sheet, from the IS document name.
     *
     * IS names are free text a teacher typed: they carry slashes, colons and the
     * odd newline, and they rarely end in `.pdf`. The student sees this in the
     * share sheet and again in Files, so it keeps its accents and spaces and
     * loses only what a filename cannot hold.
     */
    static func fileName(for title: String) -> String {
        let forbidden = CharacterSet(charactersIn: "/\\:*?\"<>|").union(.controlCharacters)
        let cleaned = title.components(separatedBy: forbidden).joined(separator: " ")
            .trimmingCharacters(in: .whitespacesAndNewlines)
        var name = cleaned.isEmpty ? "reIS" : String(cleaned.prefix(80))
        if name.lowercased().hasSuffix(".pdf") { name = String(name.dropLast(4)) }
        return "\(name).pdf"
    }
}
