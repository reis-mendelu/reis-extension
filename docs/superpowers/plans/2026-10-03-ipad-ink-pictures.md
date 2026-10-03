# Pictures on the page (iPad ink reader) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** A student can put a photo (library or camera) on any page of the iPad
PencilKit reader, move/resize/delete it in a visible arranging mode, draw over
it, keep it with the ink, and find it in the shared PDF.

**Architecture:** Pure geometry (`PagePictures`) and ingest (`PictureIngest`)
units; a `PictureLayerView` inside `PageOverlayView` under the canvas that only
renders and reports gestures; the controller owns `pictures[pageIndex]` like it
owns `drawings`, in a `+Pictures` extension. The archive gains an additive
`pictures` key (version stays 3); the export draws page → pictures → ink.

**Tech Stack:** Swift, UIKit, PDFKit, PencilKit, PhotosUI (`PHPickerViewController`),
ImageIO; TypeScript/vitest for the JS strings and the guard.

**Spec:** `docs/superpowers/specs/2026-09-06-ipad-pdf-ink-design.md`, section
"Addendum 2026-10-03: pictures on the page".

## Global Constraints

- iOS 16+ for everything the reader uses (`@available(iOS 16.0, *)` on any class/test touching `PdfInkViewController`).
- Archive `InkArchive.currentVersion` stays **3**; `pictures` read with `decodeIfPresent`.
- Ingest: long edge ≤ **2048 px**, JPEG quality **0.8**, no metadata, EXIF orientation applied, transparent pixels flattened onto white.
- Minimum picture side **24 pt**; a new picture is at most **half** the page wide and **half** tall, never upscaled past its pixel size.
- Pictures are drawn UNDER the ink, in the reader and in the export.
- The `+` bar item is a menu: Add a page · Photo library · Take photo (only if a camera exists) · Move pictures (only if the file has a picture). The bar stays five items; arranging replaces them with one Done.
- `restoreToolPicker` must return early while arranging; the #485 re-assert logic is otherwise unchanged.
- No `PDFAnnotation`, no change to the teacher's PDF, no photo-library permission, never save a capture to the library.
- Swift tests run by hand: `cd native/capacitor-pdf-ink && xcodebuild test -scheme ReisCapacitorPdfInk -destination 'platform=iOS Simulator,id=32B6CB7C-756A-4803-AC49-292E1CA8D495' -derivedDataPath <scratchpad>/dd` — check for `** TEST SUCCEEDED **` and the executed count, never the pipe's exit code.

## File map

| File | Responsibility |
| --- | --- |
| Create `ios/Sources/PdfInkPlugin/PagePictures.swift` | `PagePicture` model + pure geometry |
| Create `ios/Sources/PdfInkPlugin/PictureIngest.swift` | photo bytes / camera image → stored JPEG |
| Create `ios/Sources/PdfInkPlugin/PictureLayerView.swift` | renders a page's pictures, selection chrome, gestures |
| Create `ios/Sources/PdfInkPlugin/PdfInkViewController+Pictures.swift` | menu, pickers, insert, arranging mode, undo |
| Modify `InkArchive.swift`, `InkExport.swift`, `PageOverlayView.swift`, `PdfInkStrings.swift`, `PdfInkViewController.swift` | wiring |
| Tests: `PagePicturesTests`, `PictureIngestTests`, `PictureLayerTests`, `ReaderPictureTests` (new); `InkArchiveTests`, `InkExportTests`, `PageOverlayTests`, `ReaderScaleTests` (extend) | |
| JS: `src/mobile/pdfInk.ts`, `src/hooks/ui/usePdfInkStrings.ts`, locales, `src/mobile/__tests__/pdfInk.test.ts` | new strings |
| Privacy: `ios/App/App/Info.plist`, `docs/privacy-policy-app.md`, `src/test/guards/iosCameraUsage.test.ts` | camera reason |
| Guard: `src/test/guards/inkPicturesAreIpadOnly.test.ts` | pin the tree decision |

All Swift paths below are relative to `native/capacitor-pdf-ink/`.

---

### Task 1: `PagePicture` and its geometry

**Files:**
- Create: `ios/Sources/PdfInkPlugin/PagePictures.swift`
- Test: `ios/Tests/PdfInkPluginTests/PagePicturesTests.swift`

**Interfaces — Produces:**
- `struct PagePicture: Codable, Equatable { var id: String; var frame: CGRect; var jpeg: Data }`
- `enum PictureCorner: CaseIterable { case topLeft, topRight, bottomLeft, bottomRight }`
- `enum PagePictures` with `minimumSide: CGFloat = 24`,
  `initialFrame(imageSize:pageSize:around:) -> CGRect`,
  `clamped(_:in:) -> CGRect`, `moved(_:by:in:) -> CGRect` (by: `CGPoint` translation),
  `resized(_:dragging:to:in:) -> CGRect`, `scaled(_:by:in:) -> CGRect`,
  `point(of:in:) -> CGPoint`, `topmost(at:in:) -> PagePicture?`

- [ ] **Step 1: Write the failing tests**

```swift
import XCTest
@testable import PdfInkPlugin

final class PagePicturesTests: XCTestCase {
    private let page = CGSize(width: 600, height: 800)

    func testANewPictureIsAtMostHalfThePageAndKeepsItsShape() {
        let frame = PagePictures.initialFrame(
            imageSize: CGSize(width: 2048, height: 1536), pageSize: page,
            around: CGPoint(x: 300, y: 400))
        XCTAssertEqual(frame.width, 300, accuracy: 0.01)
        XCTAssertEqual(frame.height, 225, accuracy: 0.01)
        XCTAssertEqual(frame.midX, 300, accuracy: 0.01)
        XCTAssertEqual(frame.midY, 400, accuracy: 0.01)
    }

    func testASmallPictureIsNotBlownUp() {
        let frame = PagePictures.initialFrame(
            imageSize: CGSize(width: 120, height: 80), pageSize: page, around: CGPoint(x: 300, y: 400))
        XCTAssertEqual(frame.size, CGSize(width: 120, height: 80))
    }

    func testANewPictureNearTheEdgeIsPushedOntoThePage() {
        let frame = PagePictures.initialFrame(
            imageSize: CGSize(width: 2000, height: 2000), pageSize: page, around: CGPoint(x: 590, y: -50))
        XCTAssertEqual(frame.maxX, 600, accuracy: 0.01)
        XCTAssertEqual(frame.minY, 0, accuracy: 0.01)
    }

    func testMovingStopsAtThePageEdge() {
        let start = CGRect(x: 100, y: 100, width: 200, height: 100)
        let moved = PagePictures.moved(start, by: CGPoint(x: 1000, y: -1000), in: page)
        XCTAssertEqual(moved, CGRect(x: 400, y: 0, width: 200, height: 100))
    }

    func testResizingFromACornerKeepsTheOppositeCornerAndTheShape() {
        let start = CGRect(x: 100, y: 100, width: 200, height: 100)
        let resized = PagePictures.resized(
            start, dragging: .bottomRight, to: CGPoint(x: 500, y: 150), in: page)
        XCTAssertEqual(resized.origin, start.origin)
        XCTAssertEqual(resized.width / resized.height, 2, accuracy: 0.001)
        XCTAssertEqual(resized.width, 400, accuracy: 0.01, "the bigger stretch wins")
    }

    func testResizingFromTheTopLeftGrowsUpAndLeft() {
        let start = CGRect(x: 200, y: 200, width: 100, height: 100)
        let resized = PagePictures.resized(
            start, dragging: .topLeft, to: CGPoint(x: 100, y: 150), in: page)
        XCTAssertEqual(resized.maxX, 300, accuracy: 0.01)
        XCTAssertEqual(resized.maxY, 300, accuracy: 0.01)
        XCTAssertEqual(resized.width, 200, accuracy: 0.01)
    }

    func testResizingNeverGoesBelowTheMinimumOrOffThePage() {
        let start = CGRect(x: 100, y: 100, width: 200, height: 100)
        let tiny = PagePictures.resized(start, dragging: .bottomRight, to: CGPoint(x: 101, y: 101), in: page)
        XCTAssertEqual(min(tiny.width, tiny.height), PagePictures.minimumSide, accuracy: 0.01)
        let huge = PagePictures.resized(start, dragging: .bottomRight, to: CGPoint(x: 5000, y: 5000), in: page)
        XCTAssertLessThanOrEqual(huge.maxX, 600.001)
        XCTAssertLessThanOrEqual(huge.maxY, 800.001)
        XCTAssertEqual(huge.origin, start.origin)
    }

    func testPinchingScalesAboutTheCentre() {
        let start = CGRect(x: 200, y: 200, width: 100, height: 50)
        let scaled = PagePictures.scaled(start, by: 2, in: page)
        XCTAssertEqual(scaled, CGRect(x: 150, y: 175, width: 200, height: 100))
    }

    func testTheTopmostPictureWinsATouch() {
        let under = PagePicture(id: "a", frame: CGRect(x: 0, y: 0, width: 100, height: 100), jpeg: Data())
        let over = PagePicture(id: "b", frame: CGRect(x: 50, y: 50, width: 100, height: 100), jpeg: Data())
        XCTAssertEqual(PagePictures.topmost(at: CGPoint(x: 75, y: 75), in: [under, over])?.id, "b")
        XCTAssertEqual(PagePictures.topmost(at: CGPoint(x: 10, y: 10), in: [under, over])?.id, "a")
        XCTAssertNil(PagePictures.topmost(at: CGPoint(x: 400, y: 400), in: [under, over]))
    }
}
```

