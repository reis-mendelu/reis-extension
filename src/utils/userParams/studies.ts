/**
 * A student's studies, as IS lists them on its own pages.
 *
 * Regex only, deliberately: this runs in the content script, the iframe app
 * and Node (reIS for Claude), and only the first two have a `DOMParser`.
 */

/** One active study a student can switch to. */
export interface StudyOption {
  studium: string;
  obdobi: string;
  /** IS's own label, in Czech: `PEF B-EM komb [sem 1, roč 1]`. */
  label: string;
  isErasmus: boolean;
}

const decode = (s: string) =>
  s
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/\s+/g, ' ')
    .trim();

/**
 * The studies in the header `<select name="studium">`, in page order.
 *
 * Empty on a single-study page: IS then names the study in a `<b>` beside a
 * hidden input and has no select at all — which is how a single-study
 * student is told apart, and why nothing changes for them. The page lists
 * the study it is about FIRST, so the order is IS's default before the rest.
 */
export function parseStudyOptions(html: string): { studium: string; label: string }[] {
  const select = /<select\s+name="studium"[^>]*>([\s\S]*?)<\/select>/i.exec(html)?.[1];
  if (!select) return [];
  const out: { studium: string; label: string }[] = [];
  for (const m of select.matchAll(/<option\s+value="(\d+)"[^>]*>([^<]*)<\/option>/gi)) {
    out.push({ studium: m[1]!, label: decode(m[2]!) }); // safe: both groups required
  }
  return out;
}

/** The "Stav studia" row of a study's own `studium.pl` (CZ or EN). */
export function parseStudyStatus(html: string): string | null {
  const m = /(?:Stav\s+studia|Progress\s+of\s+study):\s*<\/td>\s*<td[^>]*>\s*([^<]*)</i.exec(html);
  return m ? decode(m[1]!) : null; // safe: the group is required
}

/** The study's own period, from the `studium=…;obdobi=…` links on its page. */
export function parseStudyObdobi(html: string, studium: string): string | null {
  return new RegExp(`studium=${studium};obdobi=(\\d+)`).exec(html)?.[1] ?? null;
}

const ACTIVE = /(?:^|[^\p{L}])(?:zapsán|zapsána|enrolled)(?:[^\p{L}]|$)/iu;
const NOT_ACTIVE =
  /přeruš|interrupt|nezapsán|not\s+enrolled|ukonč|absolv|zanech|vylouč|terminat|graduat|finished|completed/iu;

/**
 * Is this a study the student is studying now?
 *
 * EVIDENCE: the only status text seen on a real page is `řádně zapsán`
 * (`enrolled` in English), on an active study (October 2026). No page of an
 * interrupted or finished study has been seen, so the rule is an allow-list
 * of that one word, with a deny-list on top for the wordings a non-current
 * study would plausibly use. An unknown status is NOT active; the caller
 * then falls back to the study it used before (see `resolveStudies`), so a
 * wording this rule misses costs a switcher entry, never the student's data.
 */
export function isActiveStudyStatus(status: string | null | undefined): boolean {
  if (!status) return false;
  return ACTIVE.test(status) && !NOT_ACTIVE.test(status);
}

/**
 * The same erasmus test `fetchUserBaseIds` has always run, on one study's
 * page. Sidebars (e.g. "Zapsané termíny") are dropped first, because a
 * course name there can say "Erasmus".
 */
export function detectErasmus(html: string): boolean {
  const sanitizedHtml = html.replace(/<div class="sideportlet">[\s\S]*?<\/div>/g, '');
  return (
    /Erasmus\s*\+/i.test(sanitizedHtml) ||
    /exchange\s+programs?/i.test(sanitizedHtml) ||
    /výměnné\s+programy/i.test(sanitizedHtml)
  );
}

export interface StudyLabelFields {
  studyCode: string;
  facultyLabel?: string;
  studyProgram?: string;
  studyForm?: string;
  studySemester?: number;
  studyYear?: number;
}

/**
 * The fields `fetchUserStudyDetails` reads off the header of a single-study
 * page, read off a study's label instead. Same shape, same regex: on a
 * multi-study page that header holds the select, not the study.
 */
export function parseStudyLabel(label: string): StudyLabelFields {
  const m = label.match(/^([^\s]+)\s+([^\s]+)\s+([^\s]+)\s+\[sem\s+(\d+),\s+roč\s+(\d+)\]/);
  if (!m) return { studyCode: label };
  // safe: regex has 5 required capturing groups
  return {
    studyCode: label,
    facultyLabel: m[1]!,
    studyProgram: m[2]!,
    studyForm: m[3]!,
    studySemester: parseInt(m[4]!),
    studyYear: parseInt(m[5]!),
  };
}

const PERIOD = /^(?:ZS|LS)\s+\d{4}\/\d{4}/;

/**
 * `p` re-pointed at one of the student's studies: its ids, its Erasmus flag
 * and the fields its label carries. Identity fields are untouched — this is
 * the same student, so it must never look like a different one.
 */
export function withStudy<
  P extends { studium: string; obdobi: string; isErasmus: boolean; periodLabel?: string },
>(p: P, s: { active: StudyOption[]; chosen: StudyOption }): P & { studies: StudyOption[] } {
  const fields = parseStudyLabel(s.chosen.label);
  return {
    ...p,
    studium: s.chosen.studium,
    obdobi: s.chosen.obdobi,
    isErasmus: s.chosen.isErasmus,
    studyCode: fields.studyCode,
    facultyLabel: fields.facultyLabel,
    studyProgram: fields.studyProgram,
    studyForm: fields.studyForm,
    studySemester: fields.studySemester,
    studyYear: fields.studyYear,
    // moje_studium.pl's period is for IS's default study and only kept when
    // it really is a period: on a multi-study header its <b>s are not.
    periodLabel:
      p.periodLabel && PERIOD.test(p.periodLabel) && p.obdobi === s.chosen.obdobi
        ? p.periodLabel
        : undefined,
    studies: s.active,
  };
}
