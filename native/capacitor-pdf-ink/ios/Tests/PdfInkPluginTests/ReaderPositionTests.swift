import PDFKit
import XCTest

@testable import PdfInkPlugin

/**
 * Reopening a file on the page the student left it on.
 *
 * The first file is loaded before the space is presented, while the reader has
 * no size: PDFKit ignores `go(to:)` then, and fitting the page on the first
 * layout would put it back on page 1. So the page waits for a laid-out view,
 * and until it gets there it is still the page the reader reports.
 */
@available(iOS 16.0, *)
final class ReaderPositionTests: XCTestCase {
    func testAFileOpensOnThePageItWasLeftOn() throws {
        let reader = show(PdfInkViewController(strings: PdfInkStrings(nil)))
        XCTAssertTrue(reader.load(document: try deck(pages: 8), inkURL: ink(), title: "t", startPage: 5))
        reader.view.layoutIfNeeded()

        XCTAssertEqual(displayed(reader), 5)
        XCTAssertEqual(reader.currentPageIndex, 5)
    }

    func testAFileLoadedBeforeTheReaderIsOnScreenStillOpensThere() throws {
        let reader = PdfInkViewController(strings: PdfInkStrings(nil))
        XCTAssertTrue(reader.load(document: try deck(pages: 8), inkURL: ink(), title: "t", startPage: 4))
        // Closed before it was ever laid out: page 0 here would overwrite the page.
        XCTAssertEqual(reader.currentPageIndex, 4)

        show(reader)

        XCTAssertEqual(displayed(reader), 4, "PDFKit is not on the page")
        XCTAssertEqual(reader.currentPageIndex, 4)
    }

    /// The teacher re-uploaded a shorter deck: the nearest page is the last one.
    func testAPagePastTheEndOpensOnTheLastPage() throws {
        let reader = show(PdfInkViewController(strings: PdfInkStrings(nil)))
        XCTAssertTrue(reader.load(document: try deck(pages: 3), inkURL: ink(), title: "t", startPage: 40))
        reader.view.layoutIfNeeded()

        XCTAssertEqual(displayed(reader), 2)
    }

    func testNoSavedPageOpensAtTheTop() throws {
        let reader = show(PdfInkViewController(strings: PdfInkStrings(nil)))
        XCTAssertTrue(reader.load(document: try deck(pages: 6), inkURL: ink(), title: "t"))
        reader.view.layoutIfNeeded()

        XCTAssertEqual(displayed(reader), 0)
    }

    /// A second file must not inherit the first file's restore.
    func testTheNextFileStartsWhereItsOwnPageIs() throws {
        let reader = PdfInkViewController(strings: PdfInkStrings(nil))
        XCTAssertTrue(reader.load(document: try deck(pages: 8), inkURL: ink(), title: "a", startPage: 6))
        XCTAssertTrue(reader.load(document: try deck(pages: 8), inkURL: ink(), title: "b"))
        show(reader)

        XCTAssertEqual(displayed(reader), 0)
        XCTAssertEqual(reader.currentPageIndex, 0)
    }

    func testTheSpaceReportsThePageOfTheFileOnScreen() throws {
        let space = PdfInkSpace(
            courseTitle: "EBC-AP",
            files: [
                .init(
                    link: "l1", name: "Přednáška 1", date: "d", pdfURL: nil, inkURL: ink(),
                    lastPageIndex: 3)
            ],
            currentLink: "l1",
            strings: PdfInkStrings(nil))
        space.start(with: try deck(pages: 10))

        XCTAssertEqual(space.snapshotPositions(), ["l1": 3])
    }