- [ ] **Step 2: Run, expect a compile failure** (`cannot find 'PagePictures' in scope`).

- [ ] **Step 3: Implement**

```swift
import CoreGraphics
import Foundation

/**
 * A picture the student put on a page.
 *
 * `frame` is in the page's displayed points, top-left origin — the space the
 * page's `PKDrawing` is in (PageOverlayView), so ink drawn over a picture stays
 * over it. Points, not fractions of the page, for the same reason. `jpeg` is
 * what `PictureIngest` produced once, at insert; nothing re-encodes it.
 *
 * Foundation and CoreGraphics only, like the archive that stores it.
 */
struct PagePicture: Codable, Equatable {
    var id: String
    var frame: CGRect
    var jpeg: Data
}

enum PictureCorner: CaseIterable {
    case topLeft, topRight, bottomLeft, bottomRight

    var isLeft: Bool { self == .topLeft || self == .bottomLeft }
    var isTop: Bool { self == .topLeft || self == .topRight }
}

/**
 * Where pictures go and how they move. Pure, so the part that decides whether a
 * picture can end up off the page or a pixel wide is tested without a view.
 * Every result is inside the page.
 */
enum PagePictures {
    /// The smallest side a picture can be resized to: still big enough to grab.
    static let minimumSide: CGFloat = 24

    /// A new picture: at most half the page each way, never larger than its own
    /// pixels, aspect kept, centred on `center` and then pushed onto the page.
    static func initialFrame(imageSize: CGSize, pageSize: CGSize, around center: CGPoint) -> CGRect {
        guard imageSize.width > 0, imageSize.height > 0 else { return .zero }
        let scale = min(
            1, pageSize.width / 2 / imageSize.width, pageSize.height / 2 / imageSize.height)
        let size = CGSize(width: imageSize.width * scale, height: imageSize.height * scale)
        return clamped(
            CGRect(
                x: center.x - size.width / 2, y: center.y - size.height / 2,
                width: size.width, height: size.height),
            in: pageSize)
    }

    /// Shrunk (aspect kept) if bigger than the page, then moved onto it.
    static func clamped(_ frame: CGRect, in pageSize: CGSize) -> CGRect {
        var rect = frame.standardized
        let shrink = min(1, pageSize.width / rect.width, pageSize.height / rect.height)
        if shrink < 1 {
            rect.size = CGSize(width: rect.width * shrink, height: rect.height * shrink)
        }
        rect.origin.x = min(max(rect.minX, 0), pageSize.width - rect.width)
        rect.origin.y = min(max(rect.minY, 0), pageSize.height - rect.height)
        return rect
    }

    static func moved(_ frame: CGRect, by translation: CGPoint, in pageSize: CGSize) -> CGRect {
        clamped(frame.offsetBy(dx: translation.x, dy: translation.y), in: pageSize)
    }

    /// A corner dragged to `point`: the opposite corner stays put, the aspect is
    /// kept, and the bigger of the two stretches wins so the corner follows the
    /// finger along either axis.
    static func resized(
        _ frame: CGRect, dragging corner: PictureCorner, to point: CGPoint, in pageSize: CGSize
    ) -> CGRect {
        guard frame.width > 0, frame.height > 0 else { return frame }
        let anchor = CGPoint(
            x: corner.isLeft ? frame.maxX : frame.minX, y: corner.isTop ? frame.maxY : frame.minY)
        let stretch = max(
            abs(point.x - anchor.x) / frame.width, abs(point.y - anchor.y) / frame.height)
        let roomX = corner.isLeft ? anchor.x : pageSize.width - anchor.x
        let roomY = corner.isTop ? anchor.y : pageSize.height - anchor.y
        let largest = min(roomX / frame.width, roomY / frame.height)
        let smallest = minimumSide / min(frame.width, frame.height)
        let scale = min(max(stretch, smallest), max(largest, smallest))
        let size = CGSize(width: frame.width * scale, height: frame.height * scale)
        let origin = CGPoint(
            x: corner.isLeft ? anchor.x - size.width : anchor.x,
            y: corner.isTop ? anchor.y - size.height : anchor.y)
        return clamped(CGRect(origin: origin, size: size), in: pageSize)
    }

    /// A pinch: scaled about the centre, never below the minimum.
    static func scaled(_ frame: CGRect, by factor: CGFloat, in pageSize: CGSize) -> CGRect {
        guard frame.width > 0, frame.height > 0 else { return frame }
        let scale = max(factor, minimumSide / min(frame.width, frame.height))
        let size = CGSize(width: frame.width * scale, height: frame.height * scale)
        return clamped(
            CGRect(
                x: frame.midX - size.width / 2, y: frame.midY - size.height / 2,
                width: size.width, height: size.height),
            in: pageSize)
    }

    static func point(of corner: PictureCorner, in frame: CGRect) -> CGPoint {
        CGPoint(x: corner.isLeft ? frame.minX : frame.maxX, y: corner.isTop ? frame.minY : frame.maxY)
    }

    /// Array order is stacking order, so the last one under the point is on top.
    static func topmost(at point: CGPoint, in pictures: [PagePicture]) -> PagePicture? {
        pictures.last { $0.frame.contains(point) }
    }
}
```

- [ ] **Step 4: Run the tests; expect them to pass.**
- [ ] **Step 5: Commit** `feat(pdf ink): page picture model and geometry`

---

### Task 2: `PictureIngest`

**Files:**
- Create: `ios/Sources/PdfInkPlugin/PictureIngest.swift`
- Test: `ios/Tests/PdfInkPluginTests/PictureIngestTests.swift`

**Interfaces — Produces:** `PictureIngest.Picture { jpeg: Data; pixelSize: CGSize }`,
`PictureIngest.picture(from: Data) -> Picture?`, `PictureIngest.picture(from: UIImage) -> Picture?`,
`maxPixelSide = 2048`, `quality = 0.8`.

- [ ] **Step 1: Write the failing tests**

