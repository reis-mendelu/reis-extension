// What the tools read, kept in the store (step 2 of the map, docs/superpowers/
// specs/2026-11-25-reis-for-claude-map-design.md). Plain JSON files a student
// can open:
//   subjects.json         the list mendelu_subjects returned
//   listings/<CODE>.json  a subject's folder: each file's download link and modified date
//   text/<hash>.json      one file's whole extracted text, with the link and date it was read at,
//                         and the moment the read started
//   profile.json          study programme, form, year and semester (nothing that says who the student is)
//   originals/<hash>/     a file's original bytes and when they were read (storeOriginals.ts)
// Saving never fails a tool: a folder that cannot be written is the store's
// business (it falls back to memory), anything else is swallowed here.
import type { Store } from './store';
import type { Persist } from './cacheTypes';
import { keptText, textBody, textPath } from './storeText';
import { createOriginals } from './storeOriginals';
import { takeOriginal } from './originalCarry';

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

/** The moment a request began and the folder's forget token then (see store.write's `after`). */
type Token = { gen: string | null; at: number } | null | undefined;
const isToken = (t: unknown): t is NonNullable<Token> => isObject(t) && 'gen' in t && 'at' in t;

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
  const originals = createOriginals(store, now);
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
        // The plugin build hands a kept original back by its path first, never inlined again;
        // its saved text (plain-text files only) is the fallback. The .mcpb serves text only.
        const path = extractsText ? undefined : await originals.handBack(args.url, stamp);
        if (path) return path;
        const rec = JSON.parse((await store.readText(textPath(args.url))) ?? 'null') as unknown;
        return keptText(rec, args.url, stamp, extractsText);
      } catch {
        return undefined;
      }
    },

    async stillValid(tool, args, value, stamp) {
      if (tool !== READ || !isObject(value) || value.kind !== 'saved file') return true;
      return !!stamp && typeof args.url === 'string' && !!(await originals.kept(args.url, stamp));
    },

    async save(tool, args, value, stamp, token) {
      if (tool === SUBJECTS) {
        await put('subjects.json', { subjects: value }, token as Token);
        return;
      }
      if (tool === LIST && typeof args.code === 'string') {
        await put(`listings/${args.code}.json`, { code: args.code, files: value }, token as Token);
      }
      // The bytes the read downloaded ride along with its answer (originalCarry.ts): kept
      // once, under the date the listing showed when the download began.
      const original = tool === READ ? takeOriginal(value) : undefined;
      const kept =
        original && stamp && typeof args.url === 'string'
          ? await originals
              .save({ url: args.url, stamp, ...original, token: token as Token })
              .catch(() => undefined)
          : undefined;
      // The plugin build handed the file over whole: once its original is kept, a repeat read
      // in this process gets the saved path, not the bytes again. Unsaved: the bytes stay.
      if (kept && !extractsText && isObject(value) && 'handover' in value) {
        const path = await originals.handBack(args.url as string, stamp!);
        return path ? { replaceWith: path } : undefined;
      }
      // The plugin build hands a document over whole (no text): only its original is kept.
      if (tool === READ && typeof args.url === 'string' && isObject(value)) {
        if (typeof value.text !== 'string' || typeof value.kind !== 'string') return;
        if (!extractsText && value.kind !== 'text') return;
        await put(textPath(args.url), textBody(args.url, stamp, value), token as Token);
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

  /**
   * A file's text as mendelu_read_file saves it, for build and refresh: true only once the store
   * has it, so a text the store refused is never counted (buildDownload.ts keepText).
   */
  const saveText = (url: string, value: unknown, stamp: string, token: unknown) =>
    isObject(value) &&
    typeof value.text === 'string' &&
    typeof value.kind === 'string' &&
    (extractsText || value.kind === 'text')
      ? put(textPath(url), textBody(url, stamp, value as never), token as Token)
      : Promise.resolve(false);

  return { persist, saveProfile, settled, reset, saveText };
}
