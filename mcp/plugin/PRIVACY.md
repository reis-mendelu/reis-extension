# reIS for Claude Code: privacy policy

Last updated: 25 November 2026.

reIS for Claude Code is a plugin that lets Claude read your own data in IS Mendelu, the
information system of Mendel University in Brno. It is made by reIS, two MENDELU
students. It is not an official MENDELU product.

## What it reads

When you ask Claude something that needs it, the plugin reads your own data in IS
Mendelu: your timetable, exams, enrolled subjects, study plan, syllabi, grades,
assignment deadlines, and the files in your subjects' document folders. It also reads
public pass-rate statistics that reIS publishes.

## Where data goes

- **Your IS username and password** go only to `is.mendelu.cz`, over HTTPS, to sign you
  in, and again when your IS session runs out. Claude Code keeps them in your system's
  secure storage; the plugin never writes them anywhere.
- **Your IS data** goes from `is.mendelu.cz` to your computer, and from there into your
  Claude conversation, because you asked Claude about it. Anthropic's own terms and
  privacy policy cover what happens to a conversation.
- **Public pass-rate statistics** come from `cdn.jsdelivr.net`. Each request names the
  subject code Claude looks up and, like any web request, comes from your IP address; no
  other data about you is sent.

Nothing goes to reIS. reIS runs no server for this plugin, receives nothing from it and
counts nothing. What the plugin saves stays on your own computer (next section).

## What it stores

On your own computer, so Claude can start from what it read before instead of forgetting
it each time you open Claude Code. This is on by default, and it never leaves your
computer: reIS receives none of it.

- **Saved**, as plain files in one folder: your subject list (code, name, IS id); each
  subject's file list (names, dates, download links); the text of plain-text files Claude
  reads; your study programme, form, year and semester; the list of upcoming events (tests, defences, programme days, events) that Claude saves with `mendelu_ledger`: title, date, kind, subject, room, the rule that matters, the unregistration deadline and where the date came from, written by Claude from what it read or what you told it, never by reIS from IS on its own and never written to a calendar; a short record of what `mendelu_overview` last told Claude was new (each file's name and date, a fingerprint of each row of your points rather than the points themselves, assignment names and deadlines, exam term dates), your points are not saved in readable form, only a fingerprint; a second record like it for
  `mendelu_refresh`, the call of the daily digest, with the time of the last refresh. The **original files**
  of your subjects (PDFs, Office files, zips still zipped, data files, exactly as IS serves
  them): one each time Claude reads a file, and all of them when you ask Claude to build
  your map (`mendelu_build_my_map`, which asks first with a dry run that downloads nothing).
  They are in the `originals` folder inside the folder below, one folder per file, under the
  file's own name made safe; a file IS still shows with the same modified date is not
  downloaded again, and Claude Code opens the saved copy by its path. `mendelu_refresh` downloads
  only the new or replaced files of subjects already saved, within the size limit, into the
  same folder.
- **Never saved:** your IS password or IS's sign-in cookie. The study profile holds no
  name, student number or e-mail, but file names and the text of plain-text files are
  kept exactly as they are, so anything written in them is kept too. The password stays in Claude Code's secure storage and the IS session in
  the plugin's memory, gone when Claude Code closes.
- **Where:** macOS `~/Library/Application Support/reIS for Claude`; Windows
  `%LOCALAPPDATA%\reIS for Claude`; Linux `$XDG_DATA_HOME/reIS for Claude` or
  `~/.local/share/reIS for Claude`. One folder per computer account, shared with the
  Claude Desktop extension if you use both, and not tied to the IS login: if you share a
  computer account, delete it before handing over. It takes up to 4 GB, then the oldest
  copies are removed, original files first (never the list of upcoming events, which cannot be fetched again). If the folder cannot be written, the plugin says so and keeps
  things in memory until Claude Code closes.
- **Answers IS gave** are also kept in memory for between a minute and a day, so that
  Claude asking the same thing twice does not ask IS twice; they are gone when Claude
  Code closes.

## Deleting it

Ask Claude to "forget everything reIS saved": the `mendelu_forget_everything` tool deletes
the folder's contents, the original files and the list of upcoming events included, and says what it removed. A calendar is never touched. Or delete the folder yourself, with Claude closed (a file being downloaded at that moment would be saved again). It does not
change anything in IS or in a Claude conversation that already holds it.

## What it never does

It never registers you for anything, never submits anything, never changes anything in
IS and never opens online tests. It never sends mail and never writes a calendar: the daily
digest is a draft your own Claude saves in your mail through your own connector, and a
calendar entry is written by your own Claude only after you say yes.

## Removing it

Uninstall the plugin in Claude Code (`/plugin`). That also deletes the username and
password it kept. It does not delete the folder of saved copies: use the forget tool above
or delete the folder.

## Contact

`reis.mendelu@gmail.com`