```swift
import ImageIO
import UIKit
import UniformTypeIdentifiers
import XCTest
@testable import PdfInkPlugin

final class PictureIngestTests: XCTestCase {
    func testABigPhotoIsDownscaledTo2048OnItsLongSide() throws {
        let data = try encode(solid(.blue, CGSize(width: 4000, height: 1000)), as: .jpeg)
        let picture = try XCTUnwrap(PictureIngest.picture(from: data))
        XCTAssertEqual(picture.pixelSize, CGSize(width: 2048, height: 512))
        XCTAssertEqual(try properties(picture.jpeg)[kCGImagePropertyPixelWidth] as? Int, 2048)
    }

    func testASmallPictureKeepsItsSize() throws {
        let data = try encode(solid(.blue, CGSize(width: 300, height: 200)), as: .png)
        XCTAssertEqual(PictureIngest.picture(from: data)?.pixelSize, CGSize(width: 300, height: 200))
    }

    /// A camera photo is stored landscape with an orientation flag; the stored
    /// picture must be upright, because nothing downstream reads the flag.
    func testTheOrientationFlagIsApplied() throws {
        let data = try encode(
            solid(.blue, CGSize(width: 40, height: 20)), as: .jpeg,
            properties: [kCGImagePropertyOrientation: 6])
        XCTAssertEqual(PictureIngest.picture(from: data)?.pixelSize, CGSize(width: 20, height: 40))
    }

    /// The export goes to other people; where a photo was taken must not.
    func testNoLocationOrOtherMetadataSurvives() throws {
        let data = try encode(
            solid(.blue, CGSize(width: 64, height: 64)), as: .jpeg,
            properties: [
                kCGImagePropertyGPSDictionary: [kCGImagePropertyGPSLatitude: 49.21],
                kCGImagePropertyExifDictionary: [kCGImagePropertyExifUserComment: "secret"],
            ])
        let stored = try properties(try XCTUnwrap(PictureIngest.picture(from: data)).jpeg)
        XCTAssertNil(stored[kCGImagePropertyGPSDictionary])
        XCTAssertNil((stored[kCGImagePropertyExifDictionary] as? [CFString: Any])?[kCGImagePropertyExifUserComment])
    }

    /// JPEG has no alpha: a transparent PNG would otherwise come out black.
    func testTransparencyBecomesWhitePaper() throws {
        let clear = UIGraphicsImageRenderer(size: CGSize(width: 32, height: 32)).image { _ in }
        let data = try XCTUnwrap(clear.pngData())
        let picture = try XCTUnwrap(PictureIngest.picture(from: data))
        let image = try XCTUnwrap(UIImage(data: picture.jpeg)?.cgImage)
        XCTAssertGreaterThan(grey(image, x: 16, y: 16), 245)
    }

    func testACameraImageIsDrawnUprightAndDownscaled() throws {
        let landscape = solid(.blue, CGSize(width: 4032, height: 3024))
        let portrait = UIImage(cgImage: try XCTUnwrap(landscape.cgImage), scale: 1, orientation: .right)
        let picture = try XCTUnwrap(PictureIngest.picture(from: portrait))
        XCTAssertEqual(picture.pixelSize, CGSize(width: 1536, height: 2048))
    }

    func testJunkIsRefused() {
        XCTAssertNil(PictureIngest.picture(from: Data("not an image".utf8)))
    }

    // MARK: - Helpers

    private func solid(_ color: UIColor, _ size: CGSize) -> UIImage {
        let format = UIGraphicsImageRendererFormat()
        format.scale = 1
        return UIGraphicsImageRenderer(size: size, format: format).image { ctx in
            color.setFill()
            ctx.fill(CGRect(origin: .zero, size: size))
        }
    }

    private func encode(_ image: UIImage, as type: UTType, properties: [CFString: Any] = [:]) throws -> Data {
        let out = NSMutableData()
        let dest = try XCTUnwrap(CGImageDestinationCreateWithData(out, type.identifier as CFString, 1, nil))
        CGImageDestinationAddImage(dest, try XCTUnwrap(image.cgImage), properties as CFDictionary)
        XCTAssertTrue(CGImageDestinationFinalize(dest))
        return out as Data
    }

    private func properties(_ data: Data) throws -> [CFString: Any] {
        let source = try XCTUnwrap(CGImageSourceCreateWithData(data as CFData, nil))
        return try XCTUnwrap(CGImageSourceCopyPropertiesAtIndex(source, 0, nil) as? [CFString: Any])
    }

    private func grey(_ image: CGImage, x: Int, y: Int) -> Int {
        var pixel = [UInt8](repeating: 0, count: 4)
        let ctx = CGContext(
            data: &pixel, width: 1, height: 1, bitsPerComponent: 8, bytesPerRow: 4,
            space: CGColorSpaceCreateDeviceRGB(), bitmapInfo: CGImageAlphaInfo.premultipliedLast.rawValue)!
        ctx.draw(image, in: CGRect(x: -x, y: -(image.height - 1 - y), width: image.width, height: image.height))
        return (Int(pixel[0]) + Int(pixel[1]) + Int(pixel[2])) / 3
    }
}
```

- [ ] **Step 2: Run, expect a compile failure.**
- [ ] **Step 3: Implement**

```swift
import ImageIO
import UIKit
import UniformTypeIdentifiers

/**
 * A photo turned into what a page stores — once, when it is inserted.
 *
 * - **At most 2048 px on the long side.** Sharp on a page at any zoom the reader
 *   reaches, and a few hundred KB rather than a 12 MP original. ImageIO's
 *   thumbnail path decodes straight to that size: decoding a camera photo whole
 *   costs about 48 MB, on an iPad 8 with 3 GB.
 * - **Upright.** The orientation flag is applied to the pixels
 *   (`...WithTransform`), because nothing downstream reads it.
 * - **No metadata.** The JPEG is written with no properties, so GPS and EXIF are
 *   gone — the export hands these pictures to other people.
 * - **On white.** JPEG has no alpha, and a transparent PNG would turn black.
 */
enum PictureIngest {
    struct Picture: Equatable {
        let jpeg: Data
        let pixelSize: CGSize
    }

    static let maxPixelSide: CGFloat = 2048
    static let quality: CGFloat = 0.8

    /// From the photo library: any format ImageIO reads (HEIC, JPEG, PNG…).
    static func picture(from data: Data) -> Picture? {
        guard let source = CGImageSourceCreateWithData(data as CFData, nil),
            let props = CGImageSourceCopyPropertiesAtIndex(source, 0, nil) as? [CFString: Any],
            let width = (props[kCGImagePropertyPixelWidth] as? NSNumber)?.doubleValue,
            let height = (props[kCGImagePropertyPixelHeight] as? NSNumber)?.doubleValue
        else { return nil }
        let options: [CFString: Any] = [
            kCGImageSourceCreateThumbnailFromImageAlways: true,
            kCGImageSourceCreateThumbnailWithTransform: true,
            kCGImageSourceThumbnailMaxPixelSize: min(maxPixelSide, CGFloat(max(width, height))),
            kCGImageSourceShouldCacheImmediately: true,
        ]
        guard let image = CGImageSourceCreateThumbnailAtIndex(source, 0, options as CFDictionary)
        else { return nil }
        return encode(image)
    }

    /// From the camera, which hands over a decoded image whose orientation is a
    /// flag: drawing it applies the flag.
    static func picture(from image: UIImage) -> Picture? {
        let pixels = CGSize(width: image.size.width * image.scale, height: image.size.height * image.scale)
        guard pixels.width > 0, pixels.height > 0 else { return nil }
        let scale = min(1, maxPixelSide / max(pixels.width, pixels.height))
        let target = CGSize(
            width: (pixels.width * scale).rounded(), height: (pixels.height * scale).rounded())
        let format = UIGraphicsImageRendererFormat()
        format.scale = 1
        format.opaque = true
        let drawn = UIGraphicsImageRenderer(size: target, format: format).image { _ in
            image.draw(in: CGRect(origin: .zero, size: target))
        }
        return drawn.cgImage.flatMap(encode)
    }

    private static func encode(_ image: CGImage) -> Picture? {
        guard let opaque = onWhite(image) else { return nil }
        let out = NSMutableData()
        guard
            let destination = CGImageDestinationCreateWithData(
                out, UTType.jpeg.identifier as CFString, 1, nil)
        else { return nil }
        CGImageDestinationAddImage(
            destination, opaque,
            [kCGImageDestinationLossyCompressionQuality: quality] as CFDictionary)
        guard CGImageDestinationFinalize(destination) else { return nil }
        return Picture(jpeg: out as Data, pixelSize: CGSize(width: opaque.width, height: opaque.height))
    }

    /// The image drawn over white, in sRGB, with no alpha.
    private static func onWhite(_ image: CGImage) -> CGImage? {
        let rect = CGRect(x: 0, y: 0, width: image.width, height: image.height)
        guard
            let context = CGContext(
                data: nil, width: image.width, height: image.height, bitsPerComponent: 8,
                bytesPerRow: 0, space: CGColorSpace(name: CGColorSpace.sRGB)!,
                bitmapInfo: CGImageAlphaInfo.noneSkipLast.rawValue)
        else { return nil }
        context.setFillColor(UIColor.white.cgColor)
        context.fill(rect)
        context.draw(image, in: rect)
        return context.makeImage()
    }
}
```

- [ ] **Step 4: Run the tests; expect them to pass.**
- [ ] **Step 5: Commit** `feat(pdf ink): ingest a photo into a stored picture`

---

### Task 3: archive key and export

**Files:**
- Modify: `ios/Sources/PdfInkPlugin/InkArchive.swift`, `ios/Sources/PdfInkPlugin/InkExport.swift`
- Test: `InkArchiveTests.swift`, `InkExportTests.swift`

