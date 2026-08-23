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
