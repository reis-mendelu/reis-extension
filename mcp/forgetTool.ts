import { homedir } from 'node:os';
import type { Store } from './store';

// Named like the other tools (mendelu_) and in the words of the design record
// ("forget everything"), so a student who asks Claude to forget everything finds it.
export const FORGET_TOOL = {
  name: 'mendelu_forget_everything',
  title: 'Forget everything reIS saved',
  description:
    'Deletes everything reIS for Claude has saved on this computer: the subject list, folder listings, the text of every file read, the original course files saved by mendelu_read_file and mendelu_build_my_map, the study profile, the record of what the overview already reported and the list of upcoming events kept with mendelu_ledger, and empties its memory of this session. It changes nothing in IS Mendelu and nothing in any calendar, and it cannot remove what is already in a Claude conversation. Call it ONLY when the student explicitly asks to forget or delete what reIS saved; never as a fix for another problem. Reports what it removed.',
} as const;

const GB = 1024 ** 3;
const MB = 1024 ** 2;
const size = (b: number) => (b >= GB ? `${(b / GB).toFixed(1)} GB` : `${(b / MB).toFixed(1)} MB`);

/** The student's own folder, without the account name in it: this text goes into their chat. */
export const shown = (dir: string, home = homedir()) =>
  dir.startsWith(home) ? `~${dir.slice(home.length)}` : dir;

/**
 * The numbers are counted by the store under the same lock as the delete, so
 * they are what was really removed even with other tool calls running.
 */
export async function forgetEverything(store: Store, clearMemory: () => void) {
  clearMemory(); // first: a read in flight must not be kept or saved after this
  let removed: { files: number; bytes: number };
  try {
    removed = await store.forget();
  } catch (e) {
    // A folder reIS could not write this session cannot be emptied by it either:
    // say so instead of failing, because the memory side is done.
    if (store.persistent)
      throw new Error(
        `Could not delete everything in ${shown(store.dir)}. Some saved files may remain: close any program that has files there open and try again, or delete the folder yourself.`
      );
    return {
      forgotten: false,
      folder: shown(store.dir),
      note: `Memory is cleared, but reIS could not reach its folder this session (${(e as NodeJS.ErrnoException).code ?? 'unknown error'}), so saved files there may remain. Delete the folder yourself.`,
    };
  }
  return {
    forgotten: true,
    folder: shown(store.dir),
    filesRemoved: removed.files,
    removed: size(removed.bytes),
    note: 'Deleted what reIS had saved on this computer and cleared this session’s memory. Nothing was changed in IS Mendelu, and anything already shared in a Claude conversation stays there.',
  };
}
