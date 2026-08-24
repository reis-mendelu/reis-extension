/**
 * Thrown instead of making a request while demo mode is on.
 *
 * Typed rather than a bare Error so one handler can turn it into "this is only
 * a demo" while real failures keep their own error paths.
 */
export class DemoModeError extends Error {
  constructor() {
    super('Blocked: reIS is in demo mode');
    this.name = 'DemoModeError';
  }
}

/**
 * Is demo mode on, readable without importing the store.
 *
 * The guards that need this — `fetchWithAuth`, `fetchAuthedBytes`,
 * `loadStoredToken`, `openExternal`, the file actions, the feedback writes —
 * sit *inside* the store's own dependency graph. Reading the flag through
 * `useAppStore` made each one an edge back into the store, and one of those
 * edges closed a cycle: createExamSlice → api/terminyInfo → api/client →
 * useAppStore → createExamSlice, which leaves `createExamSlice` undefined at
 * module evaluation and fails the whole store in CI.
 *
 * This module imports nothing, so reading the flag here cannot close a cycle.
 * `useAppStore` subscribes and pushes every change in, which keeps the store
 * the single source of truth and keeps `setState({ demoMode })` working in
 * tests.
 */
let demoMode = false;

export function setDemoModeFlag(on: boolean): void {
  demoMode = on;
}

export function isDemoMode(): boolean {
  return demoMode;
}
