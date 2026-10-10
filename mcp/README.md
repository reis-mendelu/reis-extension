# reIS for Claude

Your IS Mendelu data in Claude Desktop: timetable, exams, grades, deadlines and subject files. It runs on your own computer.

## Install

1. Download `reis-for-claude.mcpb` from the latest `mcp-v*` release on [GitHub](https://github.com/reis-mendelu/reis-extension/releases).
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
- It never sends anything to reIS. It talks to `is.mendelu.cz` (over HTTPS only) and to the public reIS statistics on `cdn.jsdelivr.net`, nothing else.
- Your password is stored in your system keychain by Claude Desktop and is sent only to `is.mendelu.cz` to sign in.
- A wrong password is not retried while the extension runs, and any failed sign-in waits a minute before the next one. Restarting Claude Desktop starts a fresh attempt.

Whatever Claude reads goes to Claude like anything else you share in a chat.

## Limits

- Accounts with two-factor sign-in are not supported yet.
- Updates are manual until reIS for Claude is listed in Claude's directory: download the new release and open it again.

## Build

```bash
npm run mcp:pack     # → dist-mcp/reis-for-claude.mcpb
npm run mcp:smoke    # builds, then checks the server over stdio
```

Unofficial. IS Mendelu belongs to Mendel University in Brno.
