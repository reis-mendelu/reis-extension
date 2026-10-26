import ImageIO
import UIKit
import UniformTypeIdentifiers

/**
 * A photo turned into what a page stores — once, when it is inserted.
 *
 * - **At most 2048 px on the long side.** Sharp on a page at any zoom the reader
 *   reaches. Measured on the simulator: a detailed 2048×1536 photo (flowers)
 *   stores at 1.34 MB — a whiteboard far less — against several MB for the
 *   12 MP original. ImageIO's
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
        CGImageSourceCreateWithData(data as CFData, nil).flatMap(picture(from:))
    }

    /// From a file (Files). ImageIO reads it from disk as it needs to, rather
    /// than the whole file being loaded first: a scan or TIFF from Files can
    /// be far bigger than any photo, and only the thumbnail is ever wanted.
    static func picture(at url: URL) -> Picture? {
        CGImageSourceCreateWithURL(url as CFURL, [kCGImageSourceShouldCache: false] as CFDictionary)
            .flatMap(picture(from:))
    }

    private static func picture(from source: CGImageSource) -> Picture? {
        guard let props = CGImageSourceCopyPropertiesAtIndex(source, 0, nil) as? [CFString: Any],
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
