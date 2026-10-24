import { fetchUserBaseIds } from './fetchers';
import { isEnrolledStatus, type StudyOption } from './studyOptions';

type BaseIds = NonNullable<Awaited<ReturnType<typeof fetchUserBaseIds>>>;

/** The part of a stored params record the study decision reads. */
interface StoredStudy {
  studium?: string;
  studies?: StudyOption[];
}

/**
 * The study the app runs on, and the switcher's list to store with it.
 *
 * `studies: undefined` means "not decided": the record is written without a
 * list, so the next boot tries again. `null` means "keep the stored record as
 * it is" — IS could not be read well enough to justify moving the student, and
 * a move wipes their cached study data and restarts the app.
 */
export type StudyChoice = { base: BaseIds; studies: StudyOption[] | undefined } | null;

const offeredIn = (studies: StudyOption[], studium?: string | null): studium is string =>
  !!studium && studies.some((s) => s.studium === studium);

/**
 * Whether a complete, same-student record has to go back through
 * `chooseStudy`. False for every student with one study, so their boot asks IS
 * exactly what it asked before studies existed.
 */
export function needsStudyResolution(
  stored: StoredStudy,
  studies: StudyOption[],
  preferred: string | null
): boolean {
  // A second study ended: the record may still be on it.
  if (studies.length <= 1) return (stored.studies?.length ?? 0) > 1;
  // Written before reIS knew about studies — possibly on an interrupted one.
  if (!stored.studies) return true;
  const sameOffer =
    stored.studies.length === studies.length &&
    stored.studies.every((s, i) => s.studium === studies[i]?.studium);
  if (!sameOffer || !offeredIn(studies, stored.studium)) return true;
  return offeredIn(studies, preferred) && preferred !== stored.studium;
}

/**
 * Decide which study a student with more than one runs on:
 *
 * 1. the one they picked in reIS, if IS still offers it;
 * 2. else the one decided earlier;
 * 3. else the first whose `Stav studia` says they are enrolled, falling back to
 *    IS's own default (the first option) when none or all are.
 *
 * Every page is fetched with `lang=cz` by `fetchUserBaseIds(studium)`, and the
 * `obdobi` comes from the chosen study's own page: it is a faculty period, so
 * two studies at different faculties do not share it.
 */
export async function chooseStudy(
  base: BaseIds,
  stored: StoredStudy | undefined,
  preferred: string | null
): Promise<StudyChoice> {
  const studies = base.studies;
  if (studies.length <= 1) return { base, studies };
  const canKeep = offeredIn(studies, stored?.studium);
  // What a failed read falls back to: the stored record if it is usable, else
  // IS's default page without a decision, so a later boot asks again.
  const undecided: StudyChoice = canKeep ? null : { base, studies: undefined };

  let target: string;
  if (offeredIn(studies, preferred)) target = preferred;
  else if (stored?.studies && canKeep) target = stored.studium!;
  else {
    const pages = await Promise.all(studies.map((s) => fetchUserBaseIds(s.studium)));
    if (pages.some((p) => !p || p.studyStatus === null)) return undecided;
    const enrolled = pages.find((p) => isEnrolledStatus(p!.studyStatus!));
    return { base: enrolled && enrolled.studium !== base.studium ? enrolled : base, studies };
  }

  if (target === base.studium) return { base, studies };
  const page = await fetchUserBaseIds(target);
  if (!page || page.studium !== target) return undecided;
  return { base: page, studies };
}
