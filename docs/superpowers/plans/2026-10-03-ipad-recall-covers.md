# iPad covers and "Vyzkoušet se" Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Bring back the withdrawn cover tool in the iPad ink reader, give each cover an id and an answer history, and add a step-through self-test ("Vyzkoušet se") that records *Znám* / *Ještě ne* per cover.

**Architecture:** Covers are their own layer on top of each page's `PageOverlayView`, with rectangles in page points, saved in the ink archive under a new additive key `coverCards`. The gesture arithmetic (`PageCovers`) and the test's ordering and bookkeeping (`RecallSession`) are plain Swift with no UIKit. The view controller only wires them up, in two new extensions (`+Covers`, `+Recall`). Cover mode is entered from the `+` menu, like arranging pictures, so the bar gains exactly one item: the test entry.

**Tech Stack:** Swift 5, UIKit, PDFKit, PencilKit (iPadOS 16+), XCTest; TypeScript and vitest for the strings plumbing and a parity guard.

**Spec:** `docs/superpowers/specs/2026-10-03-ipad-recall-covers-design.md`. Read it first. The withdrawn implementation is in `d5026aaef` (`git show d5026aaef`); this plan reuses its decisions and much of its code.

## Global Constraints

- iPad native reader only: every Swift file lives in `native/capacitor-pdf-ink/ios/Sources/PdfInkPlugin/`, and every class that touches `PdfInkViewController` is `@available(iOS 16.0, *)`.
- `InkArchive.currentVersion` stays **3**. `coverCards` is an additive key. Never bump the version.
- The withdrawn `covers` key is read (converted) but **never written**.
- Which covers are open is **never saved**.
- Covers are **never exported**: `InkExport.swift` must not change.
- The Pencil still draws during a test; making covers is a visible mode with the pens away.
- Czech copy is gender-neutral; *Hotovo* reuses the existing `done` string.
- New strings go through `PdfInkStrings` (Swift), `PdfInkStrings` (TS, `src/mobile/pdfInk.ts`), `usePdfInkStrings.ts`, and both locale files.
- Max ~200 lines per new file; `PdfInkViewController.swift` (823 lines) gets stored properties and one-line hooks only. Logic goes in the extensions.
- New reader tests call `reader.willClose()` in `tearDown`. A reader left open breaks `ToolPickerResponderTests`, the #492 trap.
- **No simulator without asking.** `xcodebuild test` boots one, and Dominik said on 2026-10-03 not to use it unasked. Every task's red/green loop compiles with `build-for-testing` against a generic destination, which boots nothing. The full suite runs **once**, in Task 8, after asking.
- Commits end with `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`.

### Commands used throughout

Compile sources and tests (no simulator boot):

```bash
cd native/capacitor-pdf-ink && xcodebuild build-for-testing -scheme ReisCapacitorPdfInk -destination 'generic/platform=iOS Simulator' -quiet 2>&1 | tail -30; echo "exit ${pipestatus[1]}"
```

Expected on success: no `error:` lines and `exit 0`. The scheme is `ReisCapacitorPdfInk`; any other name fails with "does not contain a scheme named". `${pipestatus[1]}` is zsh: `$?` after a pipe is `tail`'s, not xcodebuild's.

---

### Task 1: Cover data and the archive key

**Files:**
- Create: `native/capacitor-pdf-ink/ios/Sources/PdfInkPlugin/PageCover.swift`
- Modify: `native/capacitor-pdf-ink/ios/Sources/PdfInkPlugin/InkArchive.swift`
- Test: `native/capacitor-pdf-ink/ios/Tests/PdfInkPluginTests/InkArchiveTests.swift`

**Interfaces:**
- Produces:
  - `struct PageCover: Codable, Equatable { var id: String; var rect: CGRect; var reviews: [CoverReview]; init(id: String = UUID().uuidString, rect: CGRect, reviews: [CoverReview] = []) }`
  - `struct CoverReview: Codable, Equatable { var date: Date; var knew: Bool }`
  - `InkArchive.coverCards: [Int: [PageCover]]`
  - `InkArchive.init(pageCount:pages:insertedPages:pictures:coverCards:)`, where `coverCards` defaults to `[:]`

- [ ] **Step 1: Write the failing tests**

Append to `InkArchiveTests` (inside the class):

```swift
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
```

In the existing `testAnArchiveCarryingCoversStillOpensWithItsInk`, its flat `[[10, 20, 30, 40]]` is not a valid `CGRect` encoding, so it now exercises the "unreadable, dropped, never fatal" path. Replace its doc comment and add one assertion after `XCTAssertEqual(decoded.insertedPages, [2])`:

```swift
    /// A `covers` key the reader cannot read — any shape other than the
    /// withdrawn tool's `[Int: [CGRect]]` — is dropped, never fatal: the ink
    /// has to survive. The version stayed at 3 for the same reason.
```

```swift
        XCTAssertEqual(decoded.coverCards, [:], "an unreadable withdrawn key is dropped")
```

- [ ] **Step 2: Compile to verify it fails**

Run the build-for-testing command. Expected: errors `cannot find 'PageCover' in scope` and `extra argument 'coverCards' in call`.

- [ ] **Step 3: Create `PageCover.swift`**

```swift
import CoreGraphics
import Foundation

/**
 * A block a student puts over part of a page to try to recall what is under it
 * (spec 2026-10-03-ipad-recall-covers-design.md).
 *
 * `rect` is in page points, the space the drawing and the pictures are in.
 * `reviews` is every answer given in "Vyzkoušet se", oldest first: the history
 * a later exam-date scheduler reads. Which covers are open right now is NOT
 * here, on purpose. That is never saved: reopening a file is exactly when the
 * answers should be hidden again.
 */
struct PageCover: Codable, Equatable {
    var id: String
    var rect: CGRect
    var reviews: [CoverReview]

    init(id: String = UUID().uuidString, rect: CGRect, reviews: [CoverReview] = []) {
        self.id = id
        self.rect = rect
        self.reviews = reviews
    }
}

/// One answer in a test: *Znám* (`knew`) or *Ještě ne*.
struct CoverReview: Codable, Equatable {
    var date: Date
    var knew: Bool
}
```

- [ ] **Step 4: Extend `InkArchive`**

In the header comment, replace the paragraph that starts "Version 3 also held `covers`" with:

```swift
 * Version 3 first held `covers`, bare rectangles from a cover tool that was
 * withdrawn on 2026-09-07 and only ever ran in dev builds. `coverCards`
 * (2026-10-03) is its return: covers with ids and an answer history, an
 * ADDITIVE key for the same reason as `pictures` below. A file that still has
 * the old `covers` key is converted on read (`legacyCovers`); the old key is
 * never written again.
```

Add the property after `pictures`:

```swift
    var coverCards: [Int: [PageCover]]
```

Replace the memberwise `init` with:

```swift
    init(
        pageCount: Int, pages: [Int: Data], insertedPages: [Int] = [],
        pictures: [Int: [PagePicture]] = [:], coverCards: [Int: [PageCover]] = [:]
    ) {
        self.version = Self.currentVersion
        self.pageCount = pageCount
        self.pages = pages
        self.insertedPages = insertedPages
        self.pictures = pictures
        self.coverCards = coverCards
    }
```

In `init(from:)`, after the `pictures =` line, add:

```swift
        coverCards =
            try container.decodeIfPresent([Int: [PageCover]].self, forKey: .coverCards)
            ?? Self.legacyCovers(from: decoder)
```

Change that initializer's doc comment to "Hand-written so a missing `insertedPages`, `pictures` or `coverCards` reads as empty: the synthesised initialiser fails on an absent key even with a default."

Add inside the struct, after `init(from:)`:

```swift
    /// The withdrawn tool's key. Read here and nowhere else; `CodingKeys` (the
    /// synthesised one, which `encode` uses) does not have it, so it is never
    /// written.
    private enum LegacyKeys: String, CodingKey { case covers }

    /// Bare rectangles become covers with fresh ids and no answers. Anything
    /// unreadable is dropped rather than thrown: the ink must still open.
    private static func legacyCovers(from decoder: Decoder) -> [Int: [PageCover]] {
        guard let legacy = try? decoder.container(keyedBy: LegacyKeys.self),
            let rects = try? legacy.decodeIfPresent([Int: [CGRect]].self, forKey: .covers)
        else { return [:] }
        return rects.mapValues { $0.map { PageCover(rect: $0) } }
    }
```

Add `import CoreGraphics` at the top of `InkArchive.swift` if it is not already there.

- [ ] **Step 5: Compile to verify it builds**

Run build-for-testing. Expected: `exit 0`. The behaviour is proven in Task 8's single test run; record these three test names for it.

- [ ] **Step 6: Commit**

```bash
git add native/capacitor-pdf-ink/ios/Sources/PdfInkPlugin/PageCover.swift native/capacitor-pdf-ink/ios/Sources/PdfInkPlugin/InkArchive.swift native/capacitor-pdf-ink/ios/Tests/PdfInkPluginTests/InkArchiveTests.swift
git commit -m "feat(pdf ink): covers with ids and an answer history in the ink archive

coverCards is an additive key at version 3. The withdrawn tool's bare
rectangles are converted on read and never written again.

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 2: Cover geometry (`PageCovers`)

**Files:**
- Create: `native/capacitor-pdf-ink/ios/Sources/PdfInkPlugin/PageCovers.swift`
- Test: `native/capacitor-pdf-ink/ios/Tests/PdfInkPluginTests/PageCoversTests.swift`

**Interfaces:**
- Consumes: `PageCover` (Task 1).
- Produces: `enum PageCovers { static let minimumSide: CGFloat; static func rect(from: CGPoint, to: CGPoint) -> CGRect?; static func cover(at: CGPoint, in: [PageCover]) -> PageCover? }`

The withdrawn tool also had `PageCovers.gesture(from:to:over:)`, which told a drag from a tap by distance inside raw `touchesEnded`. Here that job goes to UIKit: a pan recognizer creates and a tap recognizer opens or removes (Task 4). So `gesture` and its `Gesture` enum are not restored.

- [ ] **Step 1: Write the failing tests**

Create `PageCoversTests.swift`:

```swift
import CoreGraphics
import XCTest

@testable import PdfInkPlugin

