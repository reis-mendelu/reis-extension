// Types for the plain-JS task-list logic. It stays .mjs so the CLI runs on
// bare Node in any cloud session, without a TS transform.
export interface TaskImage {
  id: string;
  /** Docs API contentUri — valid ~30 minutes after the read_doc call. */
  uri: string | null;
  /** Set by the CLI after a successful download: a ≤1000px JPEG preview. */
  file?: string;
  error?: string;
}
export interface Task {
  n: number;
  /** The subheading the task sits under inside the section, or null. */
  subsection: string | null;
  title: string;
  /** Lines under the title, in order; Claude's start "↳ Claude". */
  thread: { by: 'claude' | 'human'; text: string }[];
  status: 'new' | 'asked' | 'answered' | 'claimed' | 'done';
  /** From the markdown export; null when the line could not be matched. */
  done: boolean | null;
  start: number;
  titleEnd: number;
  textEnd: number;
  images: TaskImage[];
}
export declare const DEFAULT_SECTION: string;
export declare const SOFT_BREAK: string;
export declare const NOTE_MARK: string;
export declare const NOTE_END: string;
export interface UpdatePayload {
  requests: Record<string, any>[];
  writeControl: { requiredRevisionId: string };
}
export function unwrapDoc(json: unknown): {
  revisionId: string;
  body: unknown[];
  inlineObjects: Record<string, unknown>;
};
export function unwrapMarkdown(json: unknown): string;
export function findTasks(
  docJson: unknown,
  markdownJson: unknown,
  opts?: { section?: string }
): Task[];