**Interfaces — Produces:** `InkArchive.pictures: [Int: [PagePicture]]`,
`InkArchive.init(pageCount:pages:insertedPages:pictures:)` (new param defaults to `[:]`),
`InkExport.flatten(_:drawings:pictures:to:)` (`pictures` defaults to `[:]`).

- [ ] **Step 1: Failing tests** — append to `InkArchiveTests`:

```swift
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
```

Append to `InkExportTests` (inside the class, before `// MARK: - Helpers`):

```swift
    /// Page, then pictures, then ink — the order the reader shows.
    func testAPictureIsInTheExportUnderTheInk() throws {
        let size = CGSize(width: 200, height: 200)
        let document = try whitePage(size: size)
        let picture = try XCTUnwrap(PictureIngest.picture(from: grey(128, CGSize(width: 100, height: 100))))
        let placed = PagePicture(id: "p", frame: CGRect(x: 50, y: 50, width: 100, height: 100), jpeg: picture.jpeg)
        let url = tempURL()

        try InkExport.flatten(
            document, drawings: [0: horizontalStroke(y: 100, from: 40, to: 160)],
            pictures: [0: [placed]], to: url)

        let sample = try render(PDFDocument(url: url)?.page(at: 0), size: size)
        XCTAssertEqual(sample(CGPoint(x: 70, y: 70)), 128, accuracy: 12, "the picture is missing")
        XCTAssertLessThan(sample(CGPoint(x: 100, y: 100)), 40, "the ink is not on top of the picture")
        XCTAssertGreaterThan(sample(CGPoint(x: 20, y: 20)), 245, "the page outside the picture changed")
    }

    /// The JPEG goes into the PDF as-is. Noise is what a bitmap cannot
    /// compress, so a regression to raw pixels shows up as several times the size.
    func testAPictureIsEmbeddedAsItsJpeg() throws {
        let document = try whitePage(size: CGSize(width: 600, height: 800))
        let noise = try XCTUnwrap(PictureIngest.picture(from: noiseImage(CGSize(width: 1024, height: 768))))
        let placed = PagePicture(id: "p", frame: CGRect(x: 0, y: 0, width: 600, height: 450), jpeg: noise.jpeg)
        let url = tempURL()

        try InkExport.flatten(document, drawings: [:], pictures: [0: [placed]], to: url)

        let size = try XCTUnwrap(try url.resourceValues(forKeys: [.fileSizeKey]).fileSize)
        XCTAssertLessThan(size, noise.jpeg.count * 3 / 2, "the picture was re-encoded as a bitmap")
    }
```

and helpers inside the class's helper section:

```swift
    private func grey(_ value: CGFloat, _ size: CGSize) -> Data {
        let format = UIGraphicsImageRendererFormat()
        format.scale = 1
        return UIGraphicsImageRenderer(size: size, format: format).pngData { ctx in
            UIColor(white: value / 255, alpha: 1).setFill()
            ctx.fill(CGRect(origin: .zero, size: size))
        }
    }

    private func noiseImage(_ size: CGSize) -> Data {
        let format = UIGraphicsImageRendererFormat()
        format.scale = 1
        var generator = SystemRandomNumberGenerator()
        return UIGraphicsImageRenderer(size: size, format: format).pngData { ctx in
            for y in stride(from: 0, to: Int(size.height), by: 2) {
                for x in stride(from: 0, to: Int(size.width), by: 2) {
                    UIColor(white: CGFloat.random(in: 0...1, using: &generator), alpha: 1).setFill()
                    ctx.fill(CGRect(x: x, y: y, width: 2, height: 2))
                }
            }
        }
    }
```

- [ ] **Step 2: Run, expect a compile failure** (extra argument `pictures`).
- [ ] **Step 3: Implement.** In `InkArchive`: add `var pictures: [Int: [PagePicture]]`, the init
  parameter `pictures: [Int: [PagePicture]] = [:]`, and in `init(from:)`
  `pictures = try container.decodeIfPresent([Int: [PagePicture]].self, forKey: .pictures) ?? [:]`.
  Extend the header comment with the additive-key rule and its cost (an older build drops pictures on save; bumping would quarantine the ink).
  In `InkExport.flatten`, add `pictures: [Int: [PagePicture]] = [:]` before `to url:` and, right after `cg.restoreGState()` and before the drawing guard:

```swift
                // Under the ink, as in the reader. From the JPEG's own data
                // provider, so the PDF context embeds the JPEG rather than a bitmap.
                for picture in pictures[index] ?? [] {
                    guard let provider = CGDataProvider(data: picture.jpeg as CFData),
                        let image = CGImage(
                            jpegDataProviderSource: provider, decode: nil, shouldInterpolate: true,
                            intent: .defaultIntent)
                    else { continue }
                    UIImage(cgImage: image).draw(in: picture.frame)
                }
```
- [ ] **Step 4: Run; expect pass.** If the size test fails, the passthrough did not happen: draw with `cg.draw(image, in:)` under a local flip instead of `UIImage.draw` and re-measure.
- [ ] **Step 5: Commit** `feat(pdf ink): pictures in the ink archive and the export`

---

### Task 4: `PictureLayerView` in the page overlay

**Files:**
- Create: `ios/Sources/PdfInkPlugin/PictureLayerView.swift`
- Modify: `ios/Sources/PdfInkPlugin/PageOverlayView.swift`
- Test: `PictureLayerTests.swift` (new), `PageOverlayTests.swift`

**Interfaces — Consumes:** Task 1. **Produces:** `PictureLayerView` with
`pictures: [PagePicture]`, `selectedID: String?`, `arranging: Bool`, `chromeScale: CGFloat`,
`deleteLabel: String`, `onSelect: ((String) -> Void)?`, `onCommit: (([PagePicture]) -> Void)?`,
`takesTouch(at: CGPoint) -> Bool`, `deleteSelected()`; `PageOverlayView.pictureLayer`.

- [ ] **Step 1: Failing tests** — `PictureLayerTests.swift`:

```swift
import XCTest
@testable import PdfInkPlugin

final class PictureLayerTests: XCTestCase {
    private func layer(arranging: Bool) -> PictureLayerView {
        let layer = PictureLayerView(frame: CGRect(x: 0, y: 0, width: 600, height: 800))
        layer.pictures = [
            PagePicture(id: "a", frame: CGRect(x: 100, y: 100, width: 200, height: 100), jpeg: Data())
        ]
        layer.arranging = arranging
        return layer
    }

    /// Drawing mode: the layer is part of the page and never takes a touch.
    func testWhileDrawingAPictureTakesNoTouch() {
        let layer = layer(arranging: false)
        XCTAssertFalse(layer.isUserInteractionEnabled)
        XCTAssertFalse(layer.takesTouch(at: CGPoint(x: 150, y: 150)))
    }

    /// Arranging: a picture takes its touch, empty page does not — so a finger
    /// there still scrolls the document.
    func testWhileArrangingOnlyPicturesTakeATouch() {
        let layer = layer(arranging: true)
        XCTAssertNotNil(layer.hitTest(CGPoint(x: 150, y: 150), with: nil))
        XCTAssertNil(layer.hitTest(CGPoint(x: 500, y: 600), with: nil))
    }

    func testASelectedPictureCanBeGrabbedByItsCornerHandle() {
        let layer = layer(arranging: true)
        layer.selectedID = "a"
        layer.layoutIfNeeded()
        XCTAssertTrue(layer.takesTouch(at: CGPoint(x: 299 + 10, y: 199 + 10)), "a handle pokes past the corner")
    }

    func testDeleteRemovesTheSelectedPictureAndCommits() {
        let layer = layer(arranging: true)
        layer.selectedID = "a"
        var committed: [PagePicture]?
        layer.onCommit = { committed = $0 }
        layer.deleteSelected()
        XCTAssertEqual(committed, [])
        XCTAssertNil(layer.selectedID)
    }

    func testLeavingArrangingDropsTheSelection() {
        let layer = layer(arranging: true)
        layer.selectedID = "a"
        layer.arranging = false
        XCTAssertNil(layer.selectedID)
    }
}
```

Append to `PageOverlayTests`:

```swift
    /// Pictures sit under the ink, at exactly the page's size and with no
    /// transform: their frames are in the same points as the drawing.
    func testThePicturesAreUnderTheInkAndExactlyThePage() {
        let overlay = PageOverlayView(frame: CGRect(x: 0, y: 0, width: 300, height: 400))
        overlay.inkScale = 2
        overlay.layoutIfNeeded()
        XCTAssertEqual(overlay.subviews.first, overlay.pictureLayer)
        XCTAssertEqual(overlay.subviews.last, overlay.canvas)
        XCTAssertEqual(overlay.pictureLayer.frame, overlay.bounds)
        XCTAssertEqual(overlay.pictureLayer.transform, .identity)
    }
```

