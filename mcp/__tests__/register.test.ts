import { describe, it, expect, vi } from 'vitest';
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { registerTools } from '../register';
import { NO_LOGIN_MESSAGE, noLoginFetch } from '../session';

type Handler = (args: Record<string, unknown>) => Promise<{
  isError?: boolean;
  content: { type: string; text?: string }[];
}>;

describe('registerTools without a login', () => {
  it('answers every tool with how to set the login, before any fetcher can hide it', async () => {
    const handlers = new Map<string, Handler>();
    const server = {
      registerTool: (name: string, _meta: unknown, h: Handler) => handlers.set(name, h),
    } as unknown as McpServer;
    const fetch = vi.fn(noLoginFetch);
    registerTools(server, { fetch, unavailable: NO_LOGIN_MESSAGE });

    for (const name of ['mendelu_schedule', 'mendelu_exams', 'mendelu_success_rates']) {
      const r = await handlers.get(name)!({});
      expect(r.isError, name).toBe(true);
      expect(r.content[0]!.text, name).toBe(`Error in ${name}: ${NO_LOGIN_MESSAGE}`);
    }
    expect(fetch).not.toHaveBeenCalled();
  });
});

describe('registerTools with an update notice', () => {
  it('adds the notice as one extra line to every result, errors included', async () => {
    const handlers = new Map<string, Handler>();
    const server = {
      registerTool: (name: string, _meta: unknown, h: Handler) => handlers.set(name, h),
    } as unknown as McpServer;
    let notice: string | null = null;
    registerTools(server, {
      fetch: vi.fn(noLoginFetch),
      unavailable: NO_LOGIN_MESSAGE,
      updateNotice: () => notice,
    });
    const h = handlers.get('mendelu_exams')!;
    expect((await h({})).content).toHaveLength(1);
    notice = 'Je venku nová verze';
    const r = await h({});
    expect(r.content).toHaveLength(2);
    expect(r.content[1]).toEqual({ type: 'text', text: 'Je venku nová verze' });
  });
});
