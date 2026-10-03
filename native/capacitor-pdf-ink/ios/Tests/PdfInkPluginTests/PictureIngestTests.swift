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
