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
