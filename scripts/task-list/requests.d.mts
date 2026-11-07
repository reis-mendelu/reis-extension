import type { Task, UpdatePayload } from './lib.mjs';

export function doneRequests(task: Task, revisionId: string, note?: string): UpdatePayload;
export function noteRequests(
  task: Task,
  revisionId: string,
  message: string,
  date: string,
  link?: string
): UpdatePayload;
export function pragueDate(now?: Date): string;
