// Assembling the Discord message, kept separate from the handler so it can be
// tested: it imports no Deno globals, and vitest picks it up via the
// `supabase/**` include in vitest.config.ts.
//
// It lives apart for a reason found in review. The relay caps each field on its
// own — message 1200, contact 120, context 900 — and a comment claimed that put
// the result "well under" Discord's limit. It does not: those caps are additive,
// and a maximal report assembled to **2295** characters. Discord rejects the
// payload, the relay answers 502, and a student who wrote a long careful bug
// report is told it failed. Per-field caps cannot express a limit on the sum,
// so the budget is enforced here, on the assembled string, which is the thing
// Discord actually measures.

/** Discord's documented maximum for a webhook message's `content`. */
export const DISCORD_CONTENT_LIMIT = 2000;

const MARKER = '\n…[zkráceno]';

/** Below this there is no room for useful JSON, so the block is dropped whole. */
const MIN_CONTEXT = 80;

export interface ReportParts {
  type: string;
  contact: string;
  message: string;
  context: unknown;
}

/**
 * Discord renders markdown, so a fence typed into a report — or appearing in
 * the diagnostic JSON — would otherwise close the block early and reformat
 * everything after it. The zero-width space between the backticks is what stops
 * that without deleting the characters the reporter actually typed.
 */
function defang(text: string): string {
  return text.replace(/```/g, '`​``');
}

function truncate(text: string, budget: number): string {
  if (text.length <= budget) return text;
  if (budget <= MARKER.length) return '';
  return text.slice(0, budget - MARKER.length) + MARKER;
}

/**
 * Build the channel message, trimming to fit `DISCORD_CONTENT_LIMIT`.
 *
 * Order matters and it is a product decision, not an implementation detail: the
 * diagnostic JSON gives way first, and is dropped entirely before a single
 * character the student typed is cut. What they wrote is the report; the
 * context is a convenience for whoever triages it.
 */
export function buildContent(parts: ReportParts): string {
  const head =
    `**Typ:** ${parts.type}\n` +
    `**Kontakt:** ${defang(parts.contact) || 'N/A'}\n` +
    `**Zpráva:**\n`;
  const open = '\n\n__Technické info:__\n```json\n';
  const close = '\n```';

  let message = defang(parts.message);
  let context = defang(JSON.stringify(parts.context ?? {}, null, 2));

  const length = (m: string, c: string) =>
    head.length + m.length + (c ? open.length + c.length + close.length : 0);

  // 1. Trim the diagnostics into whatever the message leaves behind, dropping
  //    the block outright if what remains is too small to be worth reading.
  if (length(message, context) > DISCORD_CONTENT_LIMIT) {
    const room = DISCORD_CONTENT_LIMIT - head.length - message.length - open.length - close.length;
    context = room >= MIN_CONTEXT ? truncate(context, room) : '';
  }

  // 2. Only if the message alone still overflows does it get cut.
  if (length(message, context) > DISCORD_CONTENT_LIMIT) {
    message = truncate(message, DISCORD_CONTENT_LIMIT - head.length);
  }

  return context ? head + message + open + context + close : head + message;
}
