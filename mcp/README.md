# reIS for Claude

Your IS Mendelu data in Claude Desktop: timetable, exams, grades, deadlines and subject files. It runs on your own computer.

## Install

> No `mcp-v*` release is published yet, so there is nothing to download until the first one is.

For a step-by-step guide in Czech and English, see [INSTALL.md](INSTALL.md).

1. Download `reis-for-claude.mcpb` from the [latest release](https://github.com/reis-mendelu/reis-for-claude/releases/latest/download/reis-for-claude.mcpb) (guide: [reisapp.cz/navody/reis-v-claude](https://reisapp.cz/navody/reis-v-claude)).
2. Double-click it, or drag it into Claude Desktop.
3. Enter your IS Mendelu username and password when Claude Desktop asks.

Then ask Claude things like "what's due this week?" or "explain lecture 7 of Počítačové sítě".

## What Claude can read

| Tool | What it returns |
| --- | --- |
| `mendelu_overview` | Start here: what changed in IS since last time, then your subjects with points and files, open assignments, exam terms and the next 7 days. Downloads no file |
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
| `mendelu_search` | Searches the text of the course files reIS has saved, in every subject at once (case and diacritics do not matter), plus file names and dates. Works offline and asks IS nothing |
| `mendelu_forget_everything` | Deletes everything reIS saved on your computer (see below). Claude calls it only when you ask |

## What it never does

- It never registers you for anything, never submits anything, and never opens online tests.
- It never sends anything to reIS. It talks to `is.mendelu.cz` (over HTTPS only), to the public reIS statistics on `cdn.jsdelivr.net`, and once per start to `api.github.com` to ask whether a newer release of the `.mcpb` exists (a GET with no login or IS data in it; GitHub sees your IP address, as any website does; the Claude Code plugin does not ask). Nothing else.
- Your password is stored in your system keychain by Claude Desktop and is sent only to `is.mendelu.cz` to sign in. It, and IS's sign-in cookie, are never written to disk by reIS.
- A wrong password is not retried while the extension runs, and any failed sign-in waits a minute before the next one. Restarting Claude Desktop starts a fresh attempt.

Whatever Claude reads goes to Claude like anything else you share in a chat.

## What it saves on your computer

reIS for Claude keeps a local copy of what Claude read, so Claude can start from it instead of forgetting it every time you reload Claude Desktop or open a new Claude Code window. **It is on by default and never leaves your computer**: reIS has no server for it and sends nothing anywhere.

Saved, as plain files you can open:

- the list of your subjects (code, name, IS id);
- each subject's file list: file names, dates and download links;
- the **whole text** of every file Claude reads (the answer Claude sees is cut at 25,000 characters; the saved copy is not);
- your study programme, form, year and semester;
- a short record of what `mendelu_overview` last told Claude was new (each file's name and date, a fingerprint of each row of your points rather than the points themselves, assignment names and deadlines, exam term dates): it lets the next overview tell you only what is new, and your points are not saved in readable form, only a fingerprint.

Never saved: your password or IS's sign-in cookie. The study profile holds no name, student number or e-mail, but file names and the text of files are kept exactly as they are, so anything written in them is kept too.

Where (one folder per computer account, shared by Claude Desktop and Claude Code):

| System | Folder |
| --- | --- |
| macOS | `~/Library/Application Support/reIS for Claude` |
| Windows | `%LOCALAPPDATA%\reIS for Claude` |
| Linux | `$XDG_DATA_HOME/reIS for Claude`, or `~/.local/share/reIS for Claude` |

It takes up to 4 GB, then the oldest copies are removed. It is not tied to your IS login, so if you share a computer account with someone else, delete it before handing over. Uninstalling the extension does **not** delete it.

**To delete it:** ask Claude to "forget everything reIS saved" (it runs `mendelu_forget_everything`, deletes the folder's contents and says what it removed), or delete the folder yourself (with Claude closed: a file being downloaded at that moment would be saved again). If the folder cannot be written, reIS says so and works from memory until Claude closes.

## Repeated questions

Asking IS is kept to what is cheap. A file's text is read from the saved copy as long as its folder still shows the same modified date and the text was read on a later day than that date (IS shows no time of day, so an edit made the same day cannot be told apart), even after a restart; a different date, a file read the day it was modified, or a file read before its folder was listed, is downloaded again. The lists (subjects, file lists, points, assignments, exams, the timetable) always come from IS, and within one Claude run an answer is also kept in memory for a while so asking the same thing twice does not ask IS twice: a minute for assignments, exams, points and grades (what you or a teacher can change while you wait), 5 minutes for a subject's file list, 15 for the timetable, an hour for subjects, the study plan and a file's text, and a day for syllabi. Pass rates are not kept here: their own fetcher keeps them and asks again for any subject it could not get. A file is read again as soon as its folder shows a different date for it.

## Limits

- Accounts with two-factor sign-in are not supported yet.
- Updates are manual until reIS for Claude is listed in Claude's directory: download the new release and open it again.

## Build

```bash
npm run mcp:pack     # → dist-mcp/reis-for-claude.mcpb
npm run mcp:smoke    # builds, then checks the server over stdio
npm run mcp:plugin   # → dist-plugin/reis, the Claude Code plugin (hands files over whole, no officeparser)
```

Unofficial. IS Mendelu belongs to Mendel University in Brno.