    func testClosingTheSpaceHandsBackEveryPage() throws {
        let space = PdfInkSpace(
            courseTitle: "EBC-AP",
            files: [
                .init(
                    link: "l1", name: "Přednáška 1", date: "d", pdfURL: nil, inkURL: ink(),
                    lastPageIndex: 7)
            ],
            currentLink: "l1",
            strings: PdfInkStrings(nil))
        space.start(with: try deck(pages: 10))
        var closedWith: [String: Int]?
        space.onClose = { _, positions in closedWith = positions }

        let list = try XCTUnwrap(
            space.split.viewController(for: .primary) as? FileListViewController)
        list.loadViewIfNeeded()
        let close = try XCTUnwrap(list.navigationItem.leftBarButtonItem)
        _ = try XCTUnwrap(close.target).perform(try XCTUnwrap(close.action), with: close)

        XCTAssertEqual(closedWith, ["l1": 7])
    }

    /// Moving between files in the sidebar: each file comes back on its own page.
    func testEachFileInTheSpaceKeepsItsOwnPage() throws {
        let urlA = try write(deck(pages: 10)), urlB = try write(deck(pages: 10))
        let space = PdfInkSpace(
            courseTitle: "EBC-AP",
            files: [
                .init(link: "l1", name: "A", date: "d", pdfURL: urlA, inkURL: ink(), lastPageIndex: 3),
                .init(link: "l2", name: "B", date: "d", pdfURL: urlB, inkURL: ink()),
            ],
            currentLink: "l1",
            strings: PdfInkStrings(nil))
        let window = UIWindow(frame: CGRect(x: 0, y: 0, width: 820, height: 1000))
        window.rootViewController = space.split
        window.isHidden = false
        windows.append(window)
        space.start(with: try XCTUnwrap(InkDocument.open(at: urlA)))
        window.layoutIfNeeded()
        let nav = try XCTUnwrap(space.split.viewController(for: .secondary) as? UINavigationController)
        let reader = try XCTUnwrap(nav.topViewController as? PdfInkViewController)
        let list = try XCTUnwrap(space.split.viewController(for: .primary) as? FileListViewController)
        let pick = { (link: String) in
            list.onSelect?(link)
            window.layoutIfNeeded()
        }
        XCTAssertEqual(displayed(reader), 3)

        pick("l2")
        XCTAssertEqual(displayed(reader), 0, "B inherited A's page")
        reader.pdfView.go(to: try XCTUnwrap(reader.document?.page(at: 5)))

        pick("l1")
        XCTAssertEqual(displayed(reader), 3)
        pick("l2")
        XCTAssertEqual(displayed(reader), 5)
        XCTAssertEqual(space.snapshotPositions(), ["l1": 3, "l2": 5])
    }

    // MARK: - Helpers

    private func write(_ document: PDFDocument) throws -> URL {
        let url = FileManager.default.temporaryDirectory.appendingPathComponent("\(UUID().uuidString).pdf")
        XCTAssertTrue(document.write(to: url))
        return url
    }

    private var windows: [UIWindow] = []

    /// The page PDFKit actually shows, not what the reader says it will show.
    private func displayed(_ reader: PdfInkViewController) -> Int? {
        guard let document = reader.document, let page = reader.pdfView.currentPage else { return nil }
        return document.index(for: page)
    }

    @discardableResult
    private func show(_ reader: PdfInkViewController) -> PdfInkViewController {
        let window = UIWindow(frame: CGRect(x: 0, y: 0, width: 820, height: 1000))
        window.rootViewController = reader
        window.isHidden = false
        window.layoutIfNeeded()
        windows.append(window)
        return reader
    }

    private func deck(pages: Int) throws -> PDFDocument {
        let size = CGSize(width: 600, height: 800)
        let data = UIGraphicsPDFRenderer(bounds: CGRect(origin: .zero, size: size)).pdfData { ctx in
            for _ in 0..<pages {
                ctx.beginPage()
                UIColor.white.setFill()
                ctx.cgContext.fill(CGRect(origin: .zero, size: size))
            }
        }
        return try XCTUnwrap(PDFDocument(data: data))
    }

    private func ink() -> URL {
        FileManager.default.temporaryDirectory.appendingPathComponent("\(UUID().uuidString).ink")
    }

    override func tearDown() {
        for window in windows { window.isHidden = true }
        windows = []
        super.tearDown()
    }
}
