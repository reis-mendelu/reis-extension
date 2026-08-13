#!/usr/bin/env node
import { spawn, spawnSync } from 'node:child_process';
import { existsSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

/**
 * Runs a command with the reIS Infisical secrets injected, falling back to a
 * plain run when Infisical is not usable.
 *
 *   node scripts/with-secrets.mjs vite --config vite.web.config.ts
 *
 * Why a wrapper instead of putting `infisical run --` straight in the npm
 * script: that hard-fails for anyone who has not installed the CLI or logged
 * in, which would break `npm run dev:web:admin` for a fresh clone and for CI.
 * The fallback keeps the .env path (dev/adminSessionPlugin.ts loads dotenv)
 * working, and the harness itself already degrades to its login screen when no
 * credentials arrive at all — so every rung of the ladder lands somewhere sane.
 *
 * Infisical wins when present, because dotenv does not overwrite variables
 * already in the environment.
 */

const ENV = process.env.INFISICAL_ENV ?? 'dev';
const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const [command, ...args] = process.argv.slice(2);

if (!command) {
  console.error('usage: node scripts/with-secrets.mjs <command> [args...]');
  process.exit(1);
}

/**
 * Probe before committing to Infisical. Merely having the binary and a linked
 * project proves nothing — the login token expires, and a stale one makes
 * `infisical run` fail AFTER it has swallowed the command, which reads as the
 * dev server mysteriously refusing to start.
 */
function infisicalUsable() {
  if (!existsSync(resolve(ROOT, '.infisical.json'))) return false;
  if (spawnSync('infisical', ['--version'], { stdio: 'ignore' }).status !== 0) return false;
  const probe = spawnSync(
    'infisical',
    ['run', `--env=${ENV}`, '--silent', '--', 'node', '-e', ''],
    {
      cwd: ROOT,
      stdio: 'ignore',
    }
  );
  return probe.status === 0;
}

const useInfisical = infisicalUsable();
console.log(
  useInfisical
    ? `[reis] secrets: Infisical (${ENV})`
    : '[reis] secrets: .env / environment — Infisical unavailable, run `infisical login && infisical init` to use it'
);

const child = useInfisical
  ? spawn('infisical', ['run', `--env=${ENV}`, '--silent', '--', command, ...args], {
      stdio: 'inherit',
      cwd: ROOT,
    })
  : spawn(command, args, { stdio: 'inherit', cwd: ROOT });

child.on('exit', (code, signal) => {
  if (signal) process.kill(process.pid, signal);
  else process.exit(code ?? 0);
});
