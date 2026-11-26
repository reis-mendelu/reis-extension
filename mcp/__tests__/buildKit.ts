// Shared by the build-my-map tests: a fake IS with one subject holding several files of
// different kinds, and a server process ("boot") on a folder with its own byte budget. The test
// files declare the vi.mock calls; this module only uses what they replace. Made-up names only.
import { beforeEach, vi } from 'vitest';
import { mkdtemp, readdir } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { fetchDualLanguageSubjects } from '../../src/api/subjects';
import { fetchFolderListing } from '../../src/api/documents/service';
import { registerTools } from '../register';
import { createStore } from '../store';
import type { Result } from './mapKit';

const FOLDER = 'https://is.mendelu.cz/auth/dok_server/slozka.pl?id=7';
export const link = (n: number) =>
  `https://is.mendelu.cz/auth/dok_server/slozka.pl?ds=1;id=7;download=${n}`;

type FakeFile = {
  name: string;
  type: string;
  body: string;
  status?: number;
  noName?: boolean;
  /** What IS declares as the size (content-length), when it declares one. */
  length?: number;
};

/** The fake IS: what is listed, what each download returns, and what reached it. */
export const lib = {
  files: [] as FakeFile[],
  modified: '20. 11. 2025',
  downloads: [] as string[],
  hold: null as null | Promise<void>,
  /** Appended to every download link (a long link makes a long record). */
  linkTail: '',
};

export const DEFAULT_FILES: FakeFile[] = [
  { name: 'harmonogram.txt', type: 'text/plain', body: 'Zápočet: 12. týden.' },
  { name: 'cviceni.zip', type: 'application/zip', body: 'PK-fake-zip-bytes' },
  { name: 'data.mat', type: 'application/octet-stream', body: 'MATLAB 5.0 MAT-file' },
  { name: 'poznamky.md', type: 'text/markdown', body: '# Poznámky\nTest v listopadu.' },
];

beforeEach(() => {
  lib.files = DEFAULT_FILES.map((f) => ({ ...f }));
  lib.modified = '20. 11. 2025';
  lib.downloads = [];
  lib.hold = null;
  lib.linkTail = '';
  vi.mocked(fetchDualLanguageSubjects).mockImplementation((async () => ({
    subjects: {
      data: {
        'EBC-XY': { code: 'EBC-XY', name: 'Ukázkový předmět', subjectId: '1', folderUrl: FOLDER },
      },
    },
  })) as never);
  vi.mocked(fetchFolderListing).mockImplementation((async () => ({
    complete: true,
    files: lib.files.map((f, i) => ({
      subfolder: '',
      file_name: f.name.replace(/\.[^.]+$/, ''),
      file_comment: '',
      author: 'A',
      date: '1. 10. 2025',
      modified: lib.modified,
      files: [{ name: 'x', type: 'x', link: link(i + 1) + lib.linkTail, filename: f.name }],
    })),
  })) as never);
});

export const fetchLib = (async (url: RequestInfo | URL) => {
  const u = String(url);
  lib.downloads.push(u);
  if (lib.hold) await lib.hold;
  const n = Number(/download=(\d+)/.exec(u)?.[1] ?? 0);
  const f = lib.files[n - 1];
  const bytes = new TextEncoder().encode(f?.body ?? '');
  const status = f?.status ?? (f ? 200 : 404);
  return {
    ok: status === 200,
    status,
    headers: {
      get: (h: string) =>
        ({
          'content-type': f?.type ?? 'text/plain',
          'content-disposition': f?.noName ? null : `attachment; filename="${f?.name ?? 'x'}"`,
          'content-length': f?.length !== undefined ? String(f.length) : null,
        })[h.toLowerCase()] ?? null,
    },
    body: null,
    arrayBuffer: async () =>
      bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength),
  };
}) as unknown as typeof fetch;

type Handler = (args: Record<string, unknown>) => Promise<Result>;

/** One server process on `dir`: its own store, its own memory. */
export function bootLib(dir: string, maxBytes?: number) {
  const handlers = new Map<string, Handler>();
  const server = {
    registerTool: (name: string, _meta: unknown, h: Handler) => handlers.set(name, h),
  } as unknown as McpServer;
  const store = createStore({ dir, ...(maxBytes !== undefined ? { maxBytes } : {}) });
  registerTools(server, { fetch: fetchLib }, store);
  const call = (name: string, args: Record<string, unknown> = {}) => handlers.get(name)!(args);
  const json = async (name: string, args: Record<string, unknown> = {}) => {
    const r = await call(name, { ...args, response_format: 'json' });
    if (r.isError) throw new Error(r.content[0]!.text);
    return JSON.parse(r.content[0]!.text!) as Record<string, unknown>;
  };
  return { call, json, store, handlers };
}

export async function tempDir() {
  const root = await mkdtemp(join(tmpdir(), 'reis-build-'));
  return { root, dir: join(root, 'reIS for Claude') };
}

/** Every file under the folder except forget's token, as relative paths. */
export async function files(dir: string): Promise<string[]> {
  const out: string[] = [];
  const walk = async (abs: string, rel: string) => {
    for (const e of await readdir(abs, { withFileTypes: true }).catch(() => [])) {
      const r = rel ? `${rel}/${e.name}` : e.name;
      if (e.isDirectory()) await walk(join(abs, e.name), r);
      else if (e.name !== '.generation') out.push(r);
    }
  };
  await walk(dir, '');
  return out.sort();
}
