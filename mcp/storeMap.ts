// What the tools read, kept in the store (step 2 of the map, docs/superpowers/
// specs/2026-11-25-reis-for-claude-map-design.md). Plain JSON files a student
// can open:
//   subjects.json         the list mendelu_subjects returned
//   listings/<CODE>.json  a subject's folder: each file's download link and modified date
//   text/<hash>.json      one file's whole extracted text, with the link and date it was read at,
//                         and the moment the read started
//   profile.json          study programme, form, year and semester (nothing that says who the student is)
// Saving never fails a tool: a folder that cannot be written is the store's
// business (it falls back to memory), anything else is swallowed here.
import { createHash } from 'node:crypto';
import type { Store } from './store';
import type { Persist } from './cacheTypes';

const SUBJECTS = 'mendelu_subjects';
const LIST = 'mendelu_subject_files';
const READ = 'mendelu_read_file';

/** The only fields of the student's study that are kept. Nothing that says who the student is. */
const PROFILE_FIELDS = [
  'facultyLabel',
  'studyProgram',
  'studyForm',
  'studyCode',
  'studyYear',
  'studySemester',
  'periodLabel',
] as const;
export type Profile = Partial<Record<(typeof PROFILE_FIELDS)[number], string | number>>;

type Json = Record<string, unknown>;
const isObject = (v: unknown): v is Json => !!v && typeof v === 'object' && !Array.isArray(v);

/** A file's place in the store: its link, not its name, because IS names can repeat or clash. */
export const textPath = (url: string) =>
  `text/${createHash('sha256').update(url).digest('hex').slice(0, 32)}.json`;

/** The moment a request began and the folder's forget token then (see store.write's `after`). */
type Token = { gen: string | null; at: number } | null | undefined;
const isToken = (t: unknown): t is NonNullable<Token> => isObject(t) && 'gen' in t && 'at' in t;

/**
 * IS's Modifikace is a date without a time, so a file replaced later the day it
 * was read would look unchanged. A stored text is therefore trusted only when
 * its read began on a later day than the date shown: any replacement after
 * the read then carries a different date. Same day, or no usable date, means
 * download again (the next read is saved under a later day and is trusted).
 */
export function readAfterModified(stamp: string, readAt: unknown): boolean {
  const m = /^modified\s+(\d{1,2})\.\s*(\d{1,2})\.\s*(\d{4})/.exec(stamp);
  const read = new Date(String(readAt));
  if (!m || Number.isNaN(read.getTime())) return false;
  try {
    const modified = `${m[3]}-${m[2]!.padStart(2, '0')}-${m[1]!.padStart(2, '0')}`;
    // IS dates are Czech dates, whatever the laptop's clock says.
    return read.toLocaleDateString('en-CA', { timeZone: 'Europe/Prague' }) > modified;
  } catch {
    return false;
  }
}

export function createMapPersist(
  store: Store,
  {
    now = Date.now,
    // false in the plugin build: it hands documents over whole, so it must not serve
    // the text the other build extracted, and it saves only text-native files.
    extractsText = true,
  }: { now?: () => number; extractsText?: boolean } = {}
) {
  // What was last kept, and the folder's forget token then: another process forgetting
  // changes the token, so the same profile is written again.
  let lastProfile = '';
  let lastGen: unknown;
  let profileWrite: Promise<unknown> = Promise.resolve();
  /** True if the store kept it; false if it was cancelled, refused or failed. */
  const put = async (path: string, body: Json, token?: Token): Promise<boolean> => {
    try {
      const at = isToken(token) ? token.at : now();
      return await store.write(
        path,
        JSON.stringify({ savedAt: new Date(at).toISOString(), ...body }),
        isToken(token) ? { after: token.gen } : {}
      );
    } catch {
      // an unusable name or a failing disk must not fail the tool that read the data
      return false;
    }
  };

  const persist: Persist = {
    // The time is taken first: a read that crosses midnight began on the earlier day.
    begin: async () => {
      const at = now();
      return { gen: await store.generation(), at };
    },

    async load(tool, args, stamp) {
      // Only a file's text is served from here: every listing still goes to IS.
      if (tool !== READ || !stamp || typeof args.url !== 'string') return undefined;
      try {
        const rec = JSON.parse((await store.readText(textPath(args.url))) ?? 'null') as unknown;
        // The date the listing shows now must be the one the text was read at.
        if (!isObject(rec) || rec.url !== args.url || rec.stamp !== stamp) return undefined;
        if (!readAfterModified(stamp, rec.savedAt)) return undefined;
        const f = rec.file;
        if (!isObject(f) || typeof f.text !== 'string' || typeof f.kind !== 'string')
          return undefined;
        return extractsText || f.kind === 'text' ? f : undefined;
      } catch {
        return undefined;
      }
    },

    async save(tool, args, value, stamp, token) {
      if (tool === SUBJECTS) {
        await put('subjects.json', { subjects: value }, token as Token);
        return;
      }
      if (tool === LIST && typeof args.code === 'string') {
        await put(`listings/${args.code}.json`, { code: args.code, files: value }, token as Token);
      }
      // The plugin build hands a document over whole (no text): its originals are step 5.
      if (tool === READ && typeof args.url === 'string' && isObject(value)) {
        if (typeof value.text !== 'string' || typeof value.kind !== 'string') return;
        if (!extractsText && value.kind !== 'text') return;
        await put(
          textPath(args.url),
          { url: args.url, stamp: stamp || null, file: value },
          token as Token
        );
      }
    },
  };

  /** Called with what getUserParams already holds: it never asks IS anything. */
  async function saveProfile(params: unknown, token?: unknown): Promise<void> {
    if (!isObject(params)) return;
    const profile: Profile = {};
    for (const k of PROFILE_FIELDS) {
      const v = params[k];
      if ((typeof v === 'string' && v) || typeof v === 'number') profile[k] = v;
    }
    const body = JSON.stringify(profile);
    const gen = isToken(token) ? token.gen : undefined;
    if (body === '{}' || (body === lastProfile && gen === lastGen)) return;
    profileWrite = put('profile.json', profile, token as Token).then((kept) => {
      if (kept) [lastProfile, lastGen] = [body, gen];
      return kept;
    });
    await profileWrite;
  }

  /** Resolves once the profile write a tool started has finished, so a restart cannot lose it. */
  const settled = () => profileWrite;

  /** After forget: the next profile seen is saved again. */
  const reset = () => {
    lastProfile = '';
    lastGen = undefined;
  };

  return { persist, saveProfile, settled, reset };
}
