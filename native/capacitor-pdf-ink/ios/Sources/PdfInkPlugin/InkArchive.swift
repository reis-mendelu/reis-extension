import CoreGraphics
import Foundation

/**
 * The on-disk shape of one PDF's ink: a binary property list of
 * `{version, pageCount, pages: [pageIndex: PKDrawing.dataRepresentation()],
 * insertedPages: [pageIndex]}`.
 *
 * Foundation only — no PencilKit, no UIKit — so it can be unit-tested and so the
 * format is readable without a canvas. `pageCount` is what the PDF had when the
 * ink was saved; the reader lays ink over the current PDF by page index and keeps
 * (but does not show) ink for pages that no longer exist.
 *
 * `insertedPages` are the blank pages the student added, as indices in the
 * document they were looking at — the PDF itself is never rewritten, so the
 * reader puts them back on every open (InkPages.apply). Version 2 files carry it;
 * version 1 files have no such key and read as an empty list.
 *
 * Version 3 first held `covers`, bare rectangles from a cover tool that was
 * withdrawn on 2026-09-07 and only ever ran in dev builds. `coverCards`
 * (2026-10-03) is its return: covers with ids and an answer history, an
 * ADDITIVE key for the same reason as `pictures` below. A file that still has
 * the old `covers` key is converted on read (`legacyCovers`); the old key is
 * never written again. The version stays at 3: dropping back to 2 would make
 * every archive already on a device a "newer version", and `decode` quarantines
 * those — the ink would go with them.
 *
 * `pictures` (2026-10-03) are the photos the student put on pages, per page in
 * stacking order, as `PagePicture`s. The key is ADDITIVE and the version did not
 * move, for the same reason: a bump would make an older build quarantine the
 * whole file, ink included. The cost runs the other way and is smaller — an
 * older build (another worktree's, installed over this one) ignores the key,
 * drops the pictures on its next save, and deletes an archive whose only
 * content is pictures. Files without the key read as having none.
 */
struct InkArchive: Codable, Equatable {
    static let currentVersion = 3

    var version: Int
    var pageCount: Int
    var pages: [Int: Data]
    var insertedPages: [Int]
    var pictures: [Int: [PagePicture]]
    var coverCards: [Int: [PageCover]]

    init(
        pageCount: Int, pages: [Int: Data], insertedPages: [Int] = [],
        pictures: [Int: [PagePicture]] = [:], coverCards: [Int: [PageCover]] = [:]
    ) {
        self.version = Self.currentVersion
        self.pageCount = pageCount
        self.pages = pages
        self.insertedPages = insertedPages
        self.pictures = pictures
        self.coverCards = coverCards
    }

    /// Hand-written so a missing `insertedPages`, `pictures` or `coverCards` reads as
    /// empty: the synthesised initialiser fails on an absent key even with a default.
    /// A `covers` key left by the withdrawn tool is converted (`legacyCovers`).
    init(from decoder: Decoder) throws {
        let container = try decoder.container(keyedBy: CodingKeys.self)
        version = try container.decode(Int.self, forKey: .version)
        pageCount = try container.decode(Int.self, forKey: .pageCount)
        pages = try container.decode([Int: Data].self, forKey: .pages)
        insertedPages = try container.decodeIfPresent([Int].self, forKey: .insertedPages) ?? []
        pictures =
            try container.decodeIfPresent([Int: [PagePicture]].self, forKey: .pictures) ?? [:]
        coverCards =
            try container.decodeIfPresent([Int: [PageCover]].self, forKey: .coverCards)
            ?? Self.legacyCovers(from: decoder)
    }

    /// The withdrawn tool's key. Read here and nowhere else; `CodingKeys` (the
    /// synthesised one, which `encode` uses) does not have it, so it is never
    /// written.
    private enum LegacyKeys: String, CodingKey { case covers }

    /// Bare rectangles become covers with fresh ids and no answers. Anything
    /// unreadable is dropped rather than thrown: the ink must still open.
    private static func legacyCovers(from decoder: Decoder) -> [Int: [PageCover]] {
        guard let legacy = try? decoder.container(keyedBy: LegacyKeys.self),
            let rects = try? legacy.decodeIfPresent([Int: [CGRect]].self, forKey: .covers)
        else { return [:] }
        return rects.mapValues { $0.map { PageCover(rect: $0) } }
    }

    func encoded() throws -> Data {
        let encoder = PropertyListEncoder()
        encoder.outputFormat = .binary
        return try encoder.encode(self)
    }

    /// Fails on junk and on a file written by a NEWER reIS: reading it with an
    /// older decoder could silently drop strokes, and the caller quarantines the
    /// file instead.
    static func decode(_ data: Data) throws -> InkArchive {
        let archive = try PropertyListDecoder().decode(InkArchive.self, from: data)
        guard archive.version <= currentVersion else {
            throw InkArchiveError.unsupportedVersion(archive.version)
        }
        return archive
    }
}

enum InkArchiveError: Error, Equatable {
    case unsupportedVersion(Int)
}