- [ ] **Step 2: Run, expect a compile failure.**
- [ ] **Step 3: Implement `PictureLayerView.swift`**

```swift
import UIKit

/**
 * The pictures on one page, under its ink.
 *
 * It renders and it reports; it decides nothing. The reader owns the pictures
 * (`pictures[pageIndex]`, like `drawings`), hands them in, and gets the new list
 * back once per finished gesture through `onCommit` — so each move is one undo
 * step and one save, not one per frame of a drag.
 *
 * It is invisible to touches unless the reader is arranging, and even then it
 * takes only touches on a picture or on the selected one's chrome: `hitTest`
 * returns nothing elsewhere, so a finger on empty page still scrolls.
 *
 * Its coordinates are the page's points (PageOverlayView), and PDFKit scales the
 * whole page view, so the chrome is drawn at `chromeScale` (1 / the page scale)
 * to stay the same size on screen at any zoom.
 */
final class PictureLayerView: UIView, UIGestureRecognizerDelegate {
    var pictures: [PagePicture] = [] {
        didSet { syncImageViews() }
    }
    var selectedID: String? {
        didSet { setNeedsLayout() }
    }
    var arranging = false {
        didSet {
            isUserInteractionEnabled = arranging
            if !arranging { selectedID = nil }
        }
    }
    var chromeScale: CGFloat = 1 {
        didSet { if chromeScale != oldValue { setNeedsLayout() } }
    }
    var deleteLabel = "Delete" {
        didSet { deleteButton.accessibilityLabel = deleteLabel }
    }
    var onSelect: ((String) -> Void)?
    var onCommit: (([PagePicture]) -> Void)?

    /// On-screen sizes, before `chromeScale`.
    static let handleSide: CGFloat = 22
    static let deleteSide: CGFloat = 40

    private var imageViews: [String: UIImageView] = [:]
    private let chrome = UIView()
    private let outline = CAShapeLayer()
    private var handles: [PictureCorner: UIView] = [:]
    private let deleteButton = UIButton(type: .system)
    private enum Gesture {
        case move(id: String, start: CGRect)
        case resize(id: String, corner: PictureCorner, start: CGRect)
        case pinch(id: String, start: CGRect)
    }
    private var gesture: Gesture?

    override init(frame: CGRect) {
        super.init(frame: frame)
        backgroundColor = .clear
        isOpaque = false
        isUserInteractionEnabled = false
        chrome.isUserInteractionEnabled = true
        outline.fillColor = nil
        chrome.layer.addSublayer(outline)
        for corner in PictureCorner.allCases {
            let handle = UIView(frame: CGRect(x: 0, y: 0, width: Self.handleSide, height: Self.handleSide))
            handle.backgroundColor = .white
            handle.layer.cornerRadius = Self.handleSide / 2
            handle.layer.borderWidth = 2
            handle.isUserInteractionEnabled = false
            handles[corner] = handle
            chrome.addSubview(handle)
        }
        var config = UIButton.Configuration.filled()
        config.image = UIImage(systemName: "trash")
        config.baseBackgroundColor = .systemRed
        config.cornerStyle = .capsule
        deleteButton.configuration = config
        deleteButton.frame = CGRect(x: 0, y: 0, width: Self.deleteSide, height: Self.deleteSide)
        deleteButton.accessibilityLabel = deleteLabel
        deleteButton.addTarget(self, action: #selector(deleteTapped), for: .touchUpInside)
        chrome.addSubview(deleteButton)
        addSubview(chrome)

        let pan = UIPanGestureRecognizer(target: self, action: #selector(panned(_:)))
        pan.maximumNumberOfTouches = 1
        let pinch = UIPinchGestureRecognizer(target: self, action: #selector(pinched(_:)))
        let tap = UITapGestureRecognizer(target: self, action: #selector(tapped(_:)))
        for recognizer in [pan, pinch, tap] as [UIGestureRecognizer] {
            recognizer.delegate = self
            addGestureRecognizer(recognizer)
        }
    }

    required init?(coder: NSCoder) { fatalError("PictureLayerView is code-only") }

    // MARK: - Touches

    /// Whether a touch at `point` is this layer's: a picture, or the selected
    /// picture's handles and Delete. Everything else is the page's.
    func takesTouch(at point: CGPoint) -> Bool {
        guard arranging else { return false }
        if selectedFrame != nil {
            if !deleteButton.isHidden, deleteButton.frame.contains(point) { return true }
            if corner(at: point) != nil { return true }
        }
        return PagePictures.topmost(at: point, in: pictures) != nil
    }

    override func point(inside point: CGPoint, with event: UIEvent?) -> Bool {
        takesTouch(at: point)
    }

    override func hitTest(_ point: CGPoint, with event: UIEvent?) -> UIView? {
        guard isUserInteractionEnabled, !isHidden, takesTouch(at: point) else { return nil }
        if !deleteButton.isHidden, deleteButton.frame.contains(point) { return deleteButton }
        return self
    }

    /// PDFView's scroll and zoom wait for ours to fail, so dragging a picture
    /// never scrolls the page under it. Ours only ever see touches on pictures.
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

    @objc private func tapped(_ tap: UITapGestureRecognizer) {
        guard let picture = PagePictures.topmost(at: tap.location(in: self), in: pictures) else { return }
        selectPicture(picture.id)
    }

    @objc private func panned(_ pan: UIPanGestureRecognizer) {
        let translation = pan.translation(in: self)
        switch pan.state {
        case .began:
            let start = CGPoint(x: pan.location(in: self).x - translation.x, y: pan.location(in: self).y - translation.y)
            if let selectedID, let frame = selectedFrame, let corner = corner(at: start) {
                gesture = .resize(id: selectedID, corner: corner, start: frame)
            } else if let picture = PagePictures.topmost(at: start, in: pictures) {
                selectPicture(picture.id)
                gesture = .move(id: picture.id, start: picture.frame)
            }
        case .changed:
            switch gesture {
            case .move(let id, let start):
                setFrame(PagePictures.moved(start, by: translation, in: bounds.size), of: id)
            case .resize(let id, let corner, let start):
                setFrame(
                    PagePictures.resized(start, dragging: corner, to: pan.location(in: self), in: bounds.size),
                    of: id)
            default: break
            }
        case .ended, .cancelled, .failed:
            finishGesture()
        default: break
        }
    }

    @objc private func pinched(_ pinch: UIPinchGestureRecognizer) {
        switch pinch.state {
        case .began:
            let target = PagePictures.topmost(at: pinch.location(in: self), in: pictures)
                ?? pictures.first { $0.id == selectedID }
            guard let target else { return }
            selectPicture(target.id)
            gesture = .pinch(id: target.id, start: target.frame)
        case .changed:
            if case .pinch(let id, let start) = gesture {
                setFrame(PagePictures.scaled(start, by: pinch.scale, in: bounds.size), of: id)
            }
        case .ended, .cancelled, .failed:
            finishGesture()
        default: break
        }
    }

    @objc private func deleteTapped() { deleteSelected() }

    func deleteSelected() {
        guard let selectedID else { return }
        pictures.removeAll { $0.id == selectedID }
        self.selectedID = nil
        onCommit?(pictures)
    }

    private func selectPicture(_ id: String) {
        guard selectedID != id else { return }
        selectedID = id
        onSelect?(id)
    }

    private func setFrame(_ frame: CGRect, of id: String) {
        guard let index = pictures.firstIndex(where: { $0.id == id }) else { return }
        pictures[index].frame = frame
    }

    private func finishGesture() {
        defer { gesture = nil }
        let start: CGRect
        let id: String
        switch gesture {
        case .move(let i, let s), .pinch(let i, let s): (id, start) = (i, s)
        case .resize(let i, _, let s): (id, start) = (i, s)
        case nil: return
        }
        if pictures.first(where: { $0.id == id })?.frame != start { onCommit?(pictures) }
    }

    // MARK: - Drawing

    private var selectedFrame: CGRect? {
        guard arranging, let selectedID else { return nil }
        return pictures.first { $0.id == selectedID }?.frame
    }

    private func corner(at point: CGPoint) -> PictureCorner? {
        guard let frame = selectedFrame else { return nil }
        let reach = Self.handleSide * chromeScale
        return PictureCorner.allCases.first { corner in
            let center = PagePictures.point(of: corner, in: frame)
            return abs(point.x - center.x) <= reach && abs(point.y - center.y) <= reach
        }
    }

    private func syncImageViews() {
        let ids = Set(pictures.map(\.id))
        for (id, view) in imageViews where !ids.contains(id) {
            view.removeFromSuperview()
            imageViews[id] = nil
        }
        for picture in pictures {
            let view = imageViews[picture.id] ?? {
                let view = UIImageView(image: UIImage(data: picture.jpeg))
                view.contentMode = .scaleToFill
                imageViews[picture.id] = view
                return view
            }()
            view.frame = picture.frame
            insertSubview(view, belowSubview: chrome)
        }
        setNeedsLayout()
    }

    override func layoutSubviews() {
        super.layoutSubviews()
        chrome.frame = bounds
        guard let frame = selectedFrame else {
            chrome.isHidden = true
            return
        }
        chrome.isHidden = false
        outline.strokeColor = tintColor.cgColor
        outline.lineWidth = 2 * chromeScale
        outline.path = UIBezierPath(rect: frame).cgPath
        let scale = CGAffineTransform(scaleX: chromeScale, y: chromeScale)
        for (corner, handle) in handles {
            handle.layer.borderColor = tintColor.cgColor
            handle.transform = scale
            handle.center = PagePictures.point(of: corner, in: frame)
        }
        // Above the picture, or inside its top edge when it touches the page top.
        deleteButton.transform = scale
        let lift = (Self.deleteSide / 2 + 10) * chromeScale
        let above = frame.minY - lift
        deleteButton.center = CGPoint(x: frame.midX, y: above >= lift / 2 ? above : frame.minY + lift)
    }

    override func tintColorDidChange() {
        super.tintColorDidChange()
        setNeedsLayout()
    }
}
```

