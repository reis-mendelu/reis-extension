// What the tools read, kept in the store (step 2 of the map, docs/superpowers/
// specs/2026-11-25-reis-for-claude-map-design.md). Plain JSON files a student
// can open:
//   subjects.json         the list mendelu_subjects returned
//   listings/<CODE>.json  a subject's folder: each file's download link and modified date
//   text/<hash>.json      one file's whole extracted text, with the link and date it was read at
//   profile.json          study programme, form, year and semester (nothing that says who the student is)
// Saving never fails a tool: a folder that cannot be written is the store's
// business (it falls back to memory), anything else is swallowed here.
import { createHash } from 'node:crypto';
import type { Store } from './store';
import type { Persist } from './cache';

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

export function createMapPersist(store: Store, now: () => number = Date.now) {
  let lastProfile = '';
  let profileWrite: Promise<unknown> = Promise.resolve();
  const put = async (path: string, body: Json) => {
    try {
      await store.write(path, JSON.stringify({ savedAt: new Date(now()).toISOString(), ...body }));
    } catch {
      // an unusable name or a failing disk must not fail the tool that read the data
    }
  };

  const persist: Persist = {
    async load(tool, args, stamp) {
      // Only a file's text is served from here: every listing still goes to IS.
      if (tool !== READ || !stamp || typeof args.url !== 'string') return undefined;
      try {
        const rec = JSON.parse((await store.readText(textPath(args.url))) ?? 'null') as unknown;
        // The date the listing shows now must be the one the text was read at.
        if (!isObject(rec) || rec.url !== args.url || rec.stamp !== stamp) return undefined;
        const f = rec.file;
        return isObject(f) && typeof f.text === 'string' && typeof f.kind === 'string'
          ? f
          : undefined;
      } catch {
        return undefined;
      }
    },

    async save(tool, args, value, stamp) {
      if (tool === SUBJECTS) return put('subjects.json', { subjects: value });
      if (tool === LIST && typeof args.code === 'string') {
        return put(`listings/${args.code}.json`, { code: args.code, files: value });
      }
      // The plugin build hands a document over whole (no text): its originals are step 5.
      if (tool === READ && typeof args.url === 'string' && isObject(value)) {
        if (typeof value.text !== 'string' || typeof value.kind !== 'string') return;
        return put(textPath(args.url), { url: args.url, stamp: stamp || null, file: value });
      }
    },
  };

  /** Called with what getUserParams already holds: it never asks IS anything. */
  async function saveProfile(params: unknown): Promise<void> {
    if (!isObject(params)) return;
    const profile: Profile = {};
    for (const k of PROFILE_FIELDS) {
      const v = params[k];
      if ((typeof v === 'string' && v) || typeof v === 'number') profile[k] = v;
    }
    const body = JSON.stringify(profile);
    if (body === '{}' || body === lastProfile) return;
    lastProfile = body;
    profileWrite = put('profile.json', profile);
    await profileWrite;
  }

  /** Resolves once the profile write a tool started has finished, so a restart cannot lose it. */
  const settled = () => profileWrite;

  return { persist, saveProfile, settled };
}
