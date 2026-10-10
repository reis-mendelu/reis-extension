import { toMarkdown } from './markdown';

export const CHARACTER_LIMIT = 25000;
export type ResponseFormat = 'markdown' | 'json';

// Same semantics as reis-scraper src/mcp/format.ts (ca06091). Claude Code shows
// structuredContent in place of the text, so markdown mode must not attach it,
// and json mode attaches it only while it fits. No tool may declare an
// outputSchema: the SDK then rejects every result without structuredContent.
export function toResult(data: unknown, format: ResponseFormat) {
  let text = format === 'json' ? JSON.stringify(data, null, 2) : toMarkdown(data);
  const truncated = text.length > CHARACTER_LIMIT;
  if (truncated) {
    text = `${text.slice(0, CHARACTER_LIMIT)}\n\n[truncated at ${CHARACTER_LIMIT} chars — ask a narrower question]`;
  }
  const content = [{ type: 'text' as const, text }];
  if (format !== 'json' || truncated) return { content };
  const structuredContent =
    data && typeof data === 'object' && !Array.isArray(data)
      ? (data as Record<string, unknown>)
      : { value: data };
  if (JSON.stringify(structuredContent).length > CHARACTER_LIMIT) return { content };
  return { content, structuredContent };
}

export function toError(tool: string, e: unknown) {
  const msg = e instanceof Error ? e.message : String(e);
  return {
    isError: true as const,
    content: [{ type: 'text' as const, text: `Error in ${tool}: ${msg}` }],
  };
}
