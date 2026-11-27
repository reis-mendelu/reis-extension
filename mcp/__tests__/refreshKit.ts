// Shared by the mendelu_refresh tests: the overview's fake IS (overviewKit) and server processes
// on one folder (mapKit), plus the calls the tests make. The test files declare the vi.mock calls.
import { rm } from 'node:fs/promises';
import { afterEach } from 'vitest';
import { boot, tempDir, type Result } from './mapKit';

export const R = 'mendelu_refresh';
export type FileRow = {
  code: string;
  file: string;
  what: string;
  modified?: string;
  url?: string;
  outcome?: string;
};
export type Report = {
  first?: boolean;
  note: string;
  since?: string;
  changed?: {
    subjects?: string[];
    files?: FileRow[];
    points?: string[];
    assignments?: string[];
    exams?: string[];
    ledger?: string[];
  };
  downloaded: number;
  skipped: number;
  failed: number;
  stoppedAtBudget: boolean;
  recheck?: { id: string; title: string; reason: string }[];
  upcoming?: { title: string; daysLeft: number; attendance: string; recheck?: string }[];
  problems?: string[];
};

export const json = (r: Result) => {
  if (r.isError) throw new Error(r.content[0]!.text);
  return JSON.parse(r.content[0]!.text!) as Report;
};

export const refresh = async (s: ReturnType<typeof boot>) =>
  json(await s.call(R, { response_format: 'json' }));

const roots: string[] = [];
afterEach(async () => {
  for (const r of roots.splice(0)) await rm(r, { recursive: true, force: true });
});

export async function folder() {
  const t = await tempDir();
  roots.push(t.root);
  return t.dir;
}
