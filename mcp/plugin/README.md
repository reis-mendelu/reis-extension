# reIS for Claude Code

Your IS Mendelu data in Claude Code: timetable, exams, subjects, study plan, syllabi, grades, assignment deadlines and subject files. It signs in to IS as you, on your own computer.

## Install

Install the plugin, then enter your IS Mendelu username and password when Claude Code asks. Ask things like "what's due this week?" or "explain lecture 7 of Počítačové sítě".

## What Claude can read

| Tool | What it returns |
| --- | --- |
| `mendelu_schedule` | Your timetable for today and the next 14 days; ask for any other dates this semester |
| `mendelu_exams` | Exam and credit terms, registered and still open |
| `mendelu_subjects` | Subjects you are enrolled in this semester |
| `mendelu_study_plan` | Your study plan and credits |
| `mendelu_syllabus` | One subject's syllabus and requirements |
| `mendelu_subject_files` | Files in a subject's IS document folder |
| `mendelu_read_file` | One of those files, handed to Claude to read (PDF, DOCX, PPTX, XLSX, ODT, plain text), up to 30 MB |
| `mendelu_success_rates` | Historical pass rates of subjects (public reIS statistics) |
| `mendelu_grades` | Your grades and credits so far |
| `mendelu_assignments` | Your submission boxes and their deadlines |

## What it never does

- It never registers you for anything, never submits anything, and never opens online tests.
- It never sends anything to reIS. It talks to `is.mendelu.cz` (over HTTPS only) and to the public reIS statistics on `cdn.jsdelivr.net`, nothing else.
- Your password is kept in Claude Code's secure storage and is sent only to `is.mendelu.cz` to sign in.
- It writes nothing to your disk. Claude Code saves a file you ask Claude to read.

Whatever Claude reads goes to Claude like anything else you share in a chat.

## Limits

- Claude Code only. Claude chat does not run a plugin's local server, and Cowork does not pass it your sign-in.
- Accounts with two-factor sign-in are not supported yet.

## Source

Built from [`mcp/`](https://github.com/reis-mendelu/reis-extension/tree/main/mcp) in the reIS repository, where `server/index.mjs` is bundled. Unofficial: IS Mendelu belongs to Mendel University in Brno.
