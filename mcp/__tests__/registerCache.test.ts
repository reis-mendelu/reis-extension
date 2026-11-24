import { describe, it, expect, vi } from 'vitest';
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';

const run = vi.fn(async (args: Record<string, unknown>) => ({
  code: args.code,
  n: run.mock.calls.length,
}));
vi.mock('../tools', () => ({
  TOOLS: [{ name: 'mendelu_subjects', title: 't', description: 'd', input: {}, run }],
}));

const { registerTools } = await import('../register');

type Handler = (args: Record<string, unknown>) => Promise<{
  isError?: boolean;
  content: { type: string; text?: string }[];
}>;

function serve(): Handler {
  const handlers = new Map<string, Handler>();
  const server = {
    registerTool: (name: string, _meta: unknown, h: Handler) => handlers.set(name, h),
  } as unknown as McpServer;
  registerTools(server, { fetch: vi.fn() });
  return handlers.get('mendelu_subjects')!;
}

describe('registerTools caches answers in memory', () => {
  it('answers a repeat without running the tool again, in either format', async () => {
    run.mockClear();
    const h = serve();
    const md = await h({ code: 'A' });
    const json = await h({ code: 'A', response_format: 'json' });
    expect(run).toHaveBeenCalledTimes(1);
    expect(md.content[0]!.text).toContain('A');
    expect(json.content[0]!.text).toContain('"n": 1');
  });

  it('gives each server its own memory', async () => {
    run.mockClear();
    await serve()({ code: 'B' });
    await serve()({ code: 'B' });
    expect(run).toHaveBeenCalledTimes(2);
  });
});
