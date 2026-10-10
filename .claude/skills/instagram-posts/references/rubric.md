# Rubric for one reIS Instagram post

You are rating a single post before it goes on @reis.mendelu, the Instagram of a free app that
MENDELU (Brno) students use instead of the university's information system. The audience is
Czech students scrolling past. Be strict: a post that is only fine wastes one of 20 monthly slots.

You get the image (1080×1350 JPEG), the caption, the alt text, the PR numbers and the planned
publish date. **Open the image and look at it.** Judge the post as of that date: a feature that is
only in `test` today is fine if the post goes out on or after its release — the caption is meant to
read as if released. Not being released yet is never a blocker on its own. Read each PR body yourself
(`gh pr view N --repo reis-mendelu/reis-extension`) — do not trust the caption's claims.

Score each criterion 1–5 (5 = would post as is, 3 = needs work, 1 = wrong). Quote the exact words
or describe the exact pixels that cost points.

1. **worth_posting** — Would a student stop scrolling? Is it a real benefit (saves time, removes a
   pain with IS), not an internal improvement dressed up? Is it new to students — not polish on
   something they already have — and does it matter at this time of the semester?
2. **accuracy** — Everything the image, caption and alt text claim is true per the PRs: the right
   devices/trees, no feature that is behind an off flag, nothing promised that the PR doesn't do.
3. **headline** — Czech a student would actually say, *ty*, 3–7 words, about the benefit, the
   underlined word is the one carrying the news. No feature-name jargon, no "nová funkce".
4. **screen** — The phone shows the feature itself, clearly, in the visible part (the top of the
   screen). Not mostly empty, not a spinner or empty state, not a different tab. Legible at phone
   size.
5. **craft** — Layout clean: nothing clipped or overlapping, text clear of the phone, no odd line
   breaks (a one-letter word at a line end), consistent with the reIS look (navy, lime, DM Sans).
6. **caption** — Natural Czech, short: about 100–200 characters (over 250 scores at most 2).
   Says where to find it, ends with "Odkaz v biu.", no emoji spam or hashtag walls, no typos. Alt text describes what is
   actually in the image.

**Blockers** (any one fails the post regardless of scores): a real person's data (fictional demo
names like "Jana Ukázková" or invented surnames such as Vzorová are fine; real-looking student
IDs, grades or photos are not), a partner/company logo, a
promise the PRs don't support, text cut off, a factual error about MENDELU.

Return only this JSON:

```json
{
  "scores": { "worth_posting": 0, "accuracy": 0, "headline": 0, "screen": 0, "craft": 0, "caption": 0 },
  "blockers": ["..."],
  "pass": false,
  "fixes": ["the most important change first, concrete: new wording, a different screen, a shotOffset"]
}
```

`pass` is true only when every score is ≥ 4 and `blockers` is empty.
