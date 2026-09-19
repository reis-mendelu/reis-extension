/**
 * architecture-test.js
 * 
 * Verifies that data hooks do not import syncService directly.
 * Only src/store and src/services are allowed to interact with the sync layer.
 */
import { execSync } from 'child_process';
import { fileURLToPath } from 'url';
import path from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const HOOKS_DIR = path.resolve(__dirname, '../src/hooks');
const ILLEGAL_IMPORT = 'syncService';

console.log('🔍 Checking for illegal syncService imports in hooks...');

try {
    // Search for 'syncService' in src/hooks, excluding tests
    const output = execSync(`grep -r "${ILLEGAL_IMPORT}" ${HOOKS_DIR} --exclude-dir=__tests__ || true`).toString();
    
    const lines = output.split('\n').filter(line => line.trim() !== '');
    
    if (lines.length > 0) {
        console.error('\n❌ Architectural Violation Found!');
        console.error('The following hooks import syncService directly, bypassing the Zustand store:');
        lines.forEach(line => {
            const [file, content] = line.split(':');
            const relativePath = path.relative(path.resolve(__dirname, '..'), file);
            console.error(`  - ${relativePath}`);
        });
        console.error('\nAction Required: Refactor these hooks to use store selectors and move fetching logic to Zustand slices.');
        process.exit(1);
    } else {
        console.log('✅ No violations found. All hooks are store-compliant.');
        process.exit(0);
    }
} catch (error) {
    console.error('Error running architecture test:', error.message);
    process.exit(1);
}
