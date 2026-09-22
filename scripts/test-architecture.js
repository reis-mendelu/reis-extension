/**
 * architecture-test.js
 *
 * Verifies that data hooks do not import syncService directly.
 * Only src/store and src/services are allowed to interact with the sync layer.
 */
import { execFileSync } from 'child_process';
import { fileURLToPath } from 'url';
import path from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const HOOKS_DIR = path.resolve(__dirname, '../src/hooks');
const ILLEGAL_IMPORT = 'syncService';

console.log('🔍 Checking for illegal syncService imports in hooks...');

/**
 * grep, run WITHOUT a shell.
 *
 * This used to build one `execSync` string with the absolute hooks path
 * interpolated into it, which CodeQL flagged and which is wrong for a plainer
 * reason too: a checkout under a path containing a space — "My Projects/reis" —
 * made grep search two directories that do not exist, and the script then
 * reported a clean result because the `|| true` swallowed it. Passing the path
 * as an argument means the shell never sees it.
 *
 * `|| true` went with the shell, so grep's own exit codes are handled here
 * instead: 0 = matches, 1 = none (not an error), 2+ = a real failure.
 */
function grepHooks() {
  try {
    return execFileSync('grep', ['-r', ILLEGAL_IMPORT, HOOKS_DIR, '--exclude-dir=__tests__'], {
      encoding: 'utf8',
    });
  } catch (error) {
    if (error.status === 1) return ''; // nothing matched, which is the good case
    throw error;
  }
}

try {
  const lines = grepHooks()
    .split('\n')
    .filter((line) => line.trim() !== '');

  if (lines.length > 0) {
    console.error('\n❌ Architectural Violation Found!');
    console.error('The following hooks import syncService directly, bypassing the Zustand store:');
    lines.forEach((line) => {
      const file = line.split(':')[0];
      console.error(`  - ${path.relative(path.resolve(__dirname, '..'), file)}`);
    });
    console.error(
      '\nAction Required: Refactor these hooks to use store selectors and move fetching logic to Zustand slices.'
    );
    process.exit(1);
  } else {
    console.log('✅ No violations found. All hooks are store-compliant.');
    process.exit(0);
  }
} catch (error) {
  console.error('Error running architecture test:', error.message);
  process.exit(1);
}
