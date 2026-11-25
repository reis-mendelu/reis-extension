import type { Store } from './store';

// Named like the other tools (mendelu_) and in the words of the design record
// ("forget everything"), so a student who asks Claude to forget everything finds it.
export const FORGET_TOOL = {
  name: 'mendelu_forget_everything',
  title: 'Forget everything reIS saved',
  description:
    'Deletes everything reIS for Claude has saved on this computer: the subject list, folder listings, the text of every file read and the study profile, and empties its memory of this session. It changes nothing in IS Mendelu, and it cannot remove what is already in a Claude conversation. Call it ONLY when the student explicitly asks to forget or delete what reIS saved; never as a fix for another problem. Reports what it removed.',
} as const;

const GB = 1024 ** 3;
const MB = 1024 ** 2;
const size = (b: number) => (b >= GB ? `${(b / GB).toFixed(1)} GB` : `${(b / MB).toFixed(1)} MB`);

/** The numbers come from the files themselves, before and after, so the report is what really happened. */
export async function forgetEverything(store: Store, clearMemory: () => void) {
  const before = await store.usage();
  clearMemory(); // first: a read in flight must not be kept or saved after this
  await store.forget();
  const left = await store.usage();
  if (left.files > 0) {
    throw new Error(
      `Could not delete ${left.files} saved file(s) in ${store.dir}. Close any program that has them open and try again, or delete the folder yourself.`
    );
  }
  return {
    forgotten: true,
    folder: store.dir,
    filesRemoved: before.files,
    removed: size(before.bytes),
    note: store.persistent
      ? 'Deleted from this computer and from this session’s memory. Nothing was changed in IS Mendelu, and anything already shared in a Claude conversation stays there.'
      : 'reIS could not use its folder this session, so it only held things in memory; that is cleared. Nothing was changed in IS Mendelu.',
  };
}
