# reIS for Claude

Your IS Mendelu data in Claude Desktop: timetable, exams, grades, deadlines and subject files. It runs on your own computer.

## Install

For a step-by-step guide in Czech and English, see [INSTALL.md](INSTALL.md).

1. Download `reis-for-claude.mcpb` from the [latest release](https://github.com/reis-mendelu/reis-for-claude/releases/latest/download/reis-for-claude.mcpb) (guide: [reisapp.cz/navody/reis-v-claude](https://reisapp.cz/navody/reis-v-claude)).
2. Double-click it, or drag it into Claude Desktop.
3. Enter your IS Mendelu username and password when Claude Desktop asks.

Then ask Claude things like "what's due this week?" or "explain lecture 7 of Počítačové sítě".

## What Claude can read

| Tool | What it returns |
| --- | --- |
| `mendelu_schedule` | Your timetable for today and the next 14 days; ask for any other dates this semester |
| `mendelu_exams` | Exam and credit terms, registered and still open |
| `mendelu_subjects` | Subjects you are enrolled in this semester |
| `mendelu_study_plan` | Your study plan and credits |
| `mendelu_syllabus` | One subject's syllabus and requirements |
| `mendelu_subject_files` | Files in a subject's IS document folder |
| `mendelu_read_file` | The text of one of those files: PDF, DOCX, PPTX, XLSX, ODT, ODP, ODS and plain text (not the old .doc/.ppt/.xls), up to 30 MB |
| `mendelu_success_rates` | Historical pass rates of subjects (public reIS statistics) |
| `mendelu_grades` | Your grades and credits so far |
| `mendelu_assignments` | Your submission boxes and their deadlines |

## What it never does

- It never registers you for anything, never submits anything, and never opens online tests.
- It never sends anything to reIS. It talks to `is.mendelu.cz` (over HTTPS only), to the public reIS statistics on `cdn.jsdelivr.net`, and once per start to `api.github.com` to ask whether a newer release of the `.mcpb` exists (a GET with no login or IS data in it; GitHub sees your IP address, as any website does; the Claude Code plugin does not ask). Nothing else.
- Your password is stored in your system keychain by Claude Desktop and is sent only to `is.mendelu.cz` to sign in.
- A wrong password is not retried while the extension runs, and any failed sign-in waits a minute before the next one. Restarting Claude Desktop starts a fresh attempt.

Whatever Claude reads goes to Claude like anything else you share in a chat.

## Repeated questions

Answers from IS stay in the extension's memory for a while, so Claude asking the same thing twice does not ask IS twice: a minute for assignments, exams, points and grades (what you or a teacher can change while you wait), 5 minutes for a subject's file list, 15 for the timetable, an hour for subjects, the study plan and a file's text, and a day for syllabi. Pass rates are not kept here: their own fetcher keeps them and asks again for any subject it could not get. A file is read again as soon as its folder shows a different date for it. Nothing is written to disk; it is all gone when Claude closes.

## Limits

- Accounts with two-factor sign-in are not supported yet.
- Claude Desktop does not update a `.mcpb` by itself: when a new release is out, reIS says so under its answers; download it and open it again. The Claude Code plugin updates itself once auto-update is on (see [INSTALL.md](INSTALL.md)). Releases come out with the reIS app, whenever reIS for Claude changed.

## Build

```bash
npm run mcp:pack     # → dist-mcp/reis-for-claude.mcpb
npm run mcp:smoke    # builds, then checks the server over stdio
npm run mcp:plugin   # → dist-plugin/reis, the Claude Code plugin (hands files over whole, no officeparser)
```

Unofficial. IS Mendelu belongs to Mendel University in Brno.
