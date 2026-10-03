import Capacitor
import Foundation

/**
 * Copy the reader shows, translated by the app and passed in with `open`. The
 * English fallbacks only ever show if the JS side forgot a key; the i18n guard
 * test makes that unlikely. Most bar buttons are system items and need no strings.
 */
struct PdfInkStrings {
    let saveFailedTitle: String
    let saveFailedMessage: String
    let keepEditing: String
    let discard: String
    let openFailed: String
    let addPage: String
    let export: String
    let exportFailed: String
    let close: String
    let pages: String
    let search: String
    let page: String
    let noMatches: String
    let removePage: String
    let focus: String
    let exitFocus: String
    let cancel: String
    let add: String
    let photoLibrary: String
    let takePhoto: String
    let chooseFile: String
    let underInk: String
    let overInk: String
    let more: String
    let movePictures: String
    let deletePicture: String
    let done: String
    /// The tape: the palette tool that makes covers (`CoverTool`).
    let cover: String
    /// "Vyzkoušet se": the bar entry, the reveal, the two answers, the counter
    /// ("{n}" / "{total}"), leaving early, the retry, and the score
    /// ("{known}" / "{total}").
    let recallStart: String
    let recallReveal: String
    let recallKnew: String
    let recallNotYet: String
    let recallProgress: String
    let recallEnd: String
    let recallRetry: String
    let recallScore: String

    init(_ object: JSObject?) {
        saveFailedTitle = object?["saveFailedTitle"] as? String ?? "Your ink couldn't be saved"
        saveFailedMessage =
            object?["saveFailedMessage"] as? String
            ?? "There may be no space left on this iPad."
        keepEditing = object?["keepEditing"] as? String ?? "Keep editing"
        discard = object?["discard"] as? String ?? "Discard"
        openFailed = object?["openFailed"] as? String ?? "Couldn't open this file."
        addPage = object?["addPage"] as? String ?? "Add a page"
        export = object?["export"] as? String ?? "Share with notes"
        exportFailed = object?["exportFailed"] as? String ?? "Couldn't prepare the file to share."
        close = object?["close"] as? String ?? "Close"
        pages = object?["pages"] as? String ?? "Pages"
        search = object?["search"] as? String ?? "Search"
        page = object?["page"] as? String ?? "Page"
        noMatches = object?["noMatches"] as? String ?? "Nothing found"
        removePage = object?["removePage"] as? String ?? "Remove page"
        focus = object?["focus"] as? String ?? "Hide the toolbar"
        exitFocus = object?["exitFocus"] as? String ?? "Show the toolbar"
        cancel = object?["cancel"] as? String ?? "Cancel"
        add = object?["add"] as? String ?? "Add"
        photoLibrary = object?["photoLibrary"] as? String ?? "Choose photo"
        takePhoto = object?["takePhoto"] as? String ?? "Take photo"
        chooseFile = object?["chooseFile"] as? String ?? "Choose file"
        underInk = object?["underInk"] as? String ?? "Under the notes"
        overInk = object?["overInk"] as? String ?? "Over the notes"
        more = object?["more"] as? String ?? "More"
        movePictures = object?["movePictures"] as? String ?? "Edit pictures"
        deletePicture = object?["deletePicture"] as? String ?? "Delete picture"
        done = object?["done"] as? String ?? "Done"
        cover = object?["cover"] as? String ?? "Tape"
        recallStart = object?["recallStart"] as? String ?? "Test me"
        recallReveal = object?["recallReveal"] as? String ?? "Show"
        recallKnew = object?["recallKnew"] as? String ?? "I know it"
        recallNotYet = object?["recallNotYet"] as? String ?? "Not yet"
        recallProgress = object?["recallProgress"] as? String ?? "{n} of {total}"
        recallEnd = object?["recallEnd"] as? String ?? "End"
        recallRetry = object?["recallRetry"] as? String ?? "Repeat the ones I don't know yet"
        recallScore = object?["recallScore"] as? String ?? "You know {known} of {total}"
    }

    /// Puts numbers into copy that came from the app's i18n, which marks them
    /// `{name}` (src/i18n/translate.ts). A placeholder with no value is left as is.
    static func fill(_ template: String, _ values: [String: Int]) -> String {
        values.reduce(template) { text, pair in
            text.replacingOccurrences(of: "{\(pair.key)}", with: String(pair.value))
        }
    }
}
