# reIS for Claude in Claude's directory: plan

Status 2026-10-26: built (`npm run mcp:plugin`), published to the public repo
`reis-mendelu/reis-for-claude` and submitted to Claude's directory from `main @ f774c18`,
listed on Claude Code only. Waiting on Anthropic's review. Updates to that repo are by hand
until a release step pushes them.

## Goal

A student finds reIS for Claude in Claude's plugin directory, installs it, and it
updates by itself. The `.mcpb` download stays as it is, file reading included.

## What we checked (2026-10-26)

| Question | Answer | Evidence |
| --- | --- | --- |
| Does the bundle fit the directory? | Yes, without officeparser | 10.0 MB today. officeparser = 6.8 MB, happy-dom 2.4 MB. Without officeparser: 3.5 MB readable, 1.7 MB minified. The limit where validation stops is 5 MiB per file. |
| Can Claude Code read a file the server hands over? | **Yes**, up to 10 MB tested | The tool returns the file as an embedded MCP resource. Claude Code saves it itself and Claude reads it. Tested in headless `claude -p` with PDFs of 18 KB, 1.3 MB (231 pages) and 9.4 MB, plus a DOCX. |
| Do Word files work? | Yes, but Claude has to improvise | Claude unzipped the DOCX and read `word/document.xml`. Windows has no `unzip`, so a skill should say how. |
| Does the server need to write to disk? | **No** | Claude Code saves the resource. This replaces the earlier idea of having the server save files. |
| Size ceiling in Claude Code | **About 11.5 MiB per file** | Claude Code drops a server whose message passes 16 MiB, and base64 adds a third. 11.5 MiB arrived; 12, 15, 20 and 29 MiB closed the connection, and every reIS tool went with it. The plugin caps documents at 10 MB (`MAX_DOCUMENT_BYTES`). |
| Live against real IS | Works | EBC-PS lectures, 2.2 MB (51 pages) and a 65-page PDF, read through the plugin build. |
| Cowork | **No, not with userConfig** | Claude Desktop's own code (app.asar, `PluginMcpHostConfig`) drops a plugin server that references `${user_config.*}` ("user_config is not supported on the desktop host bridge; dropping server"). The server would run on the Mac, not in Cowork's VM. A plugin that ships an `.mcpb` instead (`mcpServers: "./x.mcpb"`) takes a separate path there that may support settings. Untested, and a bundled `.mcpb` is held for a reviewer. |

## Target for v1

**Claude Code only**, the one surface where both the password prompt (`userConfig`,
`sensitive`) and file hand-over have been seen to work. Audience: Pro and higher,
since Free accounts can't browse the directory. Cowork waits for the probe result.

## Build

1. `mcp/files.ts`: split fetching from text extraction. `fetchDokServerFile(url)` returns
   bytes, media type and filename. The checks stay as they are: `assertDokServerUrl`,
   `readCapped`, and the 30 MB cap.
2. `mcp/extract.ts` (officeparser, `.mcpb`) and `mcp/extract.plugin.ts` (returns the file
   as an embedded resource). `vite.mcp.plugin.config.ts` aliases the first to the second,
   so officeparser and the pdfjs `DOMMatrix` shims leave the plugin build.
3. `mendelu_read_file` description by build: the plugin build says it returns the file
   itself, not its text.
4. Tests first, under `npx vitest run mcp/`: the plugin mode returns a resource with the
   right mime type and filename; an unsupported type still returns the note and never
   downloads.

## Checks on what ships (extend `scripts/mcp-pack.mjs`)

- Same promises as the `.mcpb`: exact file list, no `dev-real-data` snapshot, no Supabase
  host, the fatal-on-import check.
- New: the bundle is under 5 MiB, and the build fails if `officeparser` or `pdfjs` is in it.

## Plugin folder

```
.claude-plugin/plugin.json   name, version, userConfig: username, password (sensitive)
server/index.mjs             the plugin build, unminified (readable for the security scan)
skills/reading-is-files/     how to read PDF (Read) and DOCX/PPTX/XLSX (unzip the XML), on macOS and Windows
README.md                    40+ words: what it reads, the two hosts it talks to, what it never does
LICENSE                      Apache-2.0
```

Server command: `node ${CLAUDE_PLUGIN_ROOT}/server/index.mjs`, with
`MENDELU_USER=${user_config.username}` and `MENDELU_PASS=${user_config.password}`
(`mcp/server.ts` already reads both). Check it with `claude plugin validate`, then the
portal's **Validate**.

## Release

`mcp-v*` builds both: the `.mcpb` as a GitHub release asset, and the plugin folder pushed
to the repository the directory tracks. That push needs a token, because a push made with
`GITHUB_TOKEN` starts no other workflow (the same reason `ship.yml` is one run).

## Expected reviewer holds (reviews, not rejections)

- `server/index.mjs` is over 256 KiB.
- The name, if it contains `mendelu` (another party's brand) or `claude` (reserved).
- Policy §3.F, "own or control any API endpoint … their Software connects to": we don't
  own is.mendelu.cz. Possibly a plugin exception; unconfirmed.

## Decisions for Dominik

1. **Where the plugin lives**: a new public repo `reis-mendelu/reis-for-claude`
   (recommended: plugin at the repo root means fewer holds and a clear owner), or a
   branch of this repo.
2. **Which account submits**: the first organization to submit owns the listing for good.
3. **Plugin name**: `reis` is the safest.
