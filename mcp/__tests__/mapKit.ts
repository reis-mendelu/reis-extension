// Shared by the map persistence tests: a fake IS that counts what reaches it, and a
// server process ("boot") on a given folder. The test files declare the vi.mock
// calls (they must sit in the test file); this module only uses what they replace.
import { beforeEach, vi } from 'vitest';
import { mkdtemp, readdir } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { fetchDualLanguageSubjects } from '../../src/api/subjects';
import { fetchFolderListing } from '../../src/api/documents/service';
import { registerTools } from '../register';
import { createStore } from '../store';

export const DL = 'https://is.mendelu.cz/auth/dok_server/slozka.pl?ds=1;id=1;download=2';
const FOLDER = 'https://is.mendelu.cz/auth/dok_server/slozka.pl?id=1';
export const TEXT = 'Zápočtový test: 12. 1. 2027 v 9:00, místnost Q01.';

export type Result = { isError?: boolean; content: { type: string; text?: string }[] };
type Handler = (args: Record<string, unknown>) => Promise<Result>;

/** The fake IS: counts what reaches it, and what it answers can be changed per test. */
export const is = {
  subjects: 0,
  listings: 0,
  downloads: [] as string[],
  modified: '24. 11. 2025',
  body: TEXT,
  /** Holds a download open until released. */
  hold: null as null | Promise<void>,
};

beforeEach(() => {
  Object.assign(is, {
    subjects: 0,
    listings: 0,
    downloads: [],
    modified: '24. 11. 2025',
    body: TEXT,
  });
  is.hold = null;
  vi.mocked(fetchDualLanguageSubjects).mockImplementation((async () => {
    is.subjects++;
    return {
      subjects: {
        data: {
          'EBC-PS': {
            code: 'EBC-PS',
            name: 'Počítačové sítě',
            subjectId: '164074',
            folderUrl: FOLDER,
            fetchedAt: 1,
          },
        },
      },
    };
  }) as never);
  vi.mocked(fetchFolderListing).mockImplementation((async () => {
    is.listings++;
    return {
      complete: true,
      files: [
        {
          subfolder: '',
          file_name: 'Harmonogram',
          file_comment: '',
          author: 'A',
          date: '1. 10. 2026',
          modified: is.modified,
          files: [{ name: 'x', type: 'txt', link: DL, filename: 'harmonogram.txt' }],
        },
      ],
    };
  }) as never);
});

export const fetchFromIs = (async (url: RequestInfo | URL) => {
  is.downloads.push(String(url));
  if (is.hold) await is.hold;
  const bytes = new TextEncoder().encode(is.body);
  return {
    ok: true,
    status: 200,
    headers: {
      get: (n: string) =>
        ({
          'content-type': 'text/plain',
          'content-disposition': 'attachment; filename="harmonogram.txt"',
        })[n.toLowerCase()] ?? null,
    },
    arrayBuffer: async () =>
      bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength),
  };
}) as unknown as typeof fetch;

export async function tempDir() {
  const root = await mkdtemp(join(tmpdir(), 'reis-map-'));
  return { root, dir: join(root, 'reIS for Claude') };
}

/** One server process on `dir`: its own store, its own memory. */
export function boot(dir: string, opts: { unavailable?: string; maxBytes?: number } = {}) {
  const { maxBytes, ...extra } = opts;
  const handlers = new Map<string, Handler>();
  const metas = new Map<string, Record<string, unknown>>();
  const server = {
    registerTool: (name: string, meta: Record<string, unknown>, h: Handler) => {
      handlers.set(name, h);
      metas.set(name, meta);
    },
  } as unknown as McpServer;
  const store = createStore({ dir, ...(maxBytes !== undefined ? { maxBytes } : {}) });
  registerTools(server, { fetch: fetchFromIs, ...extra }, store);
  const call = (name: string, args: Record<string, unknown> = {}) => handlers.get(name)!(args);
  return { call, store, metas, handlers };
}

/** The question every test asks: subjects, the folder, then the file. */
export async function ask(s: ReturnType<typeof boot>) {
  await s.call('mendelu_subjects');
  await s.call('mendelu_subject_files', { code: 'EBC-PS' });
  return s.call('mendelu_read_file', { url: DL });
}
export const textOf = (r: Result) => r.content[0]!.text!;

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
