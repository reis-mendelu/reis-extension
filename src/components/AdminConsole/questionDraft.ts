import type { QuestionButton } from '../../types/questions';
import type { QuestionInput } from '../../api/adminQuestions';

/**
 * The console's question presets (spec 2026-10-22, Decision 1 → a buttons
 * list). A preset fills the buttons; the admin edits only what the preset
 * leaves open: the labels of Ano/Ne and the link's label and address.
 */
export type QuestionPreset = 'yesno' | 'scale' | 'thumbs' | 'link';

export const PRESETS: QuestionPreset[] = ['yesno', 'scale', 'thumbs', 'link'];

export function presetButtons(preset: QuestionPreset): QuestionButton[] {
  switch (preset) {
    case 'yesno':
      return [
        { key: 'yes', cz: 'Ano', en: 'Yes' },
        { key: 'no', cz: 'Ne', en: 'No' },
      ];
    case 'scale':
      return ['1', '2', '3', '4', '5'].map((k) => ({ key: k, cz: k, en: k }));
    case 'thumbs':
      return [
        { key: 'up', cz: '👍', en: '👍' },
        { key: 'down', cz: '👎', en: '👎' },
      ];
    case 'link':
      return [{ key: 'open', cz: 'Otevřít', en: 'Open', url: 'https://' }];
  }
}

/**
 * The satisfaction question (Decision 2 → d) is the 1–5 preset's default, in
 * the retired NpsBanner's own words, so its answers stay comparable in wording
 * with the 131 the banner collected (the surface and identifier still differ).
 */
export function presetPrompt(preset: QuestionPreset) {
  return preset === 'scale'
    ? {
        promptCz: 'Doporučil/a bys reIS kamarádovi?',
        promptEn: 'Would you recommend reIS to a friend?',
        noteCz: '1 = nejhorší, 5 = nejlepší',
        noteEn: '1 = worst, 5 = best',
      }
    : { promptCz: '', promptEn: '', noteCz: '', noteEn: '' };
}

export interface QuestionDraft {
  preset: QuestionPreset;
  promptCz: string;
  promptEn: string;
  noteCz: string;
  noteEn: string;
  buttons: QuestionButton[];
  /** `datetime-local` values, the admin's own time zone. */
  startsAt: string;
  endsAt: string;
  /** Empty = everyone. */
  faculties: string[];
}

/** `YYYY-MM-DDTHH:mm` in local time, as `<input type="datetime-local">` wants it. */
export function toLocalInput(d: Date): string {
  const p = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}T${p(d.getHours())}:${p(d.getMinutes())}`;
}

/** Four weeks by default: the window the donation go/no-go was set on. */
export function newDraft(preset: QuestionPreset, now = new Date()): QuestionDraft {
  const end = new Date(now.getTime() + 28 * 86_400_000);
  return {
    preset,
    ...presetPrompt(preset),
    buttons: presetButtons(preset),
    startsAt: toLocalInput(now),
    endsAt: toLocalInput(end),
    faculties: [],
  };
}

/** The first problem as an i18n key under `admin.questions`, or null. */
export function draftError(d: QuestionDraft): string | null {
  if (!d.promptCz.trim() || !d.promptEn.trim()) return 'errPrompt';
  if (d.promptCz.length > 200 || d.promptEn.length > 200) return 'errPrompt';
  if (d.buttons.some((b) => !b.cz.trim() || !b.en.trim() || b.cz.length > 40 || b.en.length > 40))
    return 'errLabels';
  if (d.buttons.some((b) => b.url !== undefined && !/^https:\/\/\S{4,}$/.test(b.url)))
    return 'errUrl';
  const start = Date.parse(d.startsAt);
  const end = Date.parse(d.endsAt);
  if (!Number.isFinite(start) || !Number.isFinite(end) || end <= start) return 'errDates';
  return null;
}

export function draftToInput(d: QuestionDraft): QuestionInput {
  const note = (s: string) => (s.trim() ? s.trim() : null);
  return {
    promptCz: d.promptCz.trim(),
    promptEn: d.promptEn.trim(),
    noteCz: note(d.noteCz),
    noteEn: note(d.noteEn),
    buttons: d.buttons.map((b) => ({ ...b, cz: b.cz.trim(), en: b.en.trim() })),
    startsAt: new Date(d.startsAt).toISOString(),
    endsAt: new Date(d.endsAt).toISOString(),
    faculties: d.faculties.length ? d.faculties : null,
  };
}