Modify `PageOverlayView`: add `let pictureLayer = PictureLayerView()`; in `init`
`addSubview(pictureLayer)` BEFORE `addSubview(canvas)`; in `layoutSubviews`
`pictureLayer.frame = bounds` (first line after `super`). Rewrite the "wrapper
looks pointless" paragraph of the header: the wrapper now holds two things — the
pictures under the ink and the canvas — and the canvas's frame rule is unchanged.

- [ ] **Step 4: Run; expect pass.**
- [ ] **Step 5: Commit** `feat(pdf ink): a picture layer under each page's ink`

---

### Task 5: strings (Swift + JS)

**Files:** `ios/Sources/PdfInkPlugin/PdfInkStrings.swift`, `src/mobile/pdfInk.ts`,
`src/hooks/ui/usePdfInkStrings.ts`, `src/i18n/locales/{en,cs}.json`, `src/mobile/__tests__/pdfInk.test.ts`

**Produces:** `PdfInkStrings.add`, `.photoLibrary`, `.takePhoto`, `.movePictures`, `.deletePicture`, `.done`.

| key | en | cs |
| --- | --- | --- |
| `add` | Add | Přidat |
| `photoLibrary` | Photo library | Z fotek |
| `takePhoto` | Take photo | Vyfotit |
| `movePictures` | Move pictures | Přesunout obrázky |
| `deletePicture` | Delete picture | Smazat obrázek |
| `done` | Done | Hotovo |

- [ ] **Step 1:** add the six fields to the `PdfInkStrings` TS interface (with one-line doc comments) and to the `pdfInk.test.ts` fixture; run `npm run typecheck` — expect it to fail in `usePdfInkStrings.ts` (missing properties).
- [ ] **Step 2:** add `t('mobile.pdfInk.<key>')` for each in `usePdfInkStrings.ts`; add the keys to `mobile.pdfInk` in both locale files; add the Swift fields with the English fallbacks above (`object?["add"] as? String ?? "Add"`, …).
- [ ] **Step 3:** `npm run typecheck` and `npx vitest run src/mobile src/hooks/ui/__tests__/usePdfPreview src/i18n` — expect pass (the i18n parity tests cover both locales).
- [ ] **Step 4: Commit** `feat(pdf ink): strings for pictures`

---

### Task 6: the reader — menu, pickers, arranging, undo, saving

**Files:**
- Create: `ios/Sources/PdfInkPlugin/PdfInkViewController+Pictures.swift`
- Modify: `ios/Sources/PdfInkPlugin/PdfInkViewController.swift`
- Test: `ReaderPictureTests.swift` (new), `ReaderScaleTests.swift` (bar pin)

**Interfaces — Consumes:** Tasks 1–5. **Produces (internal, used by tests):**
`pictures: [Int: [PagePicture]]`, `arrangingPictures: Bool`, `fileToolItems: [UIBarButtonItem]`,
`doneArrangingItem`, `addMenuItems() -> [UIMenuElement]`, `insertPicture(_: PictureIngest.Picture) -> Bool`,
`setPictures(_:onPage:)`, `beginArrangingPictures(selecting:)`, `endArrangingPictures(restoringPens:)`,
`canvas(onPage:) -> PKCanvasView?`, `undoManagerForPictures: UndoManager?`.

- [ ] **Step 1: Failing tests.** Update the bar pin in `ReaderScaleTests.testTheBarCarriesTheFiveFileToolsAndNothingElse`: `strings.addPage` → `strings.add`, and assert the item has a `menu`:

```swift
        XCTAssertEqual(
            trailing.map(\.accessibilityLabel),
            [strings.export, strings.add, strings.focus, strings.search, strings.pages],
            "the reader's bar gained or lost a tool")
        XCTAssertNotNil(trailing[1].menu, "+ is a menu: a page, a picture, or moving pictures")
```

Create `ReaderPictureTests.swift`:

```swift
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
        undo.groupsByEvent = false
        let placed = PagePicture(id: "p", frame: CGRect(x: 0, y: 0, width: 10, height: 10), jpeg: try picture().jpeg)

        undo.beginUndoGrouping()
        reader.setPictures([placed], onPage: 0)
        undo.endUndoGrouping()
        undo.beginUndoGrouping()
        reader.setPictures([], onPage: 0)
        undo.endUndoGrouping()

        undo.undo()
        XCTAssertEqual(reader.pictures[0], [placed])
        undo.redo()
        XCTAssertNil(reader.pictures[0])
    }

    func testTheMenuOffersMovingOnlyOnceThereIsAPicture() throws {
        let (reader, _) = try show(pages: 1)
        let titles = { reader.addMenuItems().compactMap { ($0 as? UIAction)?.title } }
        XCTAssertEqual(titles().first, strings.addPage)
        XCTAssertTrue(titles().contains(strings.photoLibrary))
        XCTAssertFalse(titles().contains(strings.movePictures))

        reader.setPictures(
            [PagePicture(id: "p", frame: CGRect(x: 0, y: 0, width: 10, height: 10), jpeg: Data())], onPage: 0)

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

    override func tearDown() {
        for window in windows { window.isHidden = true }
        windows = []
        super.tearDown()
    }
}
```

- [ ] **Step 2: Run, expect compile failures.**

