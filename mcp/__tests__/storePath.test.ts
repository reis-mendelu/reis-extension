import { describe, it, expect } from 'vitest';
import { resolveStoreDir, safeRelPath, StorePathError } from '../storePath';

describe('resolveStoreDir', () => {
  it('macOS: Application Support under the home folder', () => {
    expect(resolveStoreDir({ platform: 'darwin', env: {}, homedir: '/Users/anna' })).toBe(
      '/Users/anna/Library/Application Support/reIS for Claude'
    );
  });

  it('Windows: %LOCALAPPDATA%\\reIS for Claude', () => {
    const dir = resolveStoreDir({
      platform: 'win32',
      env: { LOCALAPPDATA: 'C:\\Users\\anna\\AppData\\Local' },
      homedir: 'C:\\Users\\anna',
    });
    expect(dir).toBe('C:\\Users\\anna\\AppData\\Local\\reIS for Claude');
  });

  it.each([
    ['missing', {}],
    ['empty', { LOCALAPPDATA: '' }],
    ['relative', { LOCALAPPDATA: 'AppData\\Local' }],
  ])('Windows: falls back to homedir + AppData/Local when the variable is %s', (_n, env) => {
    expect(resolveStoreDir({ platform: 'win32', env, homedir: 'C:\\Users\\anna' })).toBe(
      'C:\\Users\\anna\\AppData\\Local\\reIS for Claude'
    );
  });

  it('Linux (Claude Code): XDG data home, else ~/.local/share', () => {
    expect(
      resolveStoreDir({ platform: 'linux', env: { XDG_DATA_HOME: '/data' }, homedir: '/home/a' })
    ).toBe('/data/reIS for Claude');
    expect(resolveStoreDir({ platform: 'linux', env: {}, homedir: '/home/a' })).toBe(
      '/home/a/.local/share/reIS for Claude'
    );
  });

  it('never uses a plugin folder, Documents or Desktop', () => {
    const env = { CLAUDE_PLUGIN_DATA: '/plugin/data', CLAUDE_PLUGIN_ROOT: '/plugin/root' };
    for (const platform of ['darwin', 'win32', 'linux'] as const) {
      const dir = resolveStoreDir({ platform, env, homedir: '/h' });
      expect(dir).not.toMatch(/plugin|Documents|Desktop/i);
    }
  });
});

describe('safeRelPath', () => {
  it.each([
    'subjects/EBC-ALG/lecture 1.pdf',
    'subjects/čeština/příklad ěščř.txt',
    'a/b/c.md',
    '.hidden',
    'a.b.c',
  ])('accepts %s', (p) => {
    expect(safeRelPath(p)).toBe(p);
  });

  const escapes: Array<[string, unknown]> = [
    ['empty', ''],
    ['blank', '   '],
    ['dot-dot', '..'],
    ['leading dot-dot', '../x'],
    ['nested dot-dot', 'a/../../x'],
    ['trailing dot-dot', 'a/..'],
    ['single dot segment', './a'],
    ['dot in the middle', 'a/./b'],
    ['empty segment', 'a//b'],
    ['trailing slash', 'a/'],
    ['absolute posix', '/etc/passwd'],
    ['absolute windows', 'C:\\x'],
    ['drive letter, forward slashes', 'C:/x'],
    ['drive-relative', 'C:x'],
    ['UNC', '\\\\server\\share\\x'],
    ['backslash separator', 'a\\b'],
    ['backslash dot-dot', '..\\x'],
    ['mixed dot-dot', 'a/..\\..\\x'],
    ['NUL byte', 'a\0b'],
    ['NUL after a valid name', 'ok.txt\0../../x'],
    ['control character', 'a\nb'],
    ['alternate data stream', 'file.txt:stream'],
    ['reserved device name', 'con'],
    ['reserved device with extension', 'NUL.txt'],
    ['nested reserved device', 'a/COM1'],
    ['trailing dot (Windows trims it)', 'a.'],
    ['three dots', 'a/...'],
    ['trailing space (Windows trims it)', 'a /b'],
    ['wildcard', 'a/*.pdf'],
    ['question mark', 'a?.pdf'],
    ['angle brackets', 'a<b>.pdf'],
    ['a device name with a space before the extension', 'con .txt'],
    ['a superscript device name', 'COM\u00b9'],
    ['a console device', 'a/CONIN$'],
    ['the index file in other case', 'INDEX.JSON'],
    ['the generation token', '.generation'],
    ['the index file', 'index.json'],
    ['a temp file name', '.tmp-123-abc'],
    ['a temp file name deeper', 'a/.tmp-1-x'],
    ['a name over 255 bytes', 'a/' + 'x'.repeat(256)],
    ['a path over 200 characters', Array.from({ length: 70 }, () => 'abcdefg').join('/')],
    ['null', null],
    ['undefined', undefined],
    ['a number', 123],
    ['an array', ['a']],
    ['an object with toString', { toString: () => 'a' }],
  ];
  it.each(escapes)('rejects %s', (_name, p) => {
    expect(() => safeRelPath(p)).toThrow(StorePathError);
  });
});
