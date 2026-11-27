# reIS for Claude Code

Your IS Mendelu data in Claude Code: timetable, exams, subjects, study plan, syllabi, grades, assignment deadlines and subject files. It signs in to IS as you, on your own computer.

## Install

The plugin's server runs on [Node.js](https://nodejs.org) 20 or later, which Claude Code itself does not install: check that `node --version` works in a terminal. Then run `/plugin marketplace add reis-mendelu/reis-for-claude` and `/plugin install reis@reis`, choose the user scope if Claude Code offers a choice of install scope, and enter your IS Mendelu username and password when Claude Code asks. Then turn on auto-update, so new versions arrive by themselves: run `/plugin`, choose **Marketplaces**, then **reis**, then **Enable auto-update**. Ask things like "what's due this week?" or "explain lecture 7 of Počítačové sítě".

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
| `mendelu_read_file` | One of those files, handed to Claude to read (PDF, DOCX, PPTX, XLSX, ODT, plain text), up to 10 MB; a file already saved on your computer and unchanged in IS is handed over by its path instead |
| `mendelu_success_rates` | Historical pass rates of subjects (public reIS statistics) |
| `mendelu_grades` | Your grades and credits so far |
| `mendelu_assignments` | Your submission boxes and their deadlines |
| `mendelu_search` | Searches the plain-text files reIS has saved, in every subject at once (case and diacritics do not matter), plus the name, folder and date of every listed file, including PDFs and Office files. Works offline and asks IS nothing |
| `mendelu_ledger` | The list of your upcoming tests, credit tests, defences, programme days and events, which Claude keeps for you: it saves every date it finds in a harmonogram, a project brief or a mail, and `mendelu_overview` then lists them soonest first with the days left (and marks one "recheck" when the file it came from was replaced). Asks IS nothing, writes nothing to IS or to your calendar |
| `mendelu_build_my_map` | Saves every file of every subject's IS folder on your computer at once, as the original files (zips as they are), so Claude Code opens them by their path. First a dry run that downloads nothing and says how many files of which types each subject has (IS lists no sizes, so the total size is unknown until download); then the download, which skips files already saved and unchanged, stops at the size limit and says what it skipped. Only reads from IS |
| `mendelu_refresh` | The call your scheduled digest makes: refreshes the lists from IS, says what changed since the last refresh, downloads new or replaced files of subjects already saved (within the size limit; a first refresh compares with the last `mendelu_overview`, or only takes a baseline if the overview never ran), and lists the events of the next 14 days and the ones to recheck. Only reads from IS; never sends mail or writes a calendar |
| `mendelu_forget_everything` | Deletes everything reIS saved on your computer (see below). Claude calls it only when you ask |

## What it never does

- It never registers you for anything, never submits anything, and never opens online tests.
- It never sends anything to reIS. It talks to `is.mendelu.cz` (over HTTPS only) and to the public reIS statistics on `cdn.jsdelivr.net`, nothing else.
- Your password is kept in Claude Code's secure storage and is sent only to `is.mendelu.cz` to sign in.
- Your password is never written to disk by reIS, and neither is IS's sign-in cookie.
- It saves a local copy of what Claude read, on by default and never leaving your computer (below). Separately, Claude Code saves a PDF or Office file you ask Claude to read, as before.

## What it saves on your computer

So Claude can start from what it read before instead of forgetting it with each Claude Code window, the plugin keeps: your subject list, each subject's file list (names, dates, download links), the text of plain-text files Claude reads, the **original files** Claude reads or that you ask Claude to save all at once with `mendelu_build_my_map` (PDFs, Office files, zips still zipped, data files, exactly as IS serves them, in `originals/` with one folder per file and the file's name made safe; `mendelu_overview` gives Claude each one's path, so Claude Code opens it there instead of downloading it again), your study programme, form, year and semester, the list of upcoming events Claude keeps with `mendelu_ledger` (title, date, kind, subject, room, the rule that matters, where the date came from; Claude writes it, reIS never writes to a calendar), a short record of what `mendelu_overview` last told Claude was new (each file's name and date, a fingerprint of each row of your points rather than the points themselves, assignment names and deadlines, exam term dates) (your points are not saved in readable form, only a fingerprint), and a second record like it for `mendelu_refresh`, the call of the daily digest, with the time of the last refresh. Never your password or the IS cookie; the study profile holds no name, student number or e-mail, but file names and plain-text contents are kept as they are, so anything written in them is kept too. It is plain files in one folder per computer account, shared with Claude Desktop if you use both:

- macOS: `~/Library/Application Support/reIS for Claude`
- Windows: `%LOCALAPPDATA%\reIS for Claude`
- Linux: `$XDG_DATA_HOME/reIS for Claude`, or `~/.local/share/reIS for Claude`

**Search in the plugin.** `mendelu_search` looks through the text reIS has saved, so in the plugin it reads inside the plain-text files Claude has opened (`.txt`, `.md`, `.csv`, `.m`, `.ipynb`, `.drawio`, `.html`) and finds PDFs and Office files only by their name, folder, date and subject. The plugin stays small by not carrying a PDF reader (a pure-JavaScript one would not fit in its one 5 MiB file), so it does not keep the text of those files; Claude Code reads them itself when Claude opens one. The Claude Desktop extension (`.mcpb`) extracts and searches everything.

It takes up to 4 GB; past that the oldest copies are removed, original files first (they can be downloaded again), and building the map stops at the limit and lists what it did not download.

Ask Claude to "forget everything reIS saved" (`mendelu_forget_everything`, original files included) or delete the folder (with Claude Code closed: a file being downloaded at that moment would be saved again) to remove it. Uninstalling the plugin does not delete it.

Whatever Claude reads goes to Claude like anything else you share in a chat. The full privacy policy is in [PRIVACY.md](PRIVACY.md).

## A daily or weekly digest

The plugin's `daily-digest` skill is a routine for Claude: call `mendelu_refresh`, read every new or replaced harmonogram, conditions or brief file and save its dates with `mendelu_ledger`, then save a digest as a **draft in your own mail** (what changed, points, deadlines this week, upcoming events: each one you have to come to at least a week ahead; a weekly digest looks 14 days ahead) with **proposed** University-calendar entries, written to your calendar only after you say yes. Ask Claude for "my digest", or schedule it. The same prompt for Claude Desktop is [`mcp/routine/digest-prompt.md`](https://github.com/reis-mendelu/reis-extension/blob/main/mcp/routine/digest-prompt.md). Without a mail or calendar connector Claude says so and gives you the digest as text. reIS itself never sends mail and never writes a calendar.

`mendelu_refresh` downloads the new or replaced files of subjects already saved, within the 4 GB limit, and nothing else: a first refresh compares with what `mendelu_overview` last reported if it ran before, and otherwise only takes a baseline (nothing downloaded); a new subject's files wait for `mendelu_build_my_map`.

## Limits

- Claude Code only. Claude chat does not run a plugin's local server, and Cowork does not pass it your sign-in.
- Accounts with two-factor sign-in are not supported yet.

## Source

Built from [`mcp/`](https://github.com/reis-mendelu/reis-extension/tree/main/mcp) in the reIS repository, where `server/index.mjs` is bundled. Unofficial: IS Mendelu belongs to Mendel University in Brno.
