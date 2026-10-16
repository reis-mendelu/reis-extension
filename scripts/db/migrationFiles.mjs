// File-level rules for supabase/migrations, from
// `git diff --name-status <base>`: a merged file is never edited, renamed or
// deleted (it may already be in prod), and a new one sorts after every merged
// one (`db push` refuses an older file, and it would apply out of order).
import { allowedRules } from './migrationLint.mjs';

const NAME = /^(\d{14})_[a-z0-9_]+\.sql$/;

/**
 * The one exception is a file a release FAILED to apply: it was rolled back
 * and is not in prod's ledger (`npm run db:drift` lists it as pending), and
 * while it stays broken every later release stops on it, so a new file after
 * it can never help. Fixing it in place is then correct, and the file says so:
 * `-- migration-lint: allow edit-unapplied: <how you know it never applied>`.
 *
 * @param {{ status: string, path: string }[]} changes
 * @param {string[]} baseFiles file names in supabase/migrations on the base branch
 * @param {(path: string) => string} [read] contents of a changed file
 * @returns {string[]} problems
 */
export function checkFileChanges(changes, baseFiles, read = () => '') {
  const problems = [];
  const newest =
    baseFiles
      .map((f) => NAME.exec(f)?.[1] ?? '')
      .sort()
      .pop() ?? '';
  for (const { status, path } of changes) {
    const file = path.split('/').pop() ?? path;
    if (status === 'M' && allowedRules(read(path)).has('edit-unapplied')) continue;
    if (status !== 'A') {
      problems.push(
        `${path}: ${status === 'D' ? 'deleted' : 'changed'}. A merged migration may already be in prod; add a new file instead.`
      );
      continue;
    }
    const m = NAME.exec(file);
    if (!m) {
      problems.push(`${path}: name it <14-digit timestamp>_<snake_case>.sql.`);
      continue;
    }
    if ((m[1] ?? '') <= newest) {
      problems.push(
        `${path}: timestamp ${m[1]} is not newer than ${newest}, the newest migration on the base branch. Rename it.`
      );
    }
  }
  return problems;
}
