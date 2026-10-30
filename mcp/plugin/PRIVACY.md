# reIS for Claude Code: privacy policy

Last updated: 26 October 2026.

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

Nothing goes to reIS. reIS runs no server for this plugin, receives nothing from it,
counts nothing and stores nothing.

## What it stores

Nothing. The IS session lives in the plugin's memory while Claude Code runs and is
gone when Claude Code closes. When Claude reads a file from IS, Claude Code saves that
copy on your computer, not the plugin.

## What it never does

It never registers you for anything, never submits anything, never changes anything in
IS and never opens online tests.

## Removing it

Uninstall the plugin in Claude Code (`/plugin`). That also deletes the username and
password it kept.

## Contact

`reis.mendelu@gmail.com`