/// The geometry a drag and a tap are judged by.
final class PageCoversTests: XCTestCase {
    private let big = PageCover(id: "big", rect: CGRect(x: 0, y: 0, width: 100, height: 100))

    func testADragMakesTheSameBlockWhicheverCornerItStartedFrom() {
        let downhill = PageCovers.rect(from: CGPoint(x: 10, y: 10), to: CGPoint(x: 90, y: 70))
        let uphill = PageCovers.rect(from: CGPoint(x: 90, y: 70), to: CGPoint(x: 10, y: 10))

        XCTAssertEqual(downhill, CGRect(x: 10, y: 10, width: 80, height: 60))
        XCTAssertEqual(downhill, uphill)
    }

    func testADragTooShortInEitherDirectionIsNotACover() {
        XCTAssertNil(PageCovers.rect(from: .zero, to: CGPoint(x: 200, y: 4)))
        XCTAssertNil(PageCovers.rect(from: .zero, to: CGPoint(x: 4, y: 200)))
        XCTAssertNotNil(PageCovers.rect(from: .zero, to: CGPoint(x: 24, y: 24)))
    }

    func testTheCoverUnderAPointIsTheOneOnTop() {
        let small = PageCover(id: "small", rect: CGRect(x: 20, y: 20, width: 40, height: 40))

        XCTAssertEqual(PageCovers.cover(at: CGPoint(x: 30, y: 30), in: [big, small])?.id, "small")
        XCTAssertEqual(PageCovers.cover(at: CGPoint(x: 80, y: 80), in: [big, small])?.id, "big")
        XCTAssertNil(PageCovers.cover(at: CGPoint(x: 500, y: 500), in: [big, small]))
    }
}
```

- [ ] **Step 2: Compile to verify it fails**

Run build-for-testing. Expected: `cannot find 'PageCovers' in scope`.

- [ ] **Step 3: Create `PageCovers.swift`**

```swift
import CoreGraphics

/**
 * The geometry of covers, kept out of the view. Restored from the withdrawn
 * tool (d5026aaef) with covers named by id instead of position. Telling a drag
 * (create) from a tap (open or remove) is UIKit's job now, in CoverLayerView's
 * recognizers.
 */
enum PageCovers {
    /// A drag shorter than this in either direction was a tap. It is also the
    /// smallest cover worth having: there is nothing to hide behind a sliver.
    static let minimumSide: CGFloat = 24

    /// The block a drag covers, whichever corner it started from. Nil when it
    /// is too small to have been meant as one.
    static func rect(from start: CGPoint, to end: CGPoint) -> CGRect? {
        let rect = CGRect(
            x: min(start.x, end.x), y: min(start.y, end.y),
            width: abs(end.x - start.x), height: abs(end.y - start.y))
        guard rect.width >= minimumSide, rect.height >= minimumSide else { return nil }
        return rect
    }

    /// The cover under a point. The last one made wins, because it is drawn on top.
    static func cover(at point: CGPoint, in covers: [PageCover]) -> PageCover? {
        covers.last { $0.rect.contains(point) }
    }

}
```

- [ ] **Step 4: Compile to verify it builds**

Run build-for-testing. Expected: `exit 0`.

- [ ] **Step 5: Commit**

```bash
git add native/capacitor-pdf-ink/ios/Sources/PdfInkPlugin/PageCovers.swift native/capacitor-pdf-ink/ios/Tests/PdfInkPluginTests/PageCoversTests.swift
git commit -m "feat(pdf ink): cover geometry, by id

Restored from d5026aaef without its distance-based drag/tap split, which
moves to gesture recognizers in the cover layer.

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 3: The test's logic (`RecallSession`)

**Files:**
- Create: `native/capacitor-pdf-ink/ios/Sources/PdfInkPlugin/RecallSession.swift`
- Test: `native/capacitor-pdf-ink/ios/Tests/PdfInkPluginTests/RecallSessionTests.swift`

**Interfaces:**
- Consumes: `PageCover`, `CoverReview` (Task 1).
- Produces:
  - `struct RecallStep: Equatable { let page: Int; let id: String }`
  - `struct RecallSession: Equatable`, with `init?(covers: [Int: [PageCover]], only: Set<String>? = nil)`, `let steps: [RecallStep]`, `var current: RecallStep?`, `var isFinished: Bool`, `var number: Int` (1-based), `var total: Int`, `var knownCount: Int`, `var notYetIDs: Set<String>`, `mutating func answer(knew: Bool, at: Date) -> (step: RecallStep, review: CoverReview)?`, `func retry(over: [Int: [PageCover]]) -> RecallSession?`

- [ ] **Step 1: Write the failing tests**

Create `RecallSessionTests.swift`:

```swift
import CoreGraphics
import XCTest

@testable import PdfInkPlugin

/// "Vyzkoušet se" asks the covers in the order a page is read, records each
/// answer, and can run again over just the ones not known yet.
final class RecallSessionTests: XCTestCase {
    private func cover(_ id: String, x: CGFloat, y: CGFloat) -> PageCover {
        PageCover(id: id, rect: CGRect(x: x, y: y, width: 60, height: 30))
    }

    func testAsksInReadingOrderAcrossPagesAndWithinAPage() throws {
        let covers: [Int: [PageCover]] = [
            2: [cover("p2-top", x: 0, y: 0)],
            0: [
                cover("p0-below", x: 0, y: 300),
                // Same row as p0-left (minY 100 vs 104), so left to right decides.
                cover("p0-right", x: 300, y: 100),
                cover("p0-left", x: 50, y: 104),
            ],
        ]

        let session = try XCTUnwrap(RecallSession(covers: covers))

        XCTAssertEqual(session.steps.map(\.id), ["p0-left", "p0-right", "p0-below", "p2-top"])
        XCTAssertEqual(session.steps.map(\.page), [0, 0, 0, 2])
    }

    func testAnAnswerReturnsTheReviewForTheCurrentCoverAndMovesOn() throws {
        var session = try XCTUnwrap(
            RecallSession(covers: [0: [cover("a", x: 0, y: 0), cover("b", x: 0, y: 100)]]))
        let when = Date(timeIntervalSince1970: 42)

        XCTAssertEqual(session.number, 1)
        let first = try XCTUnwrap(session.answer(knew: true, at: when))

        XCTAssertEqual(first.step, RecallStep(page: 0, id: "a"))
        XCTAssertEqual(first.review, CoverReview(date: when, knew: true))
        XCTAssertEqual(session.current, RecallStep(page: 0, id: "b"))
        XCTAssertEqual(session.number, 2)
    }

    func testFinishesAfterTheLastAnswerAndCounts() throws {
        var session = try XCTUnwrap(
            RecallSession(covers: [0: [cover("a", x: 0, y: 0), cover("b", x: 0, y: 100)]]))

        session.answer(knew: true, at: Date())
        session.answer(knew: false, at: Date())

        XCTAssertTrue(session.isFinished)
        XCTAssertNil(session.answer(knew: true, at: Date()), "nothing left to answer")
        XCTAssertEqual(session.number, 2, "the counter never reads 3 of 2")
        XCTAssertEqual(session.knownCount, 1)
        XCTAssertEqual(session.notYetIDs, ["b"])
    }

    func testTheRetryHoldsExactlyTheNotYetCoversInOrder() throws {
        let covers: [Int: [PageCover]] = [
            0: [cover("a", x: 0, y: 0), cover("b", x: 0, y: 100), cover("c", x: 0, y: 200)]
        ]
        var session = try XCTUnwrap(RecallSession(covers: covers))
        session.answer(knew: false, at: Date())
        session.answer(knew: true, at: Date())
        session.answer(knew: false, at: Date())

        let retry = try XCTUnwrap(session.retry(over: covers))

        XCTAssertEqual(retry.steps.map(\.id), ["a", "c"])
        XCTAssertEqual(retry.number, 1)
    }

    func testNoCoversNoSessionAndNothingToRetryWhenAllWereKnown() throws {
        XCTAssertNil(RecallSession(covers: [:]))
        XCTAssertNil(RecallSession(covers: [0: []]))

        let covers: [Int: [PageCover]] = [0: [cover("a", x: 0, y: 0)]]
        var session = try XCTUnwrap(RecallSession(covers: covers))
        session.answer(knew: true, at: Date())
        XCTAssertNil(session.retry(over: covers))
    }
}
```

- [ ] **Step 2: Compile to verify it fails**

Run build-for-testing. Expected: `cannot find 'RecallSession' in scope`.

- [ ] **Step 3: Create `RecallSession.swift`**

```swift
import CoreGraphics
import Foundation

/// One cover to ask about: which page it is on and which cover it is.
struct RecallStep: Equatable {
    let page: Int
    let id: String
}

/**
 * One run of "Vyzkoušet se" over a file's covers: the order they are asked in,
 * where the test is, and the answers given so far.
 *
 * No UIKit. The reader shows `current` and calls `answer`; what to save
 * (the returned `CoverReview`) and what to draw stay with the reader.
 *
 * The order is reading order: page, then rows top to bottom, then left to
 * right within a row. A "row" is a 16 pt band of the cover's top edge, so two
 * covers dragged out next to each other a few points apart still read left to
 * right instead of by a few points of height.
 */
struct RecallSession: Equatable {
    static let rowHeight: CGFloat = 16

    let steps: [RecallStep]
    private(set) var position = 0
    private(set) var answers: [String: Bool] = [:]

    /// Nil when there is nothing to ask. `only` limits the session to those
    /// cover ids (the retry).
    init?(covers: [Int: [PageCover]], only ids: Set<String>? = nil) {
        let ordered =
            covers
            .flatMap { page, list in list.map { (page: page, cover: $0) } }
            .filter { ids?.contains($0.cover.id) ?? true }
            .sorted { Self.readingKey($0.page, $0.cover) < Self.readingKey($1.page, $1.cover) }
            .map { RecallStep(page: $0.page, id: $0.cover.id) }
        guard !ordered.isEmpty else { return nil }
        steps = ordered
    }

    private static func readingKey(_ page: Int, _ cover: PageCover)
        -> (Int, Int, CGFloat, CGFloat, String)
    {
        let row = Int((cover.rect.minY / rowHeight).rounded(.down))
        return (page, row, cover.rect.minX, cover.rect.minY, cover.id)
    }

    var current: RecallStep? { steps.indices.contains(position) ? steps[position] : nil }
    var isFinished: Bool { current == nil }
    /// The cover being asked, 1-based, for "3 z 10". Stays at `total` once finished.
    var number: Int { min(position + 1, steps.count) }
    var total: Int { steps.count }
    var knownCount: Int { answers.values.filter { $0 }.count }
    var notYetIDs: Set<String> { Set(answers.compactMap { $0.value ? nil : $0.key }) }

    /// Records the answer for the current cover and moves on. Returns the step
    /// it was for and the review to append to that cover; nil once finished.
    @discardableResult
    mutating func answer(knew: Bool, at date: Date) -> (step: RecallStep, review: CoverReview)? {
        guard let step = current else { return nil }
        answers[step.id] = knew
        position += 1
        return (step, CoverReview(date: date, knew: knew))
    }

    /// The same test over just the covers answered *Ještě ne*. Nil when there are none.
    func retry(over covers: [Int: [PageCover]]) -> RecallSession? {
        let ids = notYetIDs
        guard !ids.isEmpty else { return nil }
        return RecallSession(covers: covers, only: ids)
    }
}
```

