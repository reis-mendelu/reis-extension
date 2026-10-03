import PDFKit
import UIKit

/**
 * Reopening a file on the page the student left it on.
 *
 * The app keeps the page in its PDF cache index and hands it over per file;
 * the space collects where each file was left and hands it back (see
 * `PdfInkSpace.snapshotPositions`). Indices count the blank pages the student
 * added, which `load` puts back before the document reaches the view, so a
 * saved index means the same page on every open.
 *
 * The first file is loaded before the space is presented, while the reader has
 * no size. PDFKit ignores `go(to:)` then, and fitting the page on the first
 * layout would put it back on page 1 — so the page waits in `pendingStartPage`
 * for a laid-out view, and is what the reader reports until it gets there.
 */
@available(iOS 16.0, *)
extension PdfInkViewController {
    /// The page to open on, or nil for the top. A page past the end — the
    /// teacher re-uploaded a shorter deck — is the last page: still the nearest.
    static func startPage(_ saved: Int?, pageCount: Int) -> Int? {
        guard let saved, saved > 0, pageCount > 0 else { return nil }
        return min(saved, pageCount - 1)
    }

    /// The page the student is on, 0-based; nil with no file open.
    var currentPageIndex: Int? {
        if let pendingStartPage { return pendingStartPage }
        guard let document, let page = pdfView.currentPage else { return nil }
        return document.index(for: page)
    }

    func applyPendingStartPage() {
        guard let index = pendingStartPage, pdfView.bounds.width > 0, pdfView.bounds.height > 0,
            let page = document?.page(at: index)
        else { return }
        // `autoScales` has just been set; fit first, or the fit undoes the jump.
        pdfView.layoutIfNeeded()
        pdfView.go(to: page)
        pendingStartPage = nil
        updatePageItem()
    }
}
