import 'dotenv/config';
import { installNodeRuntime } from './lib/nodeRuntime';
import { isLogin } from './lib/isLogin';
import { courseStats, personaStats, personaVerdict, type PersonaRow } from './lib/personaStats';

/**
 * `npm run personas:check` — LOCAL ONLY, never CI (design 2026-11-27 §7).
 *
 * Signs in to IS as the admin in `.env`, runs the very fetch the app runs for
 * each persona (`personaRequest` → `fetchImpersonation`) and prints one row
 * each. Exits non-zero on an unresolved code, 0 subjects, 0 lectures, 0
 * seminars for a year-1 group, or a subject whose seminars were not narrowed
 * to one group; for Erasmus, on a pinned course IS no longer lists or one
 * with no lecture or no seminar. Run it before shipping a persona change and at each semester
 * start. Its requests are a first-year's worth per persona, one at a time.
 */
/** Exits once what was written has drained: a piped table is never cut short. */
const exitAfterOutput = (code: number) => process.stdout.write('', () => process.exit(code));

async function main() {
  // Before the login: the persona list is plain data (features/personas.ts
  // imports no fetcher), so a mistyped id costs no browser and no IS request.
  const { PERSONAS, personaById } = await import('@/features/personas');
  const { EXCHANGE_PROGRAMME } = await import('@/utils/eventAudience');
  // `--detail zf`: every subject's lessons of that persona, to tell a broken
  // group filter from a subject that really meets at several times.
  const detailAt = process.argv.indexOf('--detail');
  const detail = detailAt > 0 ? process.argv[detailAt + 1] : undefined;
  if (detail !== undefined && !PERSONAS.some((p) => p.id === detail)) {
    process.stderr.write(
      `--detail: no persona "${detail}" (${PERSONAS.map((p) => p.id).join(', ')})\n`
    );
    return exitAfterOutput(2);
  }

  process.stderr.write('[personas] logging in to IS…\n');
  await installNodeRuntime(await isLogin());
  // After the runtime: @/api modules need its DOM and fetch at import time.
  const { loadOptions, loadYear1Groups } = await import('@/api/impersonation/options');
  const { fetchImpersonation } = await import('@/api/impersonation/fetchImpersonation');
  const { currentPeriod, periodLabel } = await import('@/api/impersonation/intake');
  const { personaRequest, resolvePersona } = await import('@/features/personas');
  const { ImpersonationError } = await import('@/api/impersonation/types');

  process.stderr.write('[personas] loading programmes…\n');
  const options = await loadOptions();
  const period = periodLabel(currentPeriod(new Date()));
  const rows: (PersonaRow & { groups: number[] })[] = [];

  for (const p of PERSONAS) {
    if (detail && p.id !== detail) continue;
    process.stderr.write(`[personas] ${p.id} (${p.shortCode ?? p.faculty})…\n`);
    if (p.shortCode && !resolvePersona(p, options)) {
      rows.push({
        id: p.id,
        code: null,
        group: null,
        groups: [],
        stats: null,
        error: 'unresolved',
      });
      continue;
    }
    let groups: number[] = [];
    try {
      const req = await personaRequest(p, options, async (programme) => {
        groups = await loadYear1Groups(programme);
        return groups;
      });
      const result = await fetchImpersonation({ ...req, periodLabel: period });
      // Erasmus: each pinned course, whether IS still lists it, and its lessons.
      const pinned = p.erasmus?.courses;
      const courses = pinned && {
        pinned,
        resolved: (req.courses ?? []).map((c) => c.code),
        stats: courseStats(result, pinned),
      };
      if (detail) {
        printDetail(result.schedule);
        for (const b of result.plan?.cz.blocks ?? [])
          for (const g of b.groups)
            process.stdout.write(
              `\nPLAN ${b.title} | ${g.name} | ${g.statusDescription} | min ${g.minCount ?? '-'}/${g.minCredits ?? '-'}\n  ${g.subjects.map((x) => `${x.code}${x.isEnrolled ? '*' : ''}(${x.credits})`).join(' ')}\n`
            );
      }
      rows.push({
        id: p.id,
        code: result.resolved.shortCode,
        group: req.group,
        groups,
        stats: personaStats(result),
        ...(courses ? { courses } : {}),
      });
    } catch (e) {
      const error = e instanceof ImpersonationError ? e.code : String(e);
      // Erasmus has no programme code: name its IS programme, so the row reads
      // as the error it is, not as "unresolved".
      const code = p.shortCode ?? (p.erasmus ? EXCHANGE_PROGRAMME : null);
      rows.push({ id: p.id, code, group: null, groups, stats: null, error });
    }
  }

  const table = rows.map((r) => {
    const fail = personaVerdict(r);
    return {
      persona: r.id,
      code: r.code ?? '—',
      // Erasmus has no group, also on a row that failed (no courses then).
      group: personaById(r.id)?.erasmus ? '—' : (r.group ?? 'all'),
      'groups in IS': r.groups.join(',') || '—',
      'plan rows': r.stats?.planRows ?? '—',
      'plan subj': r.stats?.planSubjects ?? '—',
      subjects: r.stats?.subjects ?? '—',
      lectures: r.stats?.lectures ?? '—',
      seminars: r.stats?.seminars ?? '—',
      'max sem slots': r.stats?.maxSeminarSlots ?? '—',
      'no lessons': r.stats?.subjectsWithoutLessons ?? '—',
      'only in timetable': r.stats?.timetableOnly ?? '—',
      courses: r.courses
        ? `${r.courses.resolved.length}/${r.courses.pinned.length}: ${r.courses.stats.map((c) => `${c.code} ${c.lectures}L/${c.seminars}S`).join(', ')}`
        : '—',
      verdict: fail.length ? `FAIL: ${fail.join('; ')}` : 'ok',
    };
  });
  process.stdout.write(`\nPersonas, ${period}, checked ${new Date().toISOString()}\n`);
  console.table(table);
  const failed = table.filter((r) => r.verdict !== 'ok').length;
  process.stdout.write(failed ? `\n❌ ${failed} persona(s) failed\n` : '\n✅ all personas ok\n');
  // The app's fetchers keep keep-alive sockets and happy-dom timers alive, so
  // the process is ended explicitly, after the table has drained.
  exitAfterOutput(failed ? 1 : 0);
}

function printDetail(
  schedule: {
    courseCode: string;
    isSeminar: string;
    date: string;
    startTime: string;
    room: string;
  }[]
) {
  const by = new Map<string, string[]>();
  for (const l of [...schedule].sort((a, b) => a.date.localeCompare(b.date))) {
    const k = `${l.courseCode} ${l.isSeminar === 'true' ? 'seminar' : 'lecture'}`;
    by.set(k, [...(by.get(k) ?? []), `${l.date} ${l.startTime} ${l.room}`]);
  }
  for (const [k, v] of by) process.stdout.write(`\n${k} (${v.length})\n  ${v.join('\n  ')}\n`);
}

main().catch((e) => {
  process.stderr.write(
    `\n❌ personas:check failed: ${e instanceof Error ? e.message : String(e)}\n`
  );
  process.exit(1);
});
