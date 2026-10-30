// Types for the plain-JS watcher logic. It stays .mjs so the watcher runs on
// bare Node, without the repo's node_modules or a TS transform.
export interface WatchedPost {
  shortCode: string;
  url: string;
  timestamp: string;
  caption: string;
  /** Cover first, then up to four more carousel slides. */
  images: string[];
  type?: string | null;
  pinned: boolean;
}
export interface WatchedProfile {
  handle: string;
  posts: WatchedPost[];
}
export type NewPost = WatchedPost & {
  handle: string;
  society?: string | null;
  localImages?: string[];
};
export type HealthProblem =
  | { handle: string; problem: 'missing' | 'no-posts' }
  | { handle: string; problem: 'stale'; newestAt: string };

export declare function normalizeProfiles(items: unknown[]): WatchedProfile[];
export declare function findNewPosts(
  profiles: WatchedProfile[],
  seen: Record<string, string[]>,
  options?: { baseline?: boolean }
): { newPosts: NewPost[]; baselined: string[]; seen: Record<string, string[]> };
export declare function checkHealth(
  profiles: WatchedProfile[],
  handles: string[],
  now: Date,
  staleDays: number
): HealthProblem[];
export declare function formatDigest(run: {
  date: string;
  newPosts: NewPost[];
  baselined: string[];
  problems: HealthProblem[];
  costUsd?: number;
  profileCount: number;
}): string;
export declare const SAFE_NAME: RegExp;
