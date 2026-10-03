import XCTest

@testable import PdfInkPlugin

final class PdfInkStringsTests: XCTestCase {
    func testTheTapeHasAnEnglishFallback() {
        XCTAssertEqual(PdfInkStrings(nil).cover, "Tape")
    }
}
