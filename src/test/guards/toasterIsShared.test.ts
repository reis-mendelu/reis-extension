import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

/**
 * Both trees mount ONE toast wrapper, `components/ui/sonner.tsx`, and its
 * dismissal behaviour (swipe up/left/right, tap to clear — see `toastTap.ts`)
 * lives there so the extension and the phone cannot drift apart.
 *
 * The desktop tree's Toaster is mounted in `App.tsx` itself, not under
 * Sidebar/AppMain/AppOverlays, so an import-closure view of "the desktop tree"
 * sees these two files as phone-only. They are not: this pins both mounts.
 * A mount that imports sonner's own Toaster, or overrides `swipeDirections`,
 * silently brings back the Pixel 9a bug — a top-center toast that only an
 * upward flick could clear, sitting over a sheet's Zpět.
 */
const read = (p: string) => readFileSync(resolve(process.cwd(), 'src', p), 'utf8');

describe('shared Toaster', () => {
  it.each([
    ['App.tsx', "from './components/ui/sonner'"],
    ['components/mobile/MobileApp.tsx', "from '../ui/sonner'"],
  ])('%s mounts the shared wrapper', (file, importPath) => {
    const src = read(file);
    expect(src).toContain(`import { Toaster } ${importPath}`);
    expect(src).not.toMatch(/<Toaster[^>]*swipeDirections/);
  });

  it('components/ui/sonner.tsx owns the dismissal behaviour from components/ui/toastTap.ts', () => {
    const src = read('components/ui/sonner.tsx');
    expect(src).toContain("['top', 'left', 'right']");
    expect(src).toContain('onClick={dismissTappedToast}');
    expect(read('components/ui/toastTap.ts')).toContain('export function dismissTappedToast');
  });
});
