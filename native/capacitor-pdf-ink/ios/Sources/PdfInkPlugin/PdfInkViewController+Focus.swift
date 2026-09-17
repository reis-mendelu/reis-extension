import UIKit

/**
 * Putting the reader's chrome away so the page has the screen.
 *
 * Its own file because it is its own job, and because the controller it hangs
 * off is long enough — raised in review on the PR that added this. The two
 * stored properties (`chromeHidden`, `restoreChromeButton`) stay on the class:
 * a Swift extension cannot hold stored state, and pretending otherwise would
 * mean a second object to keep in step with the first.
 */
@available(iOS 16.0, *)
extension PdfInkViewController {
    /**
     * The button that brings the bar back.
     *
     * It cannot live in the bar, because the bar is what went away, and it
     * cannot be a tap on the page: PencilKit takes every touch there as ink,
     * which is the whole point of the mode. So it is a small button in the
     * corner the bar's own trailing items were in, translucent enough to read
     * over a white page and over a dark one.
     */
    static func makeRestoreChromeButton(target: Any, action: Selector) -> UIButton {
        var config = UIButton.Configuration.plain()
        config.image = UIImage(systemName: "arrow.down.right.and.arrow.up.left")
        config.background.backgroundColor = .tertiarySystemFill
        config.background.cornerRadius = 18
        config.contentInsets = NSDirectionalEdgeInsets(top: 9, leading: 9, bottom: 9, trailing: 9)
        let button = UIButton(configuration: config)
        button.addTarget(target, action: action, for: .touchUpInside)
        button.translatesAutoresizingMaskIntoConstraints = false
        button.isHidden = true
        return button
    }
}
