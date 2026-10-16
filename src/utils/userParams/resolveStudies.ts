import { fetchWithAuth, BASE_URL } from '../../api/client';
import {
  parseStudyOptions,
  parseStudyStatus,
  parseStudyObdobi,
  isActiveStudyStatus,
  detectErasmus,
  type StudyOption,
} from './studies';

export interface ResolvedStudies {
  /** The studies reIS offers, in IS order. One entry means no switcher. */
  active: StudyOption[];
  /** The study reIS reads everything for. Always one of `active`. */
  chosen: StudyOption;
}

/**
 * Which of a multi-study student's studies reIS should use.
 *
 * Asks IS for each study's own `studium.pl`: the header select carries no
 * status, but each study's page has its "Stav studia", its period and its
 * Czech label. A few requests per session, and only for students IS lists
 * with more than one study.
 *
 * `keep` is the study already in use (the stored record). It stays while it
 * is active — that is the student's choice, or an earlier default — and is
 * replaced by the first active study when it is not, which is how a record
 * left on an interrupted study corrects itself on the next start.
 *
 * A page that cannot be read counts as a study of unknown status — one IS
 * refusing an old study's page must not stop the correction for good. It
 * rejects only when nothing can be decided: the kept study's own page, or
 * every page, failed. The caller then keeps the record it has.
 *
 * The kept study's page is read LAST. Whether opening `studium.pl?studium=X`
 * makes X the study IS's session shows is unverified; if it does, the
 * session then ends on the study reIS is going to use.
 */
export async function resolveStudies(
  options: { studium: string; label: string }[],
  keep?: string
): Promise<ResolvedStudies> {
  const readOne = async (o: { studium: string; label: string }) => {
    const res = await fetchWithAuth(
      `${BASE_URL}/auth/student/studium.pl?studium=${o.studium};lang=cz`
    );
    const html = await res.text();
    const own = parseStudyOptions(html).find((x) => x.studium === o.studium);
    const study: StudyOption = {
      studium: o.studium,
      obdobi: parseStudyObdobi(html, o.studium) ?? '',
      label: own?.label ?? o.label,
      isErasmus: detectErasmus(html),
    };
    return { study, active: isActiveStudyStatus(parseStudyStatus(html)) && !!study.obdobi };
  };
  type Read = Awaited<ReturnType<typeof readOne>>;
  const kept = options.find((o) => o.studium === keep);
  const rest = options.filter((o) => o !== kept);
  const settled = await Promise.allSettled(rest.map(readOne));
  const byId = new Map<string, Read | null>(
    rest.map((o, i) => {
      const r = settled[i]!; // safe: allSettled answers once per input, in order
      return [o.studium, r.status === 'fulfilled' ? r.value : null];
    })
  );
  // If the kept study's own page fails, keeping it cannot be confirmed: an
  // active study among the others wins (IS refusing an interrupted study's
  // page would otherwise block the correction for good); with none, reject
  // and the caller keeps what it has.
  if (kept) {
    try {
      byId.set(kept.studium, await readOne(kept));
    } catch (e) {
      if (![...byId.values()].some((r) => r?.active)) throw e;
    }
  }
  const read = options.map((o) => byId.get(o.studium)).filter((r): r is Read => !!r);
  if (read.length === 0) throw new Error('resolveStudies: no study page could be read');

  const active = read.filter((r) => r.active).map((r) => r.study);
  if (active.length > 0) {
    return { active, chosen: active.find((s) => s.studium === keep) ?? active[0]! };
  }

  // No status recognised: the rule does not know this IS wording. Do what
  // reIS did before it could tell — the stored study if IS still lists it,
  // else the one IS lists first — and offer nothing to switch to.
  const all = read.map((r) => r.study);
  const chosen = all.find((s) => s.studium === keep && s.obdobi) ?? all.find((s) => s.obdobi);
  if (!chosen) throw new Error('resolveStudies: no study page had a period');
  return { active: [chosen], chosen };
}
