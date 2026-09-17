import UIKit
import XCTest

@testable import PdfInkPlugin

/**
 * Hiding the reader's chrome so the page has the screen.
 *
 * Reported as "missing fullscreen when PDF editing". The reader is already a
 * full-screen presentation and the sidebar already defaults to `.secondaryOnly`,
 * so the navigation bar was the last thing over the page — and on an 11-inch
 * iPad in landscape that bar is a tenth of the height being drawn on.
 *
 * The way back cannot be a tap on the page: PencilKit takes every touch there
 * as ink, which is the whole reason for the mode. So there is a button, and
 * these tests are mostly about it existing exactly when the bar does not.
 */
@available(iOS 16.0, *)
final class ReaderFocusTests: XCTestCase {
    private func reader() -> (PdfInkViewController, UINavigationController) {
        let reader = PdfInkViewController(strings: PdfInkStrings(nil))
        let nav = UINavigationController(rootViewController: reader)
        reader.loadViewIfNeeded()
        return (reader, nav)
    }

    func testTheReaderStartsWithItsBar() {
        let (reader, nav) = self.reader()
        XCTAssertFalse(nav.isNavigationBarHidden)
        XCTAssertTrue(reader.restoreChromeButton.isHidden)
    }

    func testHidingTheChromeTakesTheBarAndLeavesAWayBack() {
        let (reader, nav) = self.reader()

        reader.setChromeHidden(true)

        XCTAssertTrue(nav.isNavigationBarHidden)
        XCTAssertFalse(
            reader.restoreChromeButton.isHidden,
            "with the bar gone this button is the only way back")
    }

    func testTheWayBackBringsTheBarBack() {
        let (reader, nav) = self.reader()
        reader.setChromeHidden(true)

        reader.setChromeHidden(false)

        XCTAssertFalse(nav.isNavigationBarHidden)
        XCTAssertTrue(reader.restoreChromeButton.isHidden)
    }

    /// The navigation controller outlives this screen, so a reader closed while
    /// focused would otherwise hand the next file a hidden bar and no way to
    /// know why.
    func testLeavingWhileFocusedRestoresTheBar() {
        let (reader, nav) = self.reader()
        reader.setChromeHidden(true)

        reader.viewWillDisappear(false)

        XCTAssertFalse(nav.isNavigationBarHidden)
        XCTAssertTrue(reader.restoreChromeButton.isHidden)
    }

    func testTheBarCarriesTheControlThatHidesIt() {
        let (reader, _) = self.reader()
        let labels = (reader.navigationItem.rightBarButtonItems ?? []).compactMap {
            $0.accessibilityLabel
        }
        XCTAssertTrue(labels.contains(PdfInkStrings(nil).focus))
    }
}