`RecallSession` is `Equatable` only through its stored properties, which are all `Equatable`. If the compiler cannot synthesise it, remove `Equatable` from the struct: no test compares two sessions.

- [ ] **Step 4: Compile to verify it builds**

Run build-for-testing. Expected: `exit 0`.

- [ ] **Step 5: Commit**

```bash
git add native/capacitor-pdf-ink/ios/Sources/PdfInkPlugin/RecallSession.swift native/capacitor-pdf-ink/ios/Tests/PdfInkPluginTests/RecallSessionTests.swift
git commit -m "feat(pdf ink): RecallSession — reading order, answers, retry

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 4: The cover layer on each page

**Why this differs from the withdrawn layer.** `d5026aaef` handled raw `touchesBegan/Ended`. On the student's iPad, dragging out a cover did not work. PDFKit's scroll view claimed the drag first, and the page slid instead. `ed7016e4` tried pinning the scroller with `isScrollEnabled = false`, and the tool was withdrawn with creation still unproven on a device (that commit's message). The picture layer (#492) solved the same fight in a way that works on the device: gesture recognizers that PDFKit's scroll recognizers are *required to wait for* (`PictureLayerView.gestureRecognizer(_:shouldBeRequiredToFailBy:)`). This layer uses that exact pattern:

- A **pan**, enabled only in cover mode, draws a new cover. One finger only, so two fingers still scroll and zoom.
- A **tap**, always on, opens or shuts a cover. In cover mode it removes one instead.

A tap recognizer fails as soon as the finger travels. So a scroll that starts on a cover never opens it, which is the review fix from `ed7016e4` and comes for free here.

**Files:**
- Create: `native/capacitor-pdf-ink/ios/Sources/PdfInkPlugin/CoverLayerView.swift`
- Modify: `native/capacitor-pdf-ink/ios/Sources/PdfInkPlugin/PageOverlayView.swift`
- Test: `native/capacitor-pdf-ink/ios/Tests/PdfInkPluginTests/CoverTouchRoutingTests.swift` (restored from `ed7016e4`, adapted)

**Interfaces:**
- Consumes: `PageCover`, `PageCovers` (Tasks 1–2).
- Produces:
  - `final class CoverLayerView: UIView, UIGestureRecognizerDelegate`, with `var covers: [PageCover]`, `var revealed: Set<String>`, `var currentID: String?`, `var currentColor: UIColor`, `var isMakingCovers: Bool`, `var onCreate: ((CGRect) -> Void)?`, `var onRemove: ((String) -> Void)?`, `var onToggle: ((String) -> Void)?`, `let dragRecognizer: UIPanGestureRecognizer`, `let tapRecognizer: UITapGestureRecognizer`
  - `PageOverlayView.coverLayer: CoverLayerView`, the topmost subview, framed to the overlay's bounds

- [ ] **Step 1: Write the failing tests**

Create `CoverTouchRoutingTests.swift`:

```swift
import PencilKit
import UIKit
import XCTest

@testable import PdfInkPlugin

/**
 * Whether a touch on the page can actually reach the cover layer, and whether
 * PDFKit's scroller lets it keep the touch (restored from ed7016e4, by id).
 *
 * The layer's own `hitTest` proves nothing about the hierarchy it lives in:
 * the canvas and the picture layer are siblings, PDFKit sets the frames, and a
 * layer that is never laid out has zero size and no touch lands on it. These
 * ask the container the question a real touch asks it.
 */
@available(iOS 16.0, *)
final class CoverTouchRoutingTests: XCTestCase {
    private let page = CGRect(x: 0, y: 0, width: 595, height: 842)
    private let cover = PageCover(id: "a", rect: CGRect(x: 100, y: 100, width: 200, height: 80))

    private func overlay() -> PageOverlayView {
        let overlay = PageOverlayView()
        overlay.frame = page  // all PDFKit does
        overlay.layoutIfNeeded()
        return overlay
    }

    func testTheCoverLayerIsOnTopAndSizedByPdfkitSettingTheFrame() {
        let overlay = overlay()

        XCTAssertTrue(overlay.subviews.last === overlay.coverLayer)
        XCTAssertEqual(overlay.coverLayer.frame, overlay.bounds)
        XCTAssertEqual(overlay.canvas.frame, overlay.bounds)
    }

    func testATouchOnACoverReachesTheCoverLayerAndNotTheCanvas() {
        let overlay = overlay()
        overlay.coverLayer.covers = [cover]

        let hit = overlay.hitTest(CGPoint(x: 150, y: 140), with: nil)

        XCTAssertTrue(hit === overlay.coverLayer, "a tap on a cover landed on \(String(describing: hit))")
    }

    func testATouchOnBarePageReachesTheCanvasSoDrawingStillWorks() {
        let overlay = overlay()
        overlay.coverLayer.covers = [cover]

        let hit = overlay.hitTest(CGPoint(x: 450, y: 600), with: nil)

        XCTAssertFalse(hit === overlay.coverLayer, "the cover layer swallowed a touch on bare page")
    }

    /// The one the whole tool rests on: in cover mode a drag starting on bare
    /// page has to reach the layer, or no cover can ever be drawn.
    func testInCoverModeABarePageTouchReachesTheCoverLayer() {
        let overlay = overlay()
        overlay.coverLayer.isMakingCovers = true

        let hit = overlay.hitTest(CGPoint(x: 450, y: 600), with: nil)

        XCTAssertTrue(hit === overlay.coverLayer, "in cover mode a drag landed on \(String(describing: hit))")
    }

    /// The device failure of 2026-09-07: PDFKit's scroller took the drag and
    /// the page slid instead. Its recognizers must wait for ours, the
    /// way they wait for the picture layer's (#492).
    func testPdfkitsScrollerWaitsForTheCoverLayersGestures() {
        let layer = CoverLayerView()
        let scroller = UIScrollView()

        for ours in [layer.dragRecognizer, layer.tapRecognizer] as [UIGestureRecognizer] {
            XCTAssertTrue(
                layer.gestureRecognizer(ours, shouldBeRequiredToFailBy: scroller.panGestureRecognizer))
        }
    }

    /// Outside cover mode the drag must not exist: a scroll that starts on a
    /// cover would otherwise be held up waiting for it.
    func testTheDragExistsOnlyInCoverMode() {
        let layer = CoverLayerView()
        XCTAssertFalse(layer.dragRecognizer.isEnabled)

        layer.isMakingCovers = true
        XCTAssertTrue(layer.dragRecognizer.isEnabled)

        layer.isMakingCovers = false
        XCTAssertFalse(layer.dragRecognizer.isEnabled)
    }

    func testAnInertLayerTakesNothing() {
        let overlay = overlay()
        overlay.coverLayer.covers = [cover]
        overlay.coverLayer.isUserInteractionEnabled = false  // what arranging pictures sets

        XCTAssertFalse(overlay.hitTest(CGPoint(x: 150, y: 140), with: nil) === overlay.coverLayer)
    }
}
```

- [ ] **Step 2: Compile to verify it fails**

Run build-for-testing. Expected: `cannot find 'CoverLayerView' in scope` and `value of type 'PageOverlayView' has no member 'coverLayer'`.

- [ ] **Step 3: Create `CoverLayerView.swift`**

```swift
import UIKit

/**
 * The covers over one page, and the gestures that make and open them.
 *
 * On top of everything else on the page, and invisible to touches that are
 * not about covers: outside a cover `hitTest` returns nothing, so drawing,
 * scrolling and picking a picture up reach the views below exactly as before.
 * Inside a cover it takes the touch, which is also why a covered patch cannot
 * be drawn on: it is covered.
 *
 * Gesture recognizers, not raw touches. The withdrawn layer (d5026aaef) used
 * touchesBegan/Ended, and on a real iPad PDFKit's scroller took the drag and
 * the page slid under the finger (ed7016e4). PDFKit's recognizers wait for
 * these to fail, the way they wait for the picture layer's (#492).
 */
final class CoverLayerView: UIView, UIGestureRecognizerDelegate {
    var covers: [PageCover] = [] { didSet { setNeedsDisplay() } }
    /// The covers being looked under right now. Never saved.
    var revealed: Set<String> = [] { didSet { setNeedsDisplay() } }
    /// The cover "Vyzkoušet se" is asking about, outlined in `currentColor`.
    var currentID: String? { didSet { setNeedsDisplay() } }
    var currentColor: UIColor = .tintColor { didSet { setNeedsDisplay() } }
    /// Cover mode: the layer takes every touch on the page, and the drag is on.
    var isMakingCovers = false {
        didSet {
            dragRecognizer.isEnabled = isMakingCovers
            setNeedsDisplay()
        }
    }

    var onCreate: ((CGRect) -> Void)?
    var onRemove: ((String) -> Void)?
    var onToggle: ((String) -> Void)?

    /// One finger drags out a new cover; two fingers still scroll and zoom.
    let dragRecognizer = UIPanGestureRecognizer()
    /// Opens or shuts a cover; in cover mode, takes it away.
    let tapRecognizer = UITapGestureRecognizer()

