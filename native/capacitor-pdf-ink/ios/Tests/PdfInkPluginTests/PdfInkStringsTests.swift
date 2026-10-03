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
