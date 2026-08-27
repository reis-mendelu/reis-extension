/**
 * The action name exists in three places that must agree:
 *
 *   1. the Zod enum   (types/messages/schema.ts) — what the boundary ACCEPTS
 *   2. ActionType     (types/messages/base.ts)   — now `z.infer` of (1), so free
 *   3. the switch     (injector/messageHandler.ts) — what actually RUNS
 *
 * (1) and (2) can no longer drift; deriving the type closed that. (1) and (3)
 * still can, and the direction that bites is silent: an action the enum accepts
 * but the dispatcher has no case for is validated, dispatched, and falls through
 * to `default: throw`, surfacing as a generic failure with no clue why.
 *
 * The reverse — a case for an action the enum rejects — is the original
 * push_notes_html bug: the handler was written, the sender sent it, and every
 * message was discarded at the guard. That one shipped.
 *
 * Deriving the type only protects actions that reach a TYPED call site. Several
 * (register_exam, unregister_exam) are dispatched by name from the iframe with no
 * typed sender in this repo, so the compiler cannot see them at all. This test is
 * what covers those.
 */

import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { actionType } from '../schema';

const HANDLER = resolve(__dirname, '../../../injector/messageHandler.ts');

/** The `case '...':` labels inside handleAction. */
function handlerCases(): string[] {
  const src = readFileSync(HANDLER, 'utf-8');
  const start = src.indexOf('async function handleAction');
  expect(start, 'handleAction not found — did it move or get renamed?').toBeGreaterThan(-1);
  const body = src.slice(start);
  return [...body.matchAll(/case '([a-z_]+)':/g)].map((m) => m[1]!);
}

describe('action name parity', () => {
  it('every action the validator accepts has a handler case', () => {
    const cases = new Set(handlerCases());
    const missing = actionType.options.filter((a) => !cases.has(a));

    // A member here is accepted at the boundary and then hits `default: throw`,
    // so the student gets "Unknown action" for something the app formally
    // supports.
    expect(missing, `enum members with no handler case: ${missing.join(', ')}`).toEqual([]);
  });

  it('every handler case is an action the validator accepts', () => {
    const allowed = new Set<string>(actionType.options);
    const orphans = handlerCases().filter((c) => !allowed.has(c));

    // This is exactly the push_notes_html bug: a handler that can never run
    // because the guard rejects the message before the switch is reached.
    expect(orphans, `handler cases the validator rejects: ${orphans.join(', ')}`).toEqual([]);
  });
});