    private var dragStart: CGPoint?
    private var dragEnd: CGPoint?

    override init(frame: CGRect) {
        super.init(frame: frame)
        backgroundColor = .clear
        isOpaque = false
        contentMode = .redraw
        // PDF paper is white in any appearance, the same reason the canvas
        // under this one is forced light.
        overrideUserInterfaceStyle = .light
        dragRecognizer.addTarget(self, action: #selector(dragged(_:)))
        dragRecognizer.maximumNumberOfTouches = 1
        dragRecognizer.isEnabled = false
        tapRecognizer.addTarget(self, action: #selector(tapped(_:)))
        for recognizer in [dragRecognizer, tapRecognizer] as [UIGestureRecognizer] {
            recognizer.delegate = self
            addGestureRecognizer(recognizer)
        }
    }

    required init?(coder: NSCoder) { fatalError("CoverLayerView is code-only") }

    override func hitTest(_ point: CGPoint, with event: UIEvent?) -> UIView? {
        guard isUserInteractionEnabled, !isHidden, alpha > 0.01 else { return nil }
        if isMakingCovers { return bounds.contains(point) ? self : nil }
        return PageCovers.cover(at: point, in: covers) != nil ? self : nil
    }

    // MARK: - Gestures

    /// PDFView's scroll and zoom wait for ours to fail, so dragging out a
    /// cover never scrolls the page under it. Ours only ever see touches the
    /// layer took in `hitTest`.
    func gestureRecognizer(
        _ gestureRecognizer: UIGestureRecognizer,
        shouldBeRequiredToFailBy otherGestureRecognizer: UIGestureRecognizer
    ) -> Bool {
        otherGestureRecognizer.view is UIScrollView
    }

    func gestureRecognizer(
        _ gestureRecognizer: UIGestureRecognizer,
        shouldRecognizeSimultaneouslyWith otherGestureRecognizer: UIGestureRecognizer
    ) -> Bool {
        otherGestureRecognizer.view === self
    }

    @objc private func dragged(_ pan: UIPanGestureRecognizer) {
        let location = pan.location(in: self)
        switch pan.state {
        case .began:
            let moved = pan.translation(in: self)
            dragStart = CGPoint(x: location.x - moved.x, y: location.y - moved.y)
            dragEnd = location
        case .changed:
            dragEnd = location
        case .ended:
            if let start = dragStart, let rect = PageCovers.rect(from: start, to: location) {
                onCreate?(rect)
            }
            dragStart = nil
            dragEnd = nil
        default:
            dragStart = nil
            dragEnd = nil
        }
        setNeedsDisplay()
    }

    @objc private func tapped(_ tap: UITapGestureRecognizer) {
        guard tap.state == .ended,
            let cover = PageCovers.cover(at: tap.location(in: self), in: covers)
        else { return }
        if isMakingCovers { onRemove?(cover.id) } else { onToggle?(cover.id) }
    }

    // MARK: - Drawing

    override func draw(_ rect: CGRect) {
        guard let context = UIGraphicsGetCurrentContext() else { return }
        for cover in covers {
            if revealed.contains(cover.id) {
                // Open: the answer shows through, with just enough outline
                // left that the student can shut it again.
                context.setStrokeColor(UIColor.systemGray2.cgColor)
                context.setLineDash(phase: 0, lengths: [4, 4])
                context.stroke(cover.rect.insetBy(dx: 0.5, dy: 0.5), width: 1)
                context.setLineDash(phase: 0, lengths: [])
            } else {
                context.setFillColor(UIColor.systemGray4.cgColor)
                context.fill(cover.rect)
            }
            if cover.id == currentID {
                context.setStrokeColor(currentColor.cgColor)
                context.stroke(cover.rect.insetBy(dx: -1, dy: -1), width: 2)
            }
        }
        guard isMakingCovers, let start = dragStart, let end = dragEnd else { return }
        context.setStrokeColor(UIColor.systemGray.cgColor)
        context.setLineDash(phase: 0, lengths: [6, 4])
        context.stroke(
            CGRect(
                x: min(start.x, end.x), y: min(start.y, end.y),
                width: abs(end.x - start.x), height: abs(end.y - start.y)), width: 1)
    }
}
```

- [ ] **Step 4: Put the layer on top in `PageOverlayView`**

In the header comment, change "Three things, bottom to top: …" so it lists four, ending with "…, and `coverLayer` on top of all of them: the covers a student puts over an answer (2026-10-03), which hide pictures too."

Add the property after `pictureLayer`:

```swift
    let coverLayer = CoverLayerView()
```

In `init(frame:)`, after `addSubview(pictureLayer)`:

```swift
        addSubview(coverLayer)
```

In `layoutSubviews()`, after `pictureLayer.frame = bounds`:

```swift
        coverLayer.frame = bounds
```

- [ ] **Step 5: Compile to verify it builds**

Run build-for-testing. Expected: `exit 0`.

- [ ] **Step 6: Commit**

```bash
git add native/capacitor-pdf-ink/ios/Sources/PdfInkPlugin/CoverLayerView.swift native/capacitor-pdf-ink/ios/Sources/PdfInkPlugin/PageOverlayView.swift native/capacitor-pdf-ink/ios/Tests/PdfInkPluginTests/CoverTouchRoutingTests.swift
git commit -m "feat(pdf ink): the cover layer, on top, on gesture recognizers

The withdrawn layer's raw touches lost the drag to PDFKit's scroller on a
real iPad (ed7016e4). This one uses the picture layer's pattern (#492):
PDFKit's recognizers wait for ours. The drag exists only in cover mode.

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 5: Strings, both sides, and the parity guard

**Files:**
- Modify: `native/capacitor-pdf-ink/ios/Sources/PdfInkPlugin/PdfInkStrings.swift`
- Modify: `src/mobile/pdfInk.ts` (the `PdfInkStrings` interface)
- Modify: `src/hooks/ui/usePdfInkStrings.ts`
- Modify: `src/i18n/locales/cs.json`, `src/i18n/locales/en.json` (inside `mobile.pdfInk`, after `"done"`)
- Modify: `src/mobile/__tests__/pdfInk.test.ts` (the strings fixture)
- Create: `src/test/guards/inkCoversAreIpadOnly.test.ts`
- Test: `native/capacitor-pdf-ink/ios/Tests/PdfInkPluginTests/PdfInkStringsTests.swift`

**Interfaces:**
- Consumes: `CoverLayerView`, `InkArchive.coverCards` (the guard reads them).
- Produces:
  - `PdfInkStrings` fields `cover`, `recallStart`, `recallReveal`, `recallKnew`, `recallNotYet`, `recallProgress`, `recallEnd`, `recallRetry`, `recallScore`, all `String`
  - `static func PdfInkStrings.fill(_ template: String, _ values: [String: Int]) -> String`

- [ ] **Step 1: Write the failing Swift test**

Create `PdfInkStringsTests.swift`:

```swift
import XCTest

@testable import PdfInkPlugin

final class PdfInkStringsTests: XCTestCase {
    func testFillReplacesNamedPlaceholdersAndLeavesOthers() {
        XCTAssertEqual(PdfInkStrings.fill("{n} z {total}", ["n": 3, "total": 10]), "3 z 10")
        XCTAssertEqual(PdfInkStrings.fill("{n} of {x}", ["n": 1]), "1 of {x}")
    }

    func testTheTestCopyHasEnglishFallbacks() {
        let strings = PdfInkStrings(nil)
        XCTAssertEqual(strings.recallStart, "Test me")
        XCTAssertEqual(
            PdfInkStrings.fill(strings.recallScore, ["known": 2, "total": 3]), "You know 2 of 3")
    }
}
```

- [ ] **Step 2: Compile to verify it fails**

Run build-for-testing. Expected: `type 'PdfInkStrings' has no member 'fill'`.

- [ ] **Step 3: Add the Swift strings**

In `PdfInkStrings.swift`, add after `let done: String`:

```swift
    /// The `+` menu entry that enters cover mode.
    let cover: String
    /// "Vyzkoušet se": the bar entry, the reveal, the two answers, the counter
    /// ("{n}" / "{total}"), leaving early, the retry, and the score
    /// ("{known}" / "{total}").
    let recallStart: String
    let recallReveal: String
    let recallKnew: String
    let recallNotYet: String
    let recallProgress: String
    let recallEnd: String
    let recallRetry: String
    let recallScore: String
```

At the end of `init(_:)`:

```swift
        cover = object?["cover"] as? String ?? "Cover an answer"
        recallStart = object?["recallStart"] as? String ?? "Test me"
        recallReveal = object?["recallReveal"] as? String ?? "Show"
        recallKnew = object?["recallKnew"] as? String ?? "I know it"
        recallNotYet = object?["recallNotYet"] as? String ?? "Not yet"
        recallProgress = object?["recallProgress"] as? String ?? "{n} of {total}"
        recallEnd = object?["recallEnd"] as? String ?? "End"
        recallRetry = object?["recallRetry"] as? String ?? "Repeat the ones I don't know yet"
        recallScore = object?["recallScore"] as? String ?? "You know {known} of {total}"
```

After `init(_:)`, inside the struct:

```swift
    /// Puts numbers into copy that came from the app's i18n, which marks them
    /// `{name}` (src/i18n/translate.ts). A placeholder with no value is left as is.
    static func fill(_ template: String, _ values: [String: Int]) -> String {
        values.reduce(template) { text, pair in
            text.replacingOccurrences(of: "{\(pair.key)}", with: String(pair.value))
        }
    }
```

- [ ] **Step 4: Compile to verify it builds**

Run build-for-testing. Expected: `exit 0`.

- [ ] **Step 5: Add the TS strings**

In `src/mobile/pdfInk.ts`, inside `interface PdfInkStrings` after `done: string;`:

```ts
  /** `+` menu entry that enters cover mode: blocks over answers, for recall. */
  cover: string;
  /** "Vyzkoušet se": the bar entry, reveal, the two answers, the counter ({n}/{total}). */
  recallStart: string;
  recallReveal: string;
  recallKnew: string;
  recallNotYet: string;
  recallProgress: string;
  /** Leaving a test early, running it again over the unknown ones, and the score ({known}/{total}). */
  recallEnd: string;
  recallRetry: string;
  recallScore: string;
```

In `src/hooks/ui/usePdfInkStrings.ts`, after `done: t('mobile.pdfInk.done'),`:

```ts
      cover: t('mobile.pdfInk.cover'),
      recallStart: t('mobile.pdfInk.recallStart'),
      recallReveal: t('mobile.pdfInk.recallReveal'),
      recallKnew: t('mobile.pdfInk.recallKnew'),
      recallNotYet: t('mobile.pdfInk.recallNotYet'),
      recallProgress: t('mobile.pdfInk.recallProgress'),
      recallEnd: t('mobile.pdfInk.recallEnd'),
      recallRetry: t('mobile.pdfInk.recallRetry'),
      recallScore: t('mobile.pdfInk.recallScore'),
```

`t` with no params returns the string with `{n}` intact (`src/i18n/translate.ts`: `if (!params) return result;`), so the placeholders reach Swift for `PdfInkStrings.fill`.

In `src/i18n/locales/cs.json`, inside `mobile.pdfInk`, change `"done": "Hotovo"` to `"done": "Hotovo",` and add:

```json
      "cover": "Zakrýt odpověď",
      "recallStart": "Vyzkoušet se",
      "recallReveal": "Ukázat",
      "recallKnew": "Znám",
      "recallNotYet": "Ještě ne",
      "recallProgress": "{n} z {total}",
      "recallEnd": "Ukončit",
      "recallRetry": "Zopakovat ty, co ještě neznám",
      "recallScore": "Znáš {known} z {total}"
```

In `src/i18n/locales/en.json`, in the same place:

```json
      "cover": "Cover an answer",
      "recallStart": "Test me",
      "recallReveal": "Show",
      "recallKnew": "I know it",
      "recallNotYet": "Not yet",
      "recallProgress": "{n} of {total}",
      "recallEnd": "End",
      "recallRetry": "Repeat the ones I don't know yet",
      "recallScore": "You know {known} of {total}"
```

In `src/mobile/__tests__/pdfInk.test.ts`, extend the strings fixture next to `done: 'do',`:

```ts
  cover: 'cv',
  recallStart: 'rs',
  recallReveal: 'rr',
  recallKnew: 'rk',
  recallNotYet: 'rn',
  recallProgress: 'rp',
  recallEnd: 're',
  recallRetry: 'rt',
  recallScore: 'sc',
```

- [ ] **Step 6: Write the parity guard**

Create `src/test/guards/inkCoversAreIpadOnly.test.ts`:

```ts
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

/**
 * Covers and "Vyzkoušet se" exist only in the iPad's native PencilKit reader.
 *
 * Not a split chosen per tree: the ink reader itself is iPad-only
 * (`PdfInkPlugin.isAvailable` is true only on an iPad with iPadOS 16+). The
 * iPhone, Android and the extension open PDFs in pdf.js, read-only, so there
 * is no annotated page to cover. Making, saving and testing covers is all
 * Swift under native/capacitor-pdf-ink; the JS side only hands the reader its
 * translated strings. Spec: docs/superpowers/specs/2026-10-03-ipad-recall-covers-design.md.
 *
 * If an ink reader ever reaches another platform, covers are part of it.
 */
const root = resolve(__dirname, '../../..');
const read = (p: string) => readFileSync(resolve(root, p), 'utf8');

const NATIVE = 'native/capacitor-pdf-ink/ios/Sources/PdfInkPlugin/';
/** Shared files that changed for covers, and carry only the reader's copy. */
const SHARED_STRING_FILES = [
  'src/mobile/pdfInk.ts',
  'src/hooks/ui/usePdfInkStrings.ts',
  'src/i18n/locales/en.json',
  'src/i18n/locales/cs.json',
];

describe('ink covers are iPad-native only', () => {
  it('the native reader keeps covers in the archive', () => {
    expect(read(`${NATIVE}CoverLayerView.swift`)).toContain('final class CoverLayerView');
    expect(read(`${NATIVE}InkArchive.swift`)).toContain('var coverCards: [Int: [PageCover]]');
  });

  it('covers never travel with an exported PDF', () => {
    // A shared PDF is the student's notes; a study aid baked in would hide
    // the answer from whoever receives it (decided 2026-09-07, kept 2026-10-03).
    expect(read(`${NATIVE}InkExport.swift`)).not.toMatch(/cover/i);
  });

  it('the reader is iPad-only, which is why no other tree has covers', () => {
    expect(read(`${NATIVE}PdfInkPlugin.swift`)).toContain(
      'UIDevice.current.userInterfaceIdiom == .pad'
    );
  });

  it.each(SHARED_STRING_FILES)('%s carries the reader’s cover strings and nothing else', (file) => {
    const text = read(file);
    expect(text).toMatch(/recallStart/);
    expect(text).not.toMatch(/PageCover|CoverLayerView/);
  });
});
```

`InkExport.swift` contains no "cover" today (checked 2026-10-03), so the assertion holds from the start and fails the day anyone wires covers into the export.

- [ ] **Step 7: Run the JS checks**

```bash
npx vitest run src/test/guards/inkCoversAreIpadOnly src/test/guards/inkPicturesAreIpadOnly src/mobile/__tests__/pdfInk; echo "exit $?"
npm run typecheck; echo "exit $?"
```

Expected: every test passes and both exits are 0. Also run any locale-key guard: `ls src/test/guards | grep -i key`, then run what it lists. If vitest times out under load, add `--no-file-parallelism --maxWorkers=1` (CLAUDE.md); a timeout is not a failure.

- [ ] **Step 8: Commit**

```bash
git add native/capacitor-pdf-ink/ios/Sources/PdfInkPlugin/PdfInkStrings.swift native/capacitor-pdf-ink/ios/Tests/PdfInkPluginTests/PdfInkStringsTests.swift src/mobile/pdfInk.ts src/hooks/ui/usePdfInkStrings.ts src/i18n/locales/cs.json src/i18n/locales/en.json src/mobile/__tests__/pdfInk.test.ts src/test/guards/inkCoversAreIpadOnly.test.ts
git commit -m "feat(pdf ink): copy for covers and Vyzkoušet se; covers are iPad-only, pinned

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 6: Covers in the reader

**Files:**
- Create: `native/capacitor-pdf-ink/ios/Sources/PdfInkPlugin/PdfInkViewController+Covers.swift`
- Modify: `native/capacitor-pdf-ink/ios/Sources/PdfInkPlugin/PdfInkViewController.swift` (stored properties and hooks only)
- Modify: `native/capacitor-pdf-ink/ios/Sources/PdfInkPlugin/PdfInkViewController+Pictures.swift`
- Modify: `native/capacitor-pdf-ink/ios/Sources/PdfInkPlugin/PdfInkViewController+PickUp.swift`
- Create: `native/capacitor-pdf-ink/ios/Tests/PdfInkPluginTests/ReaderTestHost.swift` (shared by this task's and Task 7's reader tests)
- Test: `native/capacitor-pdf-ink/ios/Tests/PdfInkPluginTests/ReaderCoverTests.swift`

**Interfaces:**
- Consumes: `PageCover`, `CoverLayerView`, `PageOverlayView.coverLayer`, `InkArchive.coverCards`, `PdfInkStrings.cover`.
- Produces for tests: `final class ReaderTestHost`, with `let strings: PdfInkStrings`, `func show(pages: Int) throws -> (PdfInkViewController, URL)`, `func open(_: PdfInkViewController, pages: Int, ink: URL) throws`, `static func tempInk() -> URL`, `static func picture() throws -> PictureIngest.Picture`, `func closeAll()`
- Produces on `PdfInkViewController`:
  - stored: `var covers: [Int: [PageCover]]`, `var revealedCovers: Set<String>`, `var makingCovers: Bool`, `lazy var doneCoveringItem: UIBarButtonItem`
  - from `+Covers`: `func beginCovering()`, `func endCovering(restoringPens: Bool = true)`, `func setCovers(_: [PageCover], onPage: Int)`, `func addCover(_: CGRect, onPage: Int)`, `func removeCover(_: String, onPage: Int)`, `func toggleCover(_: String, onPage: Int)`, `func configureCovers(of: PageOverlayView, page: Int)`, `var hasCovers: Bool`, `func refreshCoverLayers()`

- [ ] **Step 1: Write the shared test host and the failing tests**

Create `ReaderTestHost.swift`. It is the same `show` / `open` / `tempInk` / `picture` / `tearDown` that `ReaderPictureTests` keeps privately (lines 362–413 as of 2026-10-03), shared so the two new reader test files don't each copy it. `ReaderPictureTests` is left as it is.

```swift
import PDFKit
import UIKit
import XCTest

@testable import PdfInkPlugin

/**
 * A reader in a real key window, the way the space shows one, for tests that
 * drive it. Call `closeAll()` from tearDown: a reader left open takes the
 * responder back (#485's re-assert) from whatever test runs next, which broke
 * `ToolPickerResponderTests` in #492.
 */
@available(iOS 16.0, *)
final class ReaderTestHost {
    let strings = PdfInkStrings(nil)
    private var windows: [UIWindow] = []
    private var readers: [PdfInkViewController] = []

    func show(pages: Int) throws -> (PdfInkViewController, URL) {
        let reader = PdfInkViewController(strings: strings)
        let window = UIWindow(frame: CGRect(x: 0, y: 0, width: 820, height: 1000))
        window.rootViewController = UINavigationController(rootViewController: reader)
        window.makeKeyAndVisible()
        window.layoutIfNeeded()
        windows.append(window)
        readers.append(reader)
        let ink = Self.tempInk()
        try open(reader, pages: pages, ink: ink)
        return (reader, ink)
    }

    /// Opens a blank `pages`-page PDF titled "t" with its ink at `ink`. Leaving
    /// the previous file saves it, as a switch in the sidebar does.
    func open(_ reader: PdfInkViewController, pages: Int, ink: URL) throws {
        let size = CGSize(width: 400, height: 500)
        let data = UIGraphicsPDFRenderer(bounds: CGRect(origin: .zero, size: size)).pdfData { ctx in
            for _ in 0..<pages {
                ctx.beginPage()
                UIColor.white.setFill()
                ctx.cgContext.fill(CGRect(origin: .zero, size: size))
            }
        }
        XCTAssertTrue(
            reader.load(document: try XCTUnwrap(PDFDocument(data: data)), inkURL: ink, title: "t"))
        reader.view.layoutIfNeeded()
    }

    static func tempInk() -> URL {
        FileManager.default.temporaryDirectory.appendingPathComponent("\(UUID().uuidString).ink")
    }

    static func picture() throws -> PictureIngest.Picture {
        let format = UIGraphicsImageRendererFormat()
        format.scale = 1
        let png = UIGraphicsImageRenderer(size: CGSize(width: 80, height: 60), format: format)
            .pngData { ctx in
                UIColor.orange.setFill()
                ctx.fill(CGRect(x: 0, y: 0, width: 80, height: 60))
            }
        return try XCTUnwrap(PictureIngest.picture(from: png))
    }

    func closeAll() {
        for reader in readers { reader.willClose() }
        readers = []
        for window in windows { window.isHidden = true }
        windows = []
    }
}
```

Before relying on `open`, read `ReaderPictureTests.swift` lines 389–400. If its `open` does more than the code above, mirror it here.

Create `ReaderCoverTests.swift`:

```swift
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

    func testMakingCoversTakesThePensAndTheBarUntilDone() throws {
        let (reader, _) = try host.show(pages: 1)

        reader.beginCovering()
        reader.restoreToolPicker()  // #485's re-assert must leave the mode alone

        XCTAssertTrue(reader.makingCovers)
        XCTAssertEqual(reader.navigationItem.rightBarButtonItems, [reader.doneCoveringItem])

        reader.endCovering()
        XCTAssertFalse(reader.makingCovers)
        XCTAssertEqual(reader.navigationItem.rightBarButtonItems, reader.fileToolItems)
    }

    func testCoveringAndArrangingPicturesAreExclusive() throws {
        let (reader, _) = try host.show(pages: 1)

        reader.beginArrangingPictures()
        reader.beginCovering()
        XCTAssertFalse(reader.arrangingPictures)
        XCTAssertTrue(reader.makingCovers)

        reader.beginArrangingPictures()
        XCTAssertFalse(reader.makingCovers)
        XCTAssertTrue(reader.arrangingPictures)
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
```

- [ ] **Step 2: Compile to verify it fails**

Run build-for-testing. Expected: `value of type 'PdfInkViewController' has no member 'addCover'` (and `covers`, `beginCovering`, …).

- [ ] **Step 3: Add stored state to `PdfInkViewController.swift`**

After `var pictures: [Int: [PagePicture]] = [:]`:

```swift
    /// Blocks over answers, per page, for practising recall (`+Covers`).
    var covers: [Int: [PageCover]] = [:]
    /// Which covers are open right now. Never saved: a file reopens with them shut.
    var revealedCovers: Set<String> = []
    /// Cover mode: the finger makes blocks instead of scrolling or drawing.
    var makingCovers = false
    /// Ends cover mode. Plain and tinted for the same reason as `doneArrangingItem`.
    private(set) lazy var doneCoveringItem: UIBarButtonItem = {
        let item = UIBarButtonItem(
            title: strings.done, style: .plain, target: self,
            action: #selector(doneCoveringTapped))
        item.tintColor = tint
        return item
    }()
```

Make these hook edits:

1. **`load(...)`**, inside `if let archive = InkStore.load(from: inkURL) {`, after `pictures = archive.pictures`:
   ```swift
               covers = archive.coverCards
   ```
2. **`leaveCurrentFile(...)`**, after `endPicking()`:
   ```swift
           endCovering(restoringPens: false)
   ```
   and after `pictures = [:]`:
   ```swift
           covers = [:]
           revealedCovers = []
   ```
3. **`addBlankPage()`**, after `pictures = InkPages.shifted(pictures, insertingAt: at)`:
   ```swift
           covers = InkPages.shifted(covers, insertingAt: at)
   ```
4. **`removeAddedPage(at:)`**, after `pictures = InkPages.shifted(pictures, removingAt: index)`:
   ```swift
           covers = InkPages.shifted(covers, removingAt: index)
   ```
5. **`restoreToolPicker()`**, in the guard, change `!arrangingPictures, !pickingPicture` to:
   ```swift
               !arrangingPictures, !pickingPicture, !makingCovers
   ```
6. **`pdfView(_:overlayViewFor:)`**, after `configurePictures(of: overlay, page: index)`:
   ```swift
           configureCovers(of: overlay, page: index)
   ```
7. **`currentArchive()`**: pass covers into the `InkArchive(...)` call:
   ```swift
           return InkArchive(
               pageCount: document.pageCount, pages: pages, insertedPages: insertedPages,
               pictures: pictures.filter { !$0.value.isEmpty },
               coverCards: covers.filter { !$0.value.isEmpty })
   ```
8. **`persistNow()`**: the empty check becomes:
   ```swift
               if archive.pages.isEmpty && archive.insertedPages.isEmpty && archive.pictures.isEmpty
                   && archive.coverCards.isEmpty
               {
   ```

- [ ] **Step 4: Create `PdfInkViewController+Covers.swift`**

```swift
import UIKit

/**
 * Covers: blocks over an answer, so a lecture can be read back before the
 * answer is (spec 2026-10-03-ipad-recall-covers-design.md).
 *
 * Making them is a visible mode, entered from `+` like arranging pictures:
 * the pens go, the bar is one Done, and the finger drags out blocks. Reading
 * them is not a mode: a tap opens or shuts a cover whenever the file is open.
 * `setCovers` is the only writer, and it shows and saves at once.
 */
@available(iOS 16.0, *)
extension PdfInkViewController {
    var hasCovers: Bool { covers.values.contains { !$0.isEmpty } }

    func beginCovering() {
        endArrangingPictures(restoringPens: false)
        makingCovers = true
        putPensAway()
        navigationItem.rightBarButtonItems = [doneCoveringItem]
        refreshCoverLayers()
    }

    /// The pens come back on every exit; `restoringPens` only decides whether
    /// the page takes the responder now (not when a file is closing).
    func endCovering(restoringPens: Bool = true) {
        guard makingCovers else { return }
        makingCovers = false
        navigationItem.rightBarButtonItems = fileToolItems
        refreshCoverLayers()
        if restoringPens { showToolPicker() } else { setPagePens(visible: true) }
    }

    @objc func doneCoveringTapped() { endCovering() }

    func setCovers(_ list: [PageCover], onPage index: Int) {
        guard list != (covers[index] ?? []) else { return }
        covers[index] = list.isEmpty ? nil : list
        overlays[index]?.coverLayer.covers = list
        persistNow()
    }

    func addCover(_ rect: CGRect, onPage index: Int) {
        setCovers((covers[index] ?? []) + [PageCover(rect: rect)], onPage: index)
    }

    func removeCover(_ id: String, onPage index: Int) {
        revealedCovers.remove(id)
        overlays[index]?.coverLayer.revealed = revealedCovers
        setCovers((covers[index] ?? []).filter { $0.id != id }, onPage: index)
    }

    func toggleCover(_ id: String, onPage index: Int) {
        if revealedCovers.contains(id) {
            revealedCovers.remove(id)
        } else {
            revealedCovers.insert(id)
        }
        overlays[index]?.coverLayer.revealed = revealedCovers
    }

    /// Called for every overlay PDFKit asks for, so a page that scrolls in
    /// mid-mode behaves like the rest.
    func configureCovers(of overlay: PageOverlayView, page index: Int) {
        let layer = overlay.coverLayer
        layer.covers = covers[index] ?? []
        layer.currentColor = tint ?? .tintColor
        layer.onCreate = { [weak self] rect in self?.addCover(rect, onPage: index) }
        layer.onRemove = { [weak self] id in self?.removeCover(id, onPage: index) }
        layer.onToggle = { [weak self] id in self?.toggleCover(id, onPage: index) }
        applyCoverMode(to: overlay)
    }

    func refreshCoverLayers() {
        for overlay in overlays.values { applyCoverMode(to: overlay) }
    }

    private func applyCoverMode(to overlay: PageOverlayView) {
        overlay.coverLayer.revealed = revealedCovers
        overlay.coverLayer.isMakingCovers = makingCovers
        // Arranging moves pictures with the finger; a cover on top would catch it.
        overlay.coverLayer.isUserInteractionEnabled = !arrangingPictures
    }
}
```

- [ ] **Step 5: Hook covers into pictures and pick-up**

In `PdfInkViewController+Pictures.swift`:

1. `putPensAway()`: remove `private`, so it reads `func putPensAway() {`. Covers use it.
2. `beginArrangingPictures(selecting:)`: as its first line, add `endCovering(restoringPens: false)`.
3. `applyPictureMode(to:page:)`: add a last line, `overlay.coverLayer.isUserInteractionEnabled = !arrangingPictures`.
4. `addMenuItems()`: after `var sections = [section([page]), section(picture)]`, add:
   ```swift
           sections.append(
               section([
                   UIAction(title: strings.cover, image: UIImage(systemName: "square.dashed")) {
                       [weak self] _ in self?.beginCovering()
                   }
               ]))
   ```
   Update the method's doc comment: four sections with dividers: a page, a picture, covering an answer, editing the pictures.

In `PdfInkViewController+PickUp.swift`, `pictureToPickUp(at:onPage:)` becomes:

```swift
    private func pictureToPickUp(at point: CGPoint, onPage index: Int) -> PagePicture? {
        guard !arrangingPictures, !makingCovers, !fingerDraws() else { return nil }
        // A cover is on top: a tap on one opens the cover (CoverLayerView), and
        // this recognizer, on the overlay, would otherwise fire for it too.
        guard PageCovers.cover(at: point, in: covers[index] ?? []) == nil else { return nil }
        return PagePictures.topmost(at: point, in: pictures[index] ?? [])
    }
```

- [ ] **Step 6: Compile to verify it builds**

Run build-for-testing. Expected: `exit 0`. If `putPensAway` or `fingerDraws` access levels clash, make the minimal change (`private` → internal); don't restructure.

- [ ] **Step 7: Commit**

```bash
git add native/capacitor-pdf-ink/ios/Sources/PdfInkPlugin/PdfInkViewController.swift native/capacitor-pdf-ink/ios/Sources/PdfInkPlugin/PdfInkViewController+Covers.swift native/capacitor-pdf-ink/ios/Sources/PdfInkPlugin/PdfInkViewController+Pictures.swift native/capacitor-pdf-ink/ios/Sources/PdfInkPlugin/PdfInkViewController+PickUp.swift native/capacitor-pdf-ink/ios/Tests/PdfInkPluginTests/ReaderCoverTests.swift
git commit -m "feat(pdf ink): cover an answer, from the + menu

Restores the cover tool withdrawn in aec6f7b6f onto today's reader: a mode
like arranging pictures, covers above pictures, shifted with added pages,
saved as coverCards, always reopened shut.

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

- [ ] **Step 8: Device checkpoint, before any of the test is built**

The withdrawn tool failed exactly here, on a real iPad. So prove covers on the device before Task 7 builds on them.

1. **Before.** Before installing, screenshot the reader as it is on the iPad now, with the `+` menu open and the bar showing: `~/.local/bin/pymobiledevice3 developer dvt screenshot <scratchpad>/before-plus-menu.png`. Say which build that is: whatever was last installed, possibly another worktree's (memory: stale worktree builds).
2. **Build and install** the release build exactly as in Task 8, Step 6.
3. **Tap script.** Send Dominik this script and wait for his answers:
   1. Open any subject PDF, then `+` → **Zakrýt odpověď**. Do the pens go and the bar become one **Hotovo**?
   2. With one finger, drag a block over some text. Does a grey block appear, while the page stays still?
   3. Drag with two fingers. Does the page scroll?
   4. Tap **Hotovo**, then tap the block. Does it open to a dashed outline, and does a second tap shut it?
   5. Start a scroll with your finger on a block. Does the page scroll without the block opening?
   6. Write with the Pencil right next to a block. Does the ink go down?
   7. With the sidebar open (narrowest bar), is every bar item visible?
4. **After.** Take screenshots after steps 2 and 4.
5. **Send** the before and after PNGs with `SendUserFile` (memory: verifying-ui-work).

**If step 2 fails** (no block appears, or the page scrolls), stop. Use superpowers:systematic-debugging, and report before starting Task 7.

---

### Task 7: "Vyzkoušet se" in the reader

**Files:**
- Create: `native/capacitor-pdf-ink/ios/Sources/PdfInkPlugin/PdfInkViewController+Recall.swift`
- Modify: `native/capacitor-pdf-ink/ios/Sources/PdfInkPlugin/PdfInkViewController.swift` (stored properties, bar items, hooks)
- Modify: `native/capacitor-pdf-ink/ios/Sources/PdfInkPlugin/PdfInkViewController+Covers.swift` (`toggleCover`, `setCovers`, `endCovering` hooks)
- Modify: `native/capacitor-pdf-ink/ios/Tests/PdfInkPluginTests/ReaderScaleTests.swift` (`testTheBarCarriesTheFiveFileToolsAndNothingElse`)
- Test: `native/capacitor-pdf-ink/ios/Tests/PdfInkPluginTests/ReaderRecallTests.swift`

**Interfaces:**
- Consumes: `RecallSession`, `RecallStep` (Task 3); `covers`, `revealedCovers`, `setCovers`, `hasCovers`, `refreshCoverLayers` (Task 6); `PdfInkStrings.recall*`, `PdfInkStrings.fill` (Task 5).
- Produces on `PdfInkViewController`:
  - stored: `var recall: RecallSession?`, `var now: () -> Date`, `lazy var recallItem`, `revealItem`, `knewItem`, `notYetItem`, `endRecallItem: UIBarButtonItem`
  - from `+Recall`: `func startRecall(only: Set<String>? = nil) -> Bool`, `func revealCurrentCover()`, `func answerRecall(knew: Bool)`, `func endRecall(restoringPens: Bool = true)`, `func updateRecallItem()`

- [ ] **Step 1: Write the failing tests**

Create `ReaderRecallTests.swift`, using `ReaderTestHost` from Task 6:

```swift
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

    func testSwitchingFileEndsTheTest() throws {
        let (reader, _) = try host.show(pages: 1)
        reader.addCover(rect(y: 10), onPage: 0)
        XCTAssertTrue(reader.startRecall())

        try host.open(reader, pages: 1, ink: ReaderTestHost.tempInk())

        XCTAssertNil(reader.recall)
        XCTAssertEqual(reader.title, "t")
    }

}
```

In `ReaderScaleTests.swift`, rename `testTheBarCarriesTheFiveFileToolsAndNothingElse` to `testTheBarCarriesTheFileToolsAndTheTestEntryAndNothingElse` and change the expected labels to:

```swift
            [strings.export, strings.add, strings.focus, strings.search, strings.pages, strings.recallStart],
```

Add one line to its comment: "The test entry sits nearest the title and is hidden, not removed, while the file has no covers."

- [ ] **Step 2: Compile to verify it fails**

Run build-for-testing. Expected: `value of type 'PdfInkViewController' has no member 'recallItem'` (and `startRecall`, …).

- [ ] **Step 3: Add stored state and bar items to `PdfInkViewController.swift`**

After the cover properties from Task 6:

```swift
    /// The test running over this file's covers, if one is (`+Recall`).
    var recall: RecallSession?
    /// The file's own title while the bar shows the test's "3 z 10".
    var titleBeforeRecall: String?
    /// When an answer is given. A seam for tests.
    var now: () -> Date = Date.init
    /// "Vyzkoušet se". Hidden while the file has no covers.
    private(set) lazy var recallItem = UIBarButtonItem(
        image: UIImage(systemName: "checklist"), style: .plain, target: self,
        action: #selector(recallTapped))
    private(set) lazy var revealItem = makeRecallItem(strings.recallReveal, #selector(revealTapped))
    private(set) lazy var knewItem = makeRecallItem(strings.recallKnew, #selector(knewTapped))
    private(set) lazy var notYetItem = makeRecallItem(strings.recallNotYet, #selector(notYetTapped))
    private(set) lazy var endRecallItem = makeRecallItem(strings.recallEnd, #selector(endRecallTapped))
```

Change `fileToolItems` to add the entry nearest the title (the end of the right-to-left list):

```swift
    var fileToolItems: [UIBarButtonItem] {
        [shareItem, addItem, focusItem, searchItem, pagesItem, recallItem]
    }
```

Update the comment above it from "The five file tools" to "The five file tools and the test entry".

In `viewDidLoad()`, after `exitItem.accessibilityLabel = strings.close`:

```swift
        recallItem.accessibilityLabel = strings.recallStart
        recallItem.tintColor = tint
```

In `setBarItems(enabled:)`, at the end:

```swift
        recallItem.isEnabled = enabled
        updateRecallItem()
```

In `leaveCurrentFile(...)`, before `endCovering(restoringPens: false)`:

```swift
        endRecall(restoringPens: false)
```

- [ ] **Step 4: Create `PdfInkViewController+Recall.swift`**

```swift
import PDFKit
import UIKit

/**
 * "Vyzkoušet se": the file's covers one at a time, in reading order. Tap the
 * cover (or Ukázat) to look, then Znám or Ještě ne. Each answer is saved at
 * once as a `CoverReview` on that cover; nothing else about the test is kept.
 *
 * Not a mode for the Pencil. It still draws, because writing the answer before
 * looking is the point. The controls are in the bar, where the floating tool
 * picker can never sit over them. Ukončit is trailing, so the leading group
 * (the exit beside the split view's toggle, see `exitItem`) is never touched.
 */
@available(iOS 16.0, *)
extension PdfInkViewController {
    func makeRecallItem(_ title: String, _ action: Selector) -> UIBarButtonItem {
        let item = UIBarButtonItem(title: title, style: .plain, target: self, action: action)
        item.tintColor = tint
        return item
    }

    func updateRecallItem() {
        recallItem.isHidden = document == nil || !hasCovers
    }

    @objc func recallTapped() { startRecall() }
    @objc func revealTapped() { revealCurrentCover() }
    @objc func knewTapped() { answerRecall(knew: true) }
    @objc func notYetTapped() { answerRecall(knew: false) }
    @objc func endRecallTapped() { endRecall() }

    /// Starts over the file's covers, or over just `ids` (the retry). False
    /// when there is nothing to ask.
    @discardableResult
    func startRecall(only ids: Set<String>? = nil) -> Bool {
        guard let session = RecallSession(covers: covers, only: ids) else { return false }
        endCovering(restoringPens: false)
        endArrangingPictures(restoringPens: false)
        recall = session
        titleBeforeRecall = titleBeforeRecall ?? title
        revealedCovers = []
        refreshCoverLayers()
        showToolPicker()
        showRecallStep()
        return true
    }

    func showRecallStep() {
        guard let session = recall else { return }
        guard let step = session.current else { return finishRecall() }
        title = PdfInkStrings.fill(
            strings.recallProgress, ["n": session.number, "total": session.total])
        navigationItem.rightBarButtonItems = [endRecallItem, revealItem]
        for (index, overlay) in overlays {
            overlay.coverLayer.currentID = index == step.page ? step.id : nil
        }
        scroll(to: step)
    }

    func revealCurrentCover() {
        guard let step = recall?.current else { return }
        revealedCovers.insert(step.id)
        overlays[step.page]?.coverLayer.revealed = revealedCovers
        currentCoverOpened()
    }

    /// Called from `toggleCover` too: tapping the cover is the same as Ukázat.
    func currentCoverOpened() {
        navigationItem.rightBarButtonItems = [endRecallItem, knewItem, notYetItem]
    }

    func answerRecall(knew: Bool) {
        guard var session = recall, let answered = session.answer(knew: knew, at: now()) else {
            return
        }
        recall = session
        let step = answered.step
        if var list = covers[step.page], let i = list.firstIndex(where: { $0.id == step.id }) {
            list[i].reviews.append(answered.review)
            setCovers(list, onPage: step.page)
        }
        showRecallStep()
    }

    /// The score, and the retry when anything was Ještě ne.
    private func finishRecall() {
        guard let session = recall else { return }
        navigationItem.rightBarButtonItems = [endRecallItem]
        let alert = UIAlertController(
            title: PdfInkStrings.fill(
                strings.recallScore, ["known": session.knownCount, "total": session.total]),
            message: nil, preferredStyle: .alert)
        let notYet = session.notYetIDs
        if !notYet.isEmpty {
            alert.addAction(
                UIAlertAction(title: strings.recallRetry, style: .default) { [weak self] _ in
                    self?.endRecall(restoringPens: false)
                    self?.startRecall(only: notYet)
                })
        }
        alert.addAction(
            UIAlertAction(title: strings.done, style: .cancel) { [weak self] _ in
                self?.endRecall()
            })
        if let tint { alert.view.tintColor = tint }
        present(alert, animated: true)
    }

    /// Every way out: Ukončit, Hotovo, a file switch, closing. Answers already
    /// given are saved; every cover is shut again.
    func endRecall(restoringPens: Bool = true) {
        guard recall != nil else { return }
        recall = nil
        if let titleBeforeRecall { title = titleBeforeRecall }
        titleBeforeRecall = nil
        revealedCovers = []
        for overlay in overlays.values { overlay.coverLayer.currentID = nil }
        refreshCoverLayers()
        navigationItem.rightBarButtonItems = fileToolItems
        updateRecallItem()
        if restoringPens { showToolPicker() }
    }

    /// The cover's page first, then, once PDFKit has laid that page's overlay
    /// out, the cover itself with some room around it. Converting through the
    /// overlay lets PDFKit handle rotation and crop boxes.
    private func scroll(to step: RecallStep) {
        guard let page = document?.page(at: step.page) else { return }
        pdfView.go(to: page)
        DispatchQueue.main.async { [weak self] in
            guard let self, let overlay = self.overlays[step.page],
                let cover = self.covers[step.page]?.first(where: { $0.id == step.id })
            else { return }
            let inView = overlay.convert(cover.rect.insetBy(dx: -48, dy: -48), to: self.pdfView)
            self.pdfView.go(to: self.pdfView.convert(inView, to: page), on: page)
        }
    }
}
```

- [ ] **Step 5: Hook the test into covers**

In `PdfInkViewController+Covers.swift`:

1. `toggleCover(_:onPage:)`: at the end, add:
   ```swift
           if recall?.current?.id == id, revealedCovers.contains(id) { currentCoverOpened() }
   ```
2. `setCovers(_:onPage:)`: before `persistNow()`, add `updateRecallItem()`.
3. `endCovering(restoringPens:)`: after `navigationItem.rightBarButtonItems = fileToolItems`, add `updateRecallItem()`.

- [ ] **Step 6: Compile to verify it builds**

Run build-for-testing. Expected: `exit 0`.

Three hazards to check if it doesn't build or a later run fails:
- `title` during a file load: `load` calls `leaveCurrentFile` (which calls `endRecall` and restores the old title) before it sets the new one, so the order is already right.
- In `setBarItems(enabled: false)`, `updateRecallItem()` sees `document == nil` only after `clear()` set it. `clear()` calls `leaveCurrentFile` first, then sets `document = nil`, then calls `setBarItems`. So this is fine too.
- `isHidden` on `UIBarButtonItem` needs iOS 16. The class is already `@available(iOS 16.0, *)`, and `pagesItem.isHidden` is used the same way.

- [ ] **Step 7: Commit**

```bash
git add native/capacitor-pdf-ink/ios/Sources/PdfInkPlugin/PdfInkViewController.swift native/capacitor-pdf-ink/ios/Sources/PdfInkPlugin/PdfInkViewController+Recall.swift native/capacitor-pdf-ink/ios/Sources/PdfInkPlugin/PdfInkViewController+Covers.swift native/capacitor-pdf-ink/ios/Tests/PdfInkPluginTests/ReaderRecallTests.swift native/capacitor-pdf-ink/ios/Tests/PdfInkPluginTests/ReaderScaleTests.swift
git commit -m "feat(pdf ink): Vyzkoušet se — step through a lecture's covers, keep Znám / Ještě ne

Reading order, reveal by tap or Ukázat, an answer saved per cover, the score
with a retry over the ones not known yet. The Pencil still draws.

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 8: Docs, the one test run, and the device

**Files:**
- Modify: `docs/superpowers/specs/2026-09-06-ipad-pdf-ink-design.md` (append an addendum)
- Modify: `docs/superpowers/specs/2026-09-06-ipad-pdf-ink-verification-checklist.md`
- Modify: `native/capacitor-pdf-ink/README.md`

- [ ] **Step 1: Addendum to the original reader spec**

Append to `2026-09-06-ipad-pdf-ink-design.md`:

```markdown
## Addendum 2026-10-03: covers are back, with "Vyzkoušet se"

The cover tool withdrawn on 2026-09-07 (above) returns, entered from `+` like
arranging pictures, with ids and an answer history (`coverCards`), and a
step-through self-test. Design: `2026-10-03-ipad-recall-covers-design.md`. The
WITHDRAWN addendum above stays as the record of why archive version 3 exists.
```

- [ ] **Step 2: Checklist items**

In `2026-09-06-ipad-pdf-ink-verification-checklist.md`, append after the highest-numbered item, continuing the numbering (N = the last number + 1):

```markdown
N.   [ ] `+` → Zakrýt odpověď: the pens go and the bar is one Hotovo. Drag a block over an
        answer, Hotovo. Tap the block → the answer shows with a dashed outline; tap again →
        shut. Close the file and reopen → the block is there, shut.
N+1. [ ] In cover mode, drag a small block on top of a big one → a new block, not a deletion.
        Tap a block in cover mode → it goes.
N+2. [ ] A cover over a picture: a finger tap opens the cover and does not pick the picture up.
N+3. [ ] Add a page before a covered page → the cover moves with its page.
N+4. [ ] Share with notes on a file with covers → the PDF shows the answers.
N+5. [ ] Vyzkoušet se (bar, beside the page counter; absent on a file with no covers) → the
        first cover in reading order is outlined and on screen; the title reads "1 z N".
        Ukázat → Znám / Ještě ne. Answer every cover → "Znáš X z N". Zopakovat → only the
        Ještě ne ones.
N+6. [ ] During a test, write with the Pencil beside a cover → the ink stays.
N+7. [ ] Ukončit halfway → covers shut, the bar is back to normal. Close and reopen → shut.
```

- [ ] **Step 3: Fix the plugin README**

In `native/capacitor-pdf-ink/README.md`, replace the `InkArchive.swift` bullet with:

```markdown
- `ios/Sources/PdfInkPlugin/InkArchive.swift` — the ink file format, a binary plist at
  version 3: `{version, pageCount, pages: [pageIndex: PKDrawing data], insertedPages,
  pictures: [pageIndex: [PagePicture]], coverCards: [pageIndex: [PageCover]]}`. New keys are
  additive and never bump the version (see the file's header). Foundation only.
```

Then, after the `PdfInkPlugin.swift` bullet, add:

```markdown
- `PageCover.swift`, `PageCovers.swift`, `CoverLayerView.swift`,
  `PdfInkViewController+Covers.swift` — covers over an answer.
- `RecallSession.swift`, `PdfInkViewController+Recall.swift` — "Vyzkoušet se".
- The rest of the reader: `PdfInkSpace.swift` (split view + file list), the
  `PdfInkViewController+*.swift` extensions, `InkPages.swift`, `InkExport.swift`, pictures
  (`PagePictures`, `PictureLayerView`, `PictureIngest`).
```

- [ ] **Step 4: Commit the docs**

```bash
git add docs/superpowers/specs/2026-09-06-ipad-pdf-ink-design.md docs/superpowers/specs/2026-09-06-ipad-pdf-ink-verification-checklist.md native/capacitor-pdf-ink/README.md
git commit -m "docs(pdf ink): covers and Vyzkoušet se in the reader spec, checklist and README

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

- [ ] **Step 5: Ask, then run the Swift suite once**

Ask Dominik: "The Swift tests need one simulator boot (`xcodebuild test`), about N minutes. OK to run now?" Only on a yes:

```bash
cd native/capacitor-pdf-ink && xcrun simctl list devices available | grep -i ipad | head -3
xcodebuild test -scheme ReisCapacitorPdfInk -destination 'platform=iOS Simulator,name=<an iPad from the list>' 2>&1 | grep -E "Test Case .* (passed|failed)|error:|Executed" | tail -60; echo "exit ${pipestatus[1]}"
```

Expected: `Executed N tests, with 0 failures` (it was 123 tests at #492, plus the new ones) and `exit 0`. Read the `Executed` line itself: truncated output is not evidence. A failure in `ToolPickerResponderTests` usually means a new reader test forgot `willClose()` in `tearDown`.

If he says no, report that the tests compile but have not been run, and continue to the device.

- [ ] **Step 6: Release build on the cabled iPad**

Follow memory `ipad-device.md`:
1. Check `test -L node_modules` (a symlink means the install is shared; don't install through it).
2. `npm install` if this worktree's plugins aren't linked.
3. `npm run cap:sync`.
4. Run `xcodebuild` with `-project ios/App/App.xcodeproj -scheme App -configuration Release -destination id=00008020-000A7C21368A402E DEVELOPMENT_TEAM=RG38V3SV8X -allowProvisioningUpdates`.
5. Install and launch with `xcrun devicectl device install app --device AAB487DD-1610-525F-A8E5-3E29666A8B90 <App.app>`, then `xcrun devicectl device process launch --device AAB487DD-1610-525F-A8E5-3E29666A8B90 --terminate-existing cz.reis.app`.

Error 7 on launch means the iPad is locked.

- [ ] **Step 7: Hand Dominik the tap script and collect evidence**

Taps cannot be injected, so send him checklist items N to N+7 as a numbered script. Take screenshots with `~/.local/bin/pymobiledevice3 developer dvt screenshot <scratchpad>/covers-<k>.png` at: a cover shut; a cover open; "1 z N" with the outline; the score alert. Send the PNGs with `SendUserFile` before claiming anything works.

- [ ] **Step 8: Push and open the PR**

Only once Dominik confirms the device run:

```bash
git push -u personal claude/ipad-recall-covers
gh pr create --base test --title "feat(ipad): cover an answer and Vyzkoušet se in the ink reader" --body "<summary + test plan + spec link>"
```

Push identity, Auto-fix and merge rules are in memory: `github-push-identity.md` and `always-enable-auto-fix.md`.
