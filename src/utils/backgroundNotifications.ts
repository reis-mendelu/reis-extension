import { translate } from '../i18n/translate';
import type { NewExamTerm } from './newExamTerms';
import type { NewPoint } from './zaznamnik/newPoints';
import { newPointsNotification } from './zaznamnik/newPointsText';

export type BackgroundKind = 'exams' | 'boxes' | 'points';

export interface BackgroundNotification {
  kind: BackgroundKind;
  title: string;
  body: string;
  /** The subject a tap opens; null for a summary (it opens Novinky instead). */
  courseCode: string | null;
}

export interface BackgroundFindings {
  terms: Pick<NewExamTerm, 'courseCode' | 'subjectCs' | 'subjectEn' | 'date' | 'time'>[];
  boxes: { courseCode: string; name: string }[];
  points: Record<string, NewPoint[]>;
}

const unique = <T>(xs: T[]) => [...new Set(xs)];

/**
 * The notifications the phone's background check posts: at most one per kind,
 * so a sync that finds a dozen things is three taps on the shade at worst.
 * Words only; nothing here touches the device.
 */
export function composeBackgroundNotifications(
  found: BackgroundFindings,
  language: string,
  nameOf: (courseCode: string) => string
): BackgroundNotification[] {
  const out: BackgroundNotification[] = [];
  const isEn = language === 'en';

  const [firstTerm] = found.terms;
  if (firstTerm) {
    const subject = (t: BackgroundFindings['terms'][number]) => (isEn ? t.subjectEn : t.subjectCs);
    out.push(
      found.terms.length === 1
        ? {
            kind: 'exams',
            title: translate(language, 'backgroundCheck.examTitleOne', {
              subject: subject(firstTerm),
            }),
            body: translate(language, 'backgroundCheck.examBodyOne', {
              date: firstTerm.date,
              time: firstTerm.time,
            }),
            courseCode: null,
          }
        : {
            kind: 'exams',
            title: translate(language, 'backgroundCheck.examTitleMany'),
            body: unique(found.terms.map(subject)).join(', '),
            courseCode: null,
          }
    );
  }

  if (found.boxes.length > 0) {
    const codes = unique(found.boxes.map((b) => b.courseCode));
    const [code] = codes;
    out.push(
      codes.length === 1 && code
        ? {
            kind: 'boxes',
            title: translate(language, 'backgroundCheck.boxTitleOne', { subject: nameOf(code) }),
            body: found.boxes.map((b) => b.name).join(', '),
            courseCode: code,
          }
        : {
            kind: 'boxes',
            title: translate(language, 'backgroundCheck.boxTitleMany'),
            body: codes.map(nameOf).join(', '),
            courseCode: null,
          }
    );
  }

  if (Object.keys(found.points).length > 0) {
    const codes = Object.keys(found.points);
    out.push({
      kind: 'points',
      ...newPointsNotification(found.points, nameOf, language),
      courseCode: codes.length === 1 ? (codes[0] ?? null) : null,
    });
  }
  return out;
}
