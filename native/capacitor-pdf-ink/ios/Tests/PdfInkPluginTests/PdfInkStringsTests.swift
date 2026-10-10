import XCTest

@testable import PdfInkPlugin

final class PdfInkStringsTests: XCTestCase {
    func testTheTapeHasAnEnglishFallback() {
        XCTAssertEqual(PdfInkStrings(nil).cover, "Tape")
        XCTAssertEqual(PdfInkStrings(nil).deleteTape, "Delete tape")
        XCTAssertEqual(
            PdfInkStrings(nil).tapeHint,
            "Tape over an answer and try to recall it. Tap the tape to peek; hold it to delete or move it.")
    }
}
