import PDFKit
import PencilKit
import XCTest

@testable import PdfInkPlugin

/// "Vyzkoušet se": every cover in reading order, reveal, Znám / Ještě ne, kept.
@available(iOS 16.0, *)
final class ReaderRecallTests: XCTestCase {
    private let host = ReaderTestHost()
    private var strings: PdfInkStrings { host.strings }
    private let when = Date(timeIntervalSince1970: 1_000)

    override func tearDown() {
        host.closeAll()
        super.tearDown()
    }

    private func rect(y: CGFloat) -> CGRect { CGRect(x: 20, y: y, width: 80, height: 30) }

    func testTheEntryShowsOnlyWhenTheFileHasCovers() throws {
        let (reader, _) = try host.show(pages: 1)
        XCTAssertTrue(reader.recallItem.isHidden)

        reader.addCover(rect(y: 10), onPage: 0)
        XCTAssertFalse(reader.recallItem.isHidden)
    }

    func testATestGoesInReadingOrderRecordsAnswersAndEndsWithTheScore() throws {
        let (reader, ink) = try host.show(pages: 2)
        reader.now = { self.when }
        reader.addCover(rect(y: 100), onPage: 1)
        reader.addCover(rect(y: 300), onPage: 0)
        reader.addCover(rect(y: 50), onPage: 0)
        let first = try XCTUnwrap(reader.covers[0]?.first { $0.rect == self.rect(y: 50) }?.id)

        XCTAssertTrue(reader.startRecall())
        XCTAssertEqual(reader.recall?.current, RecallStep(page: 0, id: first))
        XCTAssertEqual(reader.title, "1 of 3")
        XCTAssertEqual(
            reader.navigationItem.rightBarButtonItems, [reader.endRecallItem, reader.revealItem])

        reader.revealCurrentCover()
        XCTAssertTrue(reader.revealedCovers.contains(first))
        XCTAssertEqual(
            reader.navigationItem.rightBarButtonItems,
            [reader.endRecallItem, reader.knewItem, reader.notYetItem])

        reader.answerRecall(knew: true)
        XCTAssertEqual(reader.title, "2 of 3")
        reader.revealCurrentCover()
        reader.answerRecall(knew: false)
        reader.revealCurrentCover()
        reader.answerRecall(knew: true)

        let score = try XCTUnwrap(reader.presentedViewController as? UIAlertController)
        XCTAssertEqual(score.title, "You know 2 of 3")
        XCTAssertEqual(score.actions.map(\.title), [strings.recallRetry, strings.done])
        let saved = try XCTUnwrap(InkStore.load(from: ink)).coverCards
        XCTAssertEqual(
            saved[0]?.first { $0.id == first }?.reviews, [CoverReview(date: when, knew: true)])
        XCTAssertEqual(saved.values.flatMap { $0 }.map(\.reviews.count), [1, 1, 1])
    }

    /// Tapping the cover itself is the same as Ukázat.
    func testTappingTheCurrentCoverRevealsIt() throws {
        let (reader, _) = try host.show(pages: 1)
        reader.addCover(rect(y: 10), onPage: 0)
        XCTAssertTrue(reader.startRecall())
        let id = try XCTUnwrap(reader.recall?.current?.id)

        reader.toggleCover(id, onPage: 0)

        XCTAssertEqual(
            reader.navigationItem.rightBarButtonItems,
            [reader.endRecallItem, reader.knewItem, reader.notYetItem])
    }

    func testLeavingEarlyKeepsTheAnswersGivenAndShutsEverything() throws {
        let (reader, ink) = try host.show(pages: 1)
        reader.addCover(rect(y: 10), onPage: 0)
        reader.addCover(rect(y: 100), onPage: 0)
        XCTAssertTrue(reader.startRecall())
        reader.revealCurrentCover()
        reader.answerRecall(knew: false)
        reader.revealCurrentCover()

        reader.endRecall()

        XCTAssertNil(reader.recall)
        XCTAssertTrue(reader.revealedCovers.isEmpty)
        XCTAssertEqual(reader.title, "t")
        XCTAssertEqual(reader.navigationItem.rightBarButtonItems, reader.fileToolItems)
        let reviews = try XCTUnwrap(InkStore.load(from: ink)).coverCards[0]?.map(\.reviews.count)
        XCTAssertEqual(reviews?.sorted(), [0, 1])
    }

    func testTheRetryAsksOnlyTheOnesNotKnownYet() throws {
        let (reader, _) = try host.show(pages: 1)
        reader.addCover(rect(y: 10), onPage: 0)
        reader.addCover(rect(y: 100), onPage: 0)
        XCTAssertTrue(reader.startRecall())
        reader.answerRecall(knew: true)
        reader.answerRecall(knew: false)
        let notYet = try XCTUnwrap(reader.recall?.notYetIDs)

        reader.endRecall()
        XCTAssertTrue(reader.startRecall(only: notYet))

        XCTAssertEqual(reader.recall?.total, 1)
        XCTAssertEqual(reader.title, "1 of 1")
    }

    /// Writing the answer before revealing it is the point.
    func testThePencilStillDrawsDuringATest() throws {
        let (reader, _) = try host.show(pages: 1)
        reader.addCover(rect(y: 10), onPage: 0)
        XCTAssertTrue(reader.startRecall())

        XCTAssertEqual(reader.canvas(onPage: 0)?.isUserInteractionEnabled, true)
        XCTAssertFalse(reader.makingCovers)
    }

    /// Found driving the simulator: a test started with the tape in hand, so
    /// the Pencil could not write an answer and a tap on the cover asked about
    /// would have taken it away. Starting a test hands back the pen.
    func testATestStartedWithTheTapeInHandHandsBackThePen() throws {
        guard #available(iOS 18.0, *) else { throw XCTSkip("custom palette items are iOS 18+") }
        let (reader, _) = try host.show(pages: 1)
        reader.addCover(rect(y: 10), onPage: 0)
        reader.toolPicker.selectedToolItemIdentifier = CoverTool.identifier
        reader.coverToolDidChange()

        XCTAssertTrue(reader.startRecall())

        XCTAssertFalse(reader.makingCovers)
        XCTAssertEqual(reader.toolPicker.selectedToolItemIdentifier, "com.apple.ink.pen")
        XCTAssertEqual(reader.overlays[0]?.coverLayer.isMakingCovers, false)
    }

    /// An answer is not something the palette's undo takes back.
    func testUndoNeverTakesBackAnAnswer() throws {
        let (reader, _) = try host.show(pages: 1)
        let undo = try XCTUnwrap(reader.undoManagerForPictures)
        reader.addCover(rect(y: 10), onPage: 0)
        RunLoop.current.run(until: Date().addingTimeInterval(0.05))
        undo.removeAllActions()
        XCTAssertTrue(reader.startRecall())

        reader.answerRecall(knew: true)
        RunLoop.current.run(until: Date().addingTimeInterval(0.05))

        XCTAssertFalse(undo.canUndo)
    }

    func testSwitchingFileEndsTheTest() throws {
        let (reader, _) = try host.show(pages: 1)
        reader.addCover(rect(y: 10), onPage: 0)
        XCTAssertTrue(reader.startRecall())

        try host.open(reader, pages: 1, ink: ReaderTestHost.tempInk())

        XCTAssertNil(reader.recall)
        XCTAssertEqual(reader.title, "t")
    }
}
