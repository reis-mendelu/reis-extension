import PencilKit
import UIKit

/**
 * The tape: covers are made with a tool in the pen palette, like ink.
 *
 * Dominik's call on the first device build (2026-10-03): a `+` menu entry that
 * switched the page into a separate mode was not intuitive — "it should be a
 * pen". A `PKToolPickerCustomItem` (iOS 18) sits in the palette next to the
 * marker. While it is selected PencilKit stops the canvases drawing, and the
 * cover layer's drag takes the strokes instead.
 *
 * Before iOS 18 there is no custom palette item, so the palette is Apple's
 * default and covers can be opened and tested but not made. iPads stuck below
 * iPadOS 18 are the 6th generation and older.
 */
enum CoverTool {
    static let identifier = "cz.reis.ink.cover"

    /// The reader's palette: Apple's tools with the tape after the marker.
    static func makePicker(name: String) -> PKToolPicker {
        guard #available(iOS 18.0, *) else { return PKToolPicker() }
        var items = baseItems()
        let marker = items.firstIndex { $0.identifier == "com.apple.ink.marker" }
        items.insert(item(name: name), at: marker.map { $0 + 1 } ?? items.count)
        return PKToolPicker(toolItems: items)
    }

    /// The palette's selection as a tool a canvas can hold, or nil while the
    /// tape is in hand. `selectedTool` then answers with something PencilKit's
    /// own `PKCanvasView.tool` setter traps on ("Unknown PKTool type").
    static func canvasTool(of picker: PKToolPicker) -> PKTool? {
        guard #available(iOS 18.0, *) else { return picker.selectedTool }
        switch picker.selectedToolItem {
        case let item as PKToolPickerInkingItem: return item.inkingTool
        case let item as PKToolPickerEraserItem: return item.eraserTool
        case is PKToolPickerLassoItem: return PKLassoTool()
        default: return nil
        }
    }

    static func isSelected(in picker: PKToolPicker) -> Bool {
        guard #available(iOS 18.0, *) else { return false }
        return picker.selectedToolItemIdentifier == identifier
    }

    /// Apple's own list where the OS can say what it is (iOS 26); before
    /// that, the same tools as iPadOS 26 ships, less the reed pen it added.
    @available(iOS 18.0, *)
    private static func baseItems() -> [PKToolPickerItem] {
        if #available(iOS 26.0, *) { return PKToolPicker.defaultToolItems }
        return [
            PKToolPickerInkingItem(type: .pen),
            PKToolPickerInkingItem(type: .monoline),
            PKToolPickerInkingItem(type: .marker),
            PKToolPickerEraserItem(type: .fixedWidthBitmap),
            PKToolPickerLassoItem(),
            PKToolPickerRulerItem(),
            PKToolPickerInkingItem(type: .pencil),
            PKToolPickerInkingItem(type: .crayon),
            PKToolPickerInkingItem(type: .fountainPen),
            PKToolPickerInkingItem(type: .watercolor),
        ]
    }

    @available(iOS 18.0, *)
    static func item(name: String) -> PKToolPickerCustomItem {
        var configuration = PKToolPickerCustomItem.Configuration(identifier: identifier, name: name)
        configuration.imageProvider = { _ in image }
        configuration.allowsColorSelection = false
        configuration.toolAttributeControls = []
        return PKToolPickerCustomItem(configuration: configuration)
    }

    /// A roll of grey tape standing in the palette like the pens beside it.
    /// PencilKit wants it at least 150 pt tall; it shows the top of it.
    private static let image: UIImage = {
        let size = CGSize(width: 36, height: 160)
        let format = UIGraphicsImageRendererFormat()
        format.opaque = false
        return UIGraphicsImageRenderer(size: size, format: format).image { context in
            let body = UIBezierPath(
                roundedRect: CGRect(x: 4, y: 26, width: 28, height: 134), cornerRadius: 7)
            UIColor(white: 0.30, alpha: 1).setFill()
            body.fill()
            // The tape itself: a light strip folded over the top, like the
            // block it leaves on the page.
            let tape = UIBezierPath(
                roundedRect: CGRect(x: 4, y: 8, width: 28, height: 34), cornerRadius: 5)
            UIColor(white: 0.82, alpha: 1).setFill()
            tape.fill()
            UIColor(white: 0.62, alpha: 1).setStroke()
            let edge = UIBezierPath()
            edge.move(to: CGPoint(x: 8, y: 34))
            edge.addLine(to: CGPoint(x: 28, y: 34))
            edge.lineWidth = 1.5
            edge.setLineDash([3, 2], count: 2, phase: 0)
            edge.stroke()
            _ = context
        }
    }()
}