- [ ] **Step 3: Controller edits** in `PdfInkViewController.swift`:
  1. Make `strings`, `tint`, `pdfView`, `toolPicker`, `document`, `overlays`, `showToolPicker()` internal (drop `private`) — the `+Pictures` extension lives in another file. One comment line says why.
  2. Replace `addPageItem` with:
     ```swift
     /// `+`: a blank page, a picture, or moving the pictures already there. A
     /// menu, so the bar stays at five buttons; built fresh on every open
     /// (`+Pictures`) because what it offers depends on the file.
     private(set) lazy var addItem = UIBarButtonItem(
         title: nil, image: UIImage(systemName: "plus"), primaryAction: nil,
         menu: UIMenu(children: [
             UIDeferredMenuElement.uncached { [weak self] completion in
                 completion(self?.addMenuItems() ?? [])
             }
         ]))
     ```
     and delete `addPageTapped`.
  3. Add stored state after `insertedPages`:
     ```swift
     /// The pictures on each page, in stacking order — like `drawings`, the
     /// source of truth; the layers only show them. See `+Pictures`.
     var pictures: [Int: [PagePicture]] = [:]
     /// Moving pictures instead of drawing. A visible mode: see `+Pictures`.
     var arrangingPictures = false
     var selectedPicture: (page: Int, id: String)?
     /// What picture undo actions are registered against, so a renumbering can
     /// clear them without touching PencilKit's strokes.
     let pictureUndoTarget = NSObject()
     private(set) lazy var doneArrangingItem = UIBarButtonItem(
         title: strings.done, style: .done, target: self, action: #selector(doneArrangingTapped))
     /// Ends arranging on a tap on empty page. Enabled only while arranging.
     private(set) lazy var emptyPageTap = UITapGestureRecognizer(
         target: self, action: #selector(emptyPageTapped(_:)))
     /// The five file tools, right to left. Arranging swaps them for Done.
     var fileToolItems: [UIBarButtonItem] { [shareItem, addItem, focusItem, searchItem, pagesItem] }
     ```
  4. `viewDidLoad`: `addItem.accessibilityLabel = strings.add`; `navigationItem.rightBarButtonItems = fileToolItems`; after `view.addSubview(pdfView)`: `emptyPageTap.cancelsTouchesInView = false; emptyPageTap.isEnabled = false; pdfView.addGestureRecognizer(emptyPageTap)`.
  5. `load`: inside `if let archive`, `pictures = archive.pictures`.
  6. `leaveCurrentFile`, after the persist guard: `endArrangingPictures(restoringPens: false)`, `pictures = [:]`, `forgetPictureUndo()`.
  7. `addBlankPage` / `removeAddedPage`: beside the `drawings` shift, `pictures = InkPages.shifted(pictures, insertingAt: at)` / `removingAt: index`, then `forgetPictureUndo()`.
  8. `setBarItems`: `addItem.isEnabled = enabled`.
  9. `restoreToolPicker` guard: add `!arrangingPictures`.
  10. `hasInk(onPage:)`: return true first when `!(pictures[index]?.isEmpty ?? true)`; doc comment says "ink or a picture".
  11. `shareTapped`: `InkExport.flatten(document, drawings: drawings, pictures: pictures, to: url)`.
  12. `updateInkScale`: inside the loop, `overlay.pictureLayer.chromeScale = pictureChromeScale`.
  13. `pdfView(_:overlayViewFor:)`: before `overlays[index] = overlay`, `configurePictures(of: overlay, page: index)`.
  14. `currentArchive`: pass `pictures: pictures.filter { !$0.value.isEmpty }`.
  15. `persistNow`: delete only when `archive.pages.isEmpty && archive.insertedPages.isEmpty && archive.pictures.isEmpty`.

- [ ] **Step 4: Create `PdfInkViewController+Pictures.swift`**

```swift
import PDFKit
import PencilKit
import PhotosUI
import UIKit
import UniformTypeIdentifiers

/**
 * Pictures on the page: the `+` menu, the photo picker and the camera, and the
 * arranging mode (spec addendum 2026-10-03).
 *
 * Arranging is a visible mode, like the withdrawn covers were: the pens go, the
 * bar is one Done, and the canvases stop taking touches so a finger moves
 * pictures instead of drawing. Every change goes through `setPictures`, which is
 * the only writer — it shows, saves and registers the way back on the same undo
 * manager PencilKit uses, so the palette's undo takes back the last thing done.
 */
@available(iOS 16.0, *)
extension PdfInkViewController: PHPickerViewControllerDelegate,
    UIImagePickerControllerDelegate, UINavigationControllerDelegate
{
    // MARK: - Menu

    func addMenuItems() -> [UIMenuElement] {
        var items: [UIMenuElement] = [
            UIAction(title: strings.addPage, image: UIImage(systemName: "doc.badge.plus")) {
                [weak self] _ in self?.addBlankPage()
            },
            UIAction(title: strings.photoLibrary, image: UIImage(systemName: "photo.on.rectangle")) {
                [weak self] _ in self?.presentPhotoPicker()
            },
        ]
        if UIImagePickerController.isSourceTypeAvailable(.camera) {
            items.append(
                UIAction(title: strings.takePhoto, image: UIImage(systemName: "camera")) {
                    [weak self] _ in self?.presentCamera()
                })
        }
        if pictures.values.contains(where: { !$0.isEmpty }) {
            items.append(
                UIAction(
                    title: strings.movePictures,
                    image: UIImage(systemName: "arrow.up.and.down.and.arrow.left.and.right")
                ) { [weak self] _ in self?.beginArrangingPictures() })
        }
        return items
    }

    // MARK: - Picking

    /// No photo-library permission: PHPicker runs out of process and hands
    /// over only what the student picked.
    func presentPhotoPicker() {
        var configuration = PHPickerConfiguration()
        configuration.filter = .images
        configuration.selectionLimit = 1
        let picker = PHPickerViewController(configuration: configuration)
        picker.delegate = self
        presentPicking(picker)
    }

    /// The capture goes onto the page and nowhere else — never into the photo
    /// library, which would need a second permission.
    func presentCamera() {
        guard UIImagePickerController.isSourceTypeAvailable(.camera) else { return }
        let camera = UIImagePickerController()
        camera.sourceType = .camera
        camera.delegate = self
        camera.modalPresentationStyle = .fullScreen
        presentPicking(camera)
    }

    /// Both pickers are dismissed in code, which `presentationControllerDidDismiss`
    /// never hears about — so a cancel gives the pens back itself, and a pick
    /// goes on to arranging. A swipe-away still reaches the delegate.
    private func presentPicking(_ controller: UIViewController) {
        controller.presentationController?.delegate = self
        if let tint { controller.view.tintColor = tint }
        toolPicker.setVisible(false, forFirstResponder: pdfView)
        present(controller, animated: true)
    }

    func picker(_ picker: PHPickerViewController, didFinishPicking results: [PHPickerResult]) {
        picker.dismiss(animated: true)
        guard let provider = results.first?.itemProvider,
            provider.hasItemConformingToTypeIdentifier(UTType.image.identifier)
        else { return showToolPicker() }
        provider.loadDataRepresentation(forTypeIdentifier: UTType.image.identifier) {
            [weak self] data, error in
            let picture = data.flatMap { PictureIngest.picture(from: $0) }
            DispatchQueue.main.async { self?.finishPicking(picture, error: error) }
        }
    }

    func imagePickerController(
        _ picker: UIImagePickerController,
        didFinishPickingMediaWithInfo info: [UIImagePickerController.InfoKey: Any]
    ) {
        picker.dismiss(animated: true)
        let image = info[.originalImage] as? UIImage
        DispatchQueue.global(qos: .userInitiated).async { [weak self] in
            let picture = image.flatMap { PictureIngest.picture(from: $0) }
            DispatchQueue.main.async { self?.finishPicking(picture, error: nil) }
        }
    }

    func imagePickerControllerDidCancel(_ picker: UIImagePickerController) {
        picker.dismiss(animated: true)
        showToolPicker()
    }

    private func finishPicking(_ picture: PictureIngest.Picture?, error: Error?) {
        if let picture, insertPicture(picture) { return }
        NSLog("PdfInk: picture could not be placed (\(String(describing: error)))")
        showToolPicker()
    }

    // MARK: - Placing

    /// On the page on screen, centred on the part of it that is visible, and
    /// selected — the next thing a student does with a new picture is put it
    /// where it belongs.
    @discardableResult
    func insertPicture(_ picture: PictureIngest.Picture) -> Bool {
        guard let document, let page = pdfView.currentPage else { return false }
        let index = document.index(for: page)
        let pageSize = InkPages.displayedSize(of: page)
        let middle = CGPoint(x: pdfView.bounds.midX, y: pdfView.bounds.midY)
        let center = overlays[index].map { $0.convert(middle, from: pdfView) }
            ?? CGPoint(x: pageSize.width / 2, y: pageSize.height / 2)
        let placed = PagePicture(
            id: UUID().uuidString,
            frame: PagePictures.initialFrame(
                imageSize: picture.pixelSize, pageSize: pageSize, around: center),
            jpeg: picture.jpeg)
        setPictures((pictures[index] ?? []) + [placed], onPage: index)
        beginArrangingPictures(selecting: (index, placed.id))
        NSLog("PdfInk: picture placed on page \(index), \(picture.jpeg.count) bytes")
        return true
    }

    /// The one writer. Shows the list, saves at once (a picture is placed far
    /// less often than a stroke is drawn), and registers its own reverse.
    func setPictures(_ list: [PagePicture], onPage index: Int) {
        let before = pictures[index] ?? []
        guard list != before else { return }
        pictures[index] = list.isEmpty ? nil : list
        overlays[index]?.pictureLayer.pictures = list
        if let selected = selectedPicture, selected.page == index,
            !list.contains(where: { $0.id == selected.id })
        {
            select(nil)
        }
        undoManagerForPictures?.registerUndo(withTarget: pictureUndoTarget) { [weak self] _ in
            self?.setPictures(before, onPage: index)
        }
        persistNow()
    }

    /// PencilKit's: the window's, reached from the page.
    var undoManagerForPictures: UndoManager? { pdfView.undoManager }

    /// Page indices under registered picture undos are stale after a page is
    /// added or removed, or the file changes.
    func forgetPictureUndo() {
        undoManagerForPictures?.removeAllActions(withTarget: pictureUndoTarget)
    }

    // MARK: - Arranging

    func beginArrangingPictures(selecting selection: (page: Int, id: String)? = nil) {
        arrangingPictures = true
        selectedPicture = selection
        toolPicker.setVisible(false, forFirstResponder: pdfView)
        navigationItem.rightBarButtonItems = [doneArrangingItem]
        emptyPageTap.isEnabled = true
        for (index, overlay) in overlays { applyPictureMode(to: overlay, page: index) }
    }

    func endArrangingPictures(restoringPens: Bool = true) {
        guard arrangingPictures else { return }
        arrangingPictures = false
        selectedPicture = nil
        navigationItem.rightBarButtonItems = fileToolItems
        emptyPageTap.isEnabled = false
        for (index, overlay) in overlays { applyPictureMode(to: overlay, page: index) }
        if restoringPens { showToolPicker() }
    }

    @objc func doneArrangingTapped() { endArrangingPictures() }

    /// Empty page ends arranging; a tap the picture layer takes does not.
    @objc func emptyPageTapped(_ tap: UITapGestureRecognizer) {
        guard arrangingPictures, tap.state == .ended else { return }
        for overlay in overlays.values
        where overlay.pictureLayer.takesTouch(at: tap.location(in: overlay.pictureLayer)) {
            return
        }
        endArrangingPictures()
    }

    func selectPicture(_ selection: (page: Int, id: String)?) {
        selectedPicture = selection
        for (index, overlay) in overlays {
            overlay.pictureLayer.selectedID = selection?.page == index ? selection?.id : nil
        }
    }

    /// Called for every overlay PDFKit asks for — so a page that scrolls in
    /// while arranging is not drawable either.
    func configurePictures(of overlay: PageOverlayView, page index: Int) {
        let layer = overlay.pictureLayer
        layer.pictures = pictures[index] ?? []
        layer.deleteLabel = strings.deletePicture
        layer.chromeScale = pictureChromeScale
        layer.onSelect = { [weak self] id in self?.selectPicture((index, id)) }
        layer.onCommit = { [weak self] list in self?.setPictures(list, onPage: index) }
        applyPictureMode(to: overlay, page: index)
    }

    func applyPictureMode(to overlay: PageOverlayView, page index: Int) {
        overlay.canvas.isUserInteractionEnabled = !arrangingPictures
        overlay.pictureLayer.arranging = arrangingPictures
        overlay.pictureLayer.selectedID =
            selectedPicture?.page == index ? selectedPicture?.id : nil
    }

    var pictureChromeScale: CGFloat { 1 / max(pdfView.scaleFactor, 0.01) }

    func canvas(onPage index: Int) -> PKCanvasView? { overlays[index]?.canvas }
}
```

