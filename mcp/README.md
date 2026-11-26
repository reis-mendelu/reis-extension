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
| `mendelu_overview` | Start here: what changed in IS since last time, then your subjects with points and files, open assignments, exam terms and the next 7 days. Downloads no file |
| `mendelu_schedule` | Your timetable for today and the next 14 days; ask for any other dates this semester |
| `mendelu_exams` | Exam and credit terms, registered and still open |
| `mendelu_subjects` | Subjects you are enrolled in this semester |
| `mendelu_study_plan` | Your study plan and credits |
| `mendelu_syllabus` | One subject's syllabus and requirements |
| `mendelu_subject_files` | Files in a subject's IS document folder, with the path of each one already saved on your computer |
| `mendelu_read_file` | The text of one of those files: PDF, DOCX, PPTX, XLSX, ODT, ODP, ODS and plain text (not the old .doc/.ppt/.xls), up to 30 MB |
| `mendelu_success_rates` | Historical pass rates of subjects (public reIS statistics) |
| `mendelu_grades` | Your grades and credits so far |
| `mendelu_assignments` | Your submission boxes and their deadlines |
| `mendelu_search` | Searches the text of the course files reIS has saved, in every subject at once (case and diacritics do not matter), plus file names and dates. Works offline and asks IS nothing |
| `mendelu_ledger` | The list of your upcoming tests, credit tests, defences, programme days and events, which Claude keeps for you: it saves every date it finds in a harmonogram, a project brief or a mail, and `mendelu_overview` then lists them soonest first with the days left (and marks one "recheck" when the file it came from was replaced). Asks IS nothing, writes nothing to IS or to your calendar |
| `mendelu_build_my_map` | Saves every file of every subject's IS folder on your computer at once (originals, zips as they are, plus their text). First a dry run that downloads nothing and says how many files of which types each subject has (IS lists no sizes, so the total size is unknown until download); then the download, which skips files already saved and unchanged, stops at the size limit and says what it skipped. Only reads from IS |
| `mendelu_refresh` | The call your scheduled digest makes: refreshes the lists from IS, says what changed since the last refresh, downloads new or replaced files of subjects already saved (within the size limit; a first refresh compares with the last `mendelu_overview`, or only takes a baseline if the overview never ran), and lists the events of the next 14 days and the ones to recheck. Only reads from IS; never sends mail or writes a calendar |
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
- the **original files** themselves, exactly as IS serves them (PDFs, slides, zips still zipped, data files): one each time Claude reads a file, and all of them at once when you ask Claude to build your map (`mendelu_build_my_map`). They sit in `originals/`, one folder per file named after a fingerprint of its download link, with the file's own name made safe (no folders, no characters a system would misread), and `mendelu_overview` gives Claude each one's path so it can open it directly. A file whose IS folder still shows the same modified date is not downloaded again;
- your study programme, form, year and semester;
- the **list of upcoming events** Claude keeps with `mendelu_ledger`: for each, its title, date and time, kind (test, defence, programme day …), subject code, room, the rule that matters (for example minimum points), the unregistration deadline, and where the date came from (a file name and its date, a mail, or you); Claude writes it, reIS only stores it and never writes to your calendar;
- a second record like it for `mendelu_refresh` (`refresh/seen.json`, the same fingerprints and the time of the last refresh), so the digest tells you what is new since the last digest even if you asked the overview in between;
- a short record of what `mendelu_overview` last told Claude was new (each file's name and date, a fingerprint of each row of your points rather than the points themselves, assignment names and deadlines, exam term dates): it lets the next overview tell you only what is new, and your points are not saved in readable form, only a fingerprint.

Never saved: your password or IS's sign-in cookie. The study profile holds no name, student number or e-mail, but file names and the text of files are kept exactly as they are, so anything written in them is kept too.

Where (one folder per computer account, shared by Claude Desktop and Claude Code):

| System | Folder |
| --- | --- |
| macOS | `~/Library/Application Support/reIS for Claude` |
| Windows | `%LOCALAPPDATA%\reIS for Claude` |
| Linux | `$XDG_DATA_HOME/reIS for Claude`, or `~/.local/share/reIS for Claude` |

It takes up to 4 GB, then the oldest copies are removed, original files first since they can be downloaded again (never the list of upcoming events, which cannot be fetched again). Building your map stops at that limit and lists the files it did not download. It is not tied to your IS login, so if you share a computer account with someone else, delete it before handing over. Uninstalling the extension does **not** delete it.

**To delete it:** ask Claude to "forget everything reIS saved" (it runs `mendelu_forget_everything`, deletes the folder's contents, the original files and the list of upcoming events included, and says what it removed; a calendar you have is never touched), or delete the folder yourself (with Claude closed: a file being downloaded at that moment would be saved again). If the folder cannot be written, reIS says so and works from memory until Claude closes.

## A daily or weekly digest

Claude can write you a digest of what changed in IS and what is coming, as a **draft in your own mail**, every day, every week or whenever you ask. The routine is one prompt, kept in one place: [`mcp/routine/digest-prompt.md`](routine/digest-prompt.md). It tells Claude to call `mendelu_refresh`, read every new or replaced harmonogram, conditions or brief file and save its dates with `mendelu_ledger`, then write the digest: what changed, points, deadlines this week and the upcoming events. Every event you have to come to is mentioned at least a week ahead: a weekly digest looks 14 days ahead, a daily one flags everything inside 14 days. It also **proposes** University-calendar entries for new or changed events (title "Kind – Subject (CODE)", the room, the rule, the source, reminders a week, a day and an hour before, the ledger id in the description so nothing is added twice) and writes nothing to your calendar until you say yes.

- **Claude Desktop:** paste the prompt into a new chat and ask Claude to make it a scheduled task (for example every day at 7:00), or create one in Desktop's scheduled tasks. It runs on this computer, so the computer has to be on and Claude Desktop open at that time. A cloud routine cannot reach reIS, which runs only on your computer.
- **Claude Code (plugin):** the plugin carries the same prompt as the `daily-digest` skill: ask for "my digest" or run it on demand.
- Change the first line of the prompt to `weekly` for a weekly digest.

It needs a mail connector you already have (Gmail or Outlook) to save the draft, and a calendar connector to look for entries already there. Without them Claude says what is missing and gives you the digest as text. **reIS itself never sends mail and never writes a calendar:** the draft and any entry you approve are written by your own Claude through your own connectors. `mendelu_refresh` only reads IS and writes reIS's own folder.

## Repeated questions

Asking IS is kept to what is cheap. A file's text is read from the saved copy as long as its folder still shows the same modified date and the text was read on a later day than that date (IS shows no time of day, so an edit made the same day cannot be told apart), even after a restart; a different date, a file read the day it was modified, or a file read before its folder was listed, is downloaded again. The lists (subjects, file lists, points, assignments, exams, the timetable) always come from IS, and within one Claude run an answer is also kept in memory for a while so asking the same thing twice does not ask IS twice: a minute for assignments, exams, points and grades (what you or a teacher can change while you wait), 5 minutes for a subject's file list, 15 for the timetable, an hour for subjects, the study plan and a file's text, and a day for syllabi. Pass rates are not kept here: their own fetcher keeps them and asks again for any subject it could not get. A file is read again as soon as its folder shows a different date for it.

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
