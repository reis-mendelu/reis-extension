import UIKit
import XCTest

@testable import PdfInkPlugin

/**
 * The hint's border is a CGColor, which does not follow the appearance on its
 * own. iOS 17+ re-resolves it through `registerForTraitChanges`; below that
 * (the plugin's floor is iOS 15) `traitCollectionDidChange` has to (cubic,
 * 5.4.0 release diff). A simulator on iOS 17+ exercises the first path only.
 */
final class TapeHintViewTests: XCTestCase {
    func testTheBorderFollowsALightDarkSwitch() {
        let window = UIWindow(frame: CGRect(x: 0, y: 0, width: 400, height: 200))
        window.overrideUserInterfaceStyle = .light
        let hint = TapeHintView(frame: CGRect(x: 0, y: 0, width: 300, height: 60))
        window.addSubview(hint)
        window.isHidden = false
        window.layoutIfNeeded()
        let light = UIColor.separator.resolvedColor(with: UITraitCollection(userInterfaceStyle: .light))
        let dark = UIColor.separator.resolvedColor(with: UITraitCollection(userInterfaceStyle: .dark))
        XCTAssertEqual(hint.layer.borderColor, light.cgColor)

        window.overrideUserInterfaceStyle = .dark
        window.layoutIfNeeded()

        XCTAssertEqual(hint.layer.borderColor, dark.cgColor, "the border stayed in the old appearance")
        window.isHidden = true
    }
}