- [ ] **Step 5: Run the whole Swift suite; expect all green** (82 + new). If `canvas(onPage: 0)` is nil in a test, PDFKit has not asked for overlays in the hostless window: call `reader.view.layoutIfNeeded()` and `pdfView.layoutDocumentView()` in the helper before asserting, and never weaken the assertion to `?? true`.
- [ ] **Step 6: Commit** `feat(pdf ink): put a picture on a page, arrange it, undo it`

---

### Task 7: privacy + tree guard

**Files:** `ios/App/App/Info.plist`, `docs/privacy-policy-app.md`, `src/test/guards/iosCameraUsage.test.ts`,
create `src/test/guards/inkPicturesAreIpadOnly.test.ts`.

- [ ] **Step 1: Failing guard tests.** In `iosCameraUsage.test.ts`, add:

```ts
  it('is present while the iPad ink reader can take a photo for a page', () => {
    expect(
      read('native/capacitor-pdf-ink/ios/Sources/PdfInkPlugin/PdfInkViewController+Pictures.swift')
    ).toMatch(/sourceType = \.camera/);
    expect(read('ios/App/App/Info.plist')).toMatch(/NSCameraUsageDescription<\/key>\s*<string>[^<]*iPad/);
  });
```
and in the policy test add `expect(...).toMatch(/\*\*iOS:\*\*[^\n]*(?:\n[^\n*]+)*notes/i)` — or simpler: assert the policy paragraph mentions "a picture on a page of your notes". Update the file's header comment: two reasons for the key now; removing the report picker no longer removes it.

`inkPicturesAreIpadOnly.test.ts`:

```ts
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

/**
 * Pictures on a page exist only in the iPad's native PencilKit reader.
 *
 * Not a tree split by choice: the ink reader itself is iPad-only
 * (`PdfInkPlugin.isAvailable` is true only on an iPad with iPadOS 16+), so the
 * iPhone, Android and the extension have no annotated page to put a picture on.
 * Everything a picture needs — placing, arranging, saving, exporting — is Swift
 * under native/capacitor-pdf-ink. The JS side only translates its strings.
 *
 * If an ink reader ever reaches another platform, pictures are part of it.
 */
const root = resolve(__dirname, '../../..');
const read = (p: string) => readFileSync(resolve(root, p), 'utf8');

const NATIVE = 'native/capacitor-pdf-ink/ios/Sources/PdfInkPlugin/';
const SHARED_STRING_FILES = [
  'src/mobile/pdfInk.ts',
  'src/hooks/ui/usePdfInkStrings.ts',
  'src/i18n/locales/en.json',
  'src/i18n/locales/cs.json',
];

describe('ink pictures are iPad-native only', () => {
  it('the native reader places, arranges and exports pictures', () => {
    expect(read(`${NATIVE}PdfInkViewController+Pictures.swift`)).toContain('PHPickerViewController');
    expect(read(`${NATIVE}InkExport.swift`)).toContain('pictures');
    expect(read(`${NATIVE}InkArchive.swift`)).toContain('pictures');
  });

  it('the reader is iPad-only, which is why no other tree has pictures', () => {
    expect(read(`${NATIVE}PdfInkPlugin.swift`)).toMatch(/userInterfaceIdiom == \.pad/);
  });

  it.each(SHARED_STRING_FILES)('%s carries only the reader’s picture strings', (file) => {
    expect(read(file)).toMatch(/photoLibrary/);
  });
});
```
(Verify the `isAvailable` check text in `PdfInkPlugin.swift` first and match it exactly.)

- [ ] **Step 2: Run** `npx vitest run src/test/guards/iosCameraUsage src/test/guards/inkPicturesAreIpadOnly` — expect the camera test to fail (plist text lacks "iPad").
- [ ] **Step 3:** Info.plist string →
  `reIS uses the camera only when you choose to take a photo: to attach it to a problem report, or to put it on a page of your notes in the iPad reader. / reIS použije fotoaparát jen tehdy, když se rozhodneš něco vyfotit: k hlášení problému, nebo na stránku svých poznámek ve čtečce na iPadu.`
  Policy iOS line → add "or, on an iPad, to put a picture on a page of your notes, where it stays on the device".
- [ ] **Step 4: Run** those guards plus every test that reads the policy (`noStudentDataLeaves`, `campusNavigationIsDormant`) and `npm run privacy:check` if it exists — expect pass.
- [ ] **Step 5: Commit** `docs(privacy): the camera also serves the iPad reader's pictures`

---

### Task 8: device verification and PR

- [ ] Release build of the app to the cabled iPad (memory `ipad-device`); screenshot the reader with the menu open is impossible (no taps), so: host the reader in the throwaway simulator app (memory `native-ui-pixel-evidence`), drive it with the simulator control tool — insert a picture via a launch-arg hook, take screenshots in arranging and drawing mode, light and dark, and of the exported PDF page. SendUserFile the PNGs.
- [ ] Write Dominik's device test script (checklist step 27) in the PR.
- [ ] `npm run typecheck`, the touched vitest files, the full Swift suite.
- [ ] Push, `gh pr create --base test`, enable Auto-fix; don't merge.
