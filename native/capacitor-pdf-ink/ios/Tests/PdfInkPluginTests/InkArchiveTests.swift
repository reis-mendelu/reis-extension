import XCTest
@testable import PdfInkPlugin

final class InkArchiveTests: XCTestCase {
    func testRoundTripsPagesAndPageCount() throws {
        let archive = InkArchive(pageCount: 12, pages: [0: Data([1, 2, 3]), 7: Data([9])])
        let decoded = try InkArchive.decode(archive.encoded())
        XCTAssertEqual(decoded, archive)
        XCTAssertEqual(decoded.version, InkArchive.currentVersion)
    }

    func testRejectsANewerVersion() throws {
        var archive = InkArchive(pageCount: 1, pages: [:])
        archive.version = InkArchive.currentVersion + 1
        XCTAssertThrowsError(try InkArchive.decode(archive.encoded())) { error in
            XCTAssertEqual(
                error as? InkArchiveError,
                .unsupportedVersion(InkArchive.currentVersion + 1))
        }
    }

    func testRoundTripsThePagesTheStudentAdded() throws {
        let archive = InkArchive(pageCount: 3, pages: [:], insertedPages: [1, 2])
        let decoded = try InkArchive.decode(archive.encoded())
        XCTAssertEqual(decoded.insertedPages, [1, 2])
        XCTAssertEqual(decoded.version, InkArchive.currentVersion)
    }

    /// Version 1 files predate added pages and have no such key; they must still
    /// open, with no added pages.
    func testReadsAVersionOneArchiveAsHavingNoAddedPages() throws {
        let v1: [String: Any] = ["version": 1, "pageCount": 4, "pages": [String: Data]()]
        let data = try PropertyListSerialization.data(
            fromPropertyList: v1, format: .binary, options: 0)
        let decoded = try InkArchive.decode(data)
        XCTAssertEqual(decoded.pageCount, 4)
        XCTAssertEqual(decoded.insertedPages, [])
    }

    /// A `covers` key the reader cannot read — any shape other than the
    /// withdrawn tool's `[Int: [CGRect]]` — is dropped, never fatal: the ink
    /// has to survive. The version stayed at 3 for the same reason.
    func testAnArchiveCarryingCoversStillOpensWithItsInk() throws {
        let withCovers: [String: Any] = [
            "version": 3, "pageCount": 4, "pages": ["7": Data([1, 2, 3])],
            "insertedPages": [2],
            // Whatever shape the rects were written in: the key is not read at
            // all now, which is the thing under test.
            "covers": ["1": [[10.0, 20.0, 30.0, 40.0]]],
        ]
        let data = try PropertyListSerialization.data(
            fromPropertyList: withCovers, format: .binary, options: 0)

        let decoded = try InkArchive.decode(data)

        XCTAssertEqual(decoded.pages, [7: Data([1, 2, 3])], "the ink was dropped")
        XCTAssertEqual(decoded.insertedPages, [2])
        XCTAssertEqual(decoded.coverCards, [:], "an unreadable withdrawn key is dropped")
    }

    func testRoundTripsCoverCards() throws {
        let cover = PageCover(
            id: "c", rect: CGRect(x: 10, y: 20, width: 30, height: 40),
            reviews: [CoverReview(date: Date(timeIntervalSince1970: 1_000), knew: false)])
        let archive = InkArchive(pageCount: 2, pages: [:], coverCards: [1: [cover]])

        let decoded = try InkArchive.decode(archive.encoded())

        XCTAssertEqual(decoded.coverCards, [1: [cover]])
        XCTAssertEqual(decoded.version, 3, "covers are additive; a bump quarantines older files")
    }

    /// The withdrawn tool (dev builds, 2026-09-07) wrote `covers` as bare
    /// rectangles. They come back as covers with fresh ids and no answers,
    /// and the ink comes with them.
    func testConvertsTheWithdrawnToolsCovers() throws {
        struct Withdrawn: Encodable {
            let version = 3
            let pageCount = 4
            let pages: [Int: Data] = [7: Data([1, 2, 3])]
            let insertedPages: [Int] = []
            let covers: [Int: [CGRect]] = [1: [CGRect(x: 10, y: 20, width: 30, height: 40)]]
        }
        let encoder = PropertyListEncoder()
        encoder.outputFormat = .binary

        let decoded = try InkArchive.decode(encoder.encode(Withdrawn()))

        XCTAssertEqual(decoded.pages, [7: Data([1, 2, 3])], "the ink was dropped")
        let converted = try XCTUnwrap(decoded.coverCards[1])
        XCTAssertEqual(converted.map(\.rect), [CGRect(x: 10, y: 20, width: 30, height: 40)])
        XCTAssertEqual(converted.first?.reviews, [])
        XCTAssertFalse(converted.first?.id.isEmpty ?? true)
    }

    func testNeverWritesTheWithdrawnKey() throws {
        let archive = InkArchive(
            pageCount: 1, pages: [:],
            coverCards: [0: [PageCover(rect: CGRect(x: 0, y: 0, width: 30, height: 30))]])

        let plist = try XCTUnwrap(
            PropertyListSerialization.propertyList(from: archive.encoded(), format: nil)
                as? [String: Any])

        XCTAssertNil(plist["covers"])
        XCTAssertNotNil(plist["coverCards"])
    }

    func testRejectsJunk() {
        XCTAssertThrowsError(try InkArchive.decode(Data("not a plist".utf8)))
    }

    func testRoundTripsPictures() throws {
        let picture = PagePicture(id: "p", frame: CGRect(x: 1, y: 2, width: 30, height: 40), jpeg: Data([7, 8]))
        let archive = InkArchive(pageCount: 2, pages: [:], pictures: [1: [picture]])
        let decoded = try InkArchive.decode(archive.encoded())
        XCTAssertEqual(decoded.pictures, [1: [picture]])
        XCTAssertEqual(decoded.version, 3, "pictures are additive; the version must not move")
    }

    /// Every archive on a device today has no `pictures` key.
    func testAnArchiveWithoutPicturesReadsAsHavingNone() throws {
        let v3: [String: Any] = ["version": 3, "pageCount": 4, "pages": ["1": Data([1])], "insertedPages": [Int]()]
        let data = try PropertyListSerialization.data(fromPropertyList: v3, format: .binary, options: 0)
        let decoded = try InkArchive.decode(data)
        XCTAssertEqual(decoded.pictures, [:])
        XCTAssertEqual(decoded.pages, [1: Data([1])])
    }
}
