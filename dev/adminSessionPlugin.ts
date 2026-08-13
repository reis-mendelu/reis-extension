// Matches how scripts/scrape-real-data.ts takes MENDELU_USER / MENDELU_PASS:
// a gitignored .env is this repo's existing home for local credentials. dotenv
// does not overwrite variables already in the environment, so `infisical run`
// (or a plain export) still wins over .env when both are present.
import 'dotenv/config';
import type { Plugin } from 'vite';
import { createClient } from '@supabase/supabase-js';
import { SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY } from '../src/services/supabase/config';
import { ADMIN_SESSION_ROUTE } from './adminSessionRoute';

/**
 * Dev-only: signs the webapp harness in as a real society / reIS-admin account
 * so the admin console can be exercised end-to-end against live Supabase.
 *
 * Why this exists: `VITE_DEV_SOCIETY` fakes a session and routes every write to
 * an in-memory store (src/utils/mock/devSociety.ts), so a publish there never
 * reaches Supabase and proves nothing about the real insert or its RLS policy.
 * Turning that off leaves a login form nobody can fill in automatically.
 *
 * The sign-in happens HERE, in the Vite dev server, not in the browser: the
 * password stays in the node process and never enters the client bundle. Only
 * the resulting session crosses to the page — exactly what a real login would
 * have put there anyway.
 *
 * Credentials come from the environment, so any source works:
 *
 *   infisical run --env=dev -- npm run dev:web:admin
 *
 * Absent credentials the route replies 204 and the harness simply shows the
 * normal login screen. This plugin is only ever registered by
 * vite.web.config.ts; `wxt build` never sees it, so it cannot reach production.
 */
/**
 * Which account to sign in as.
 *
 * Default is REIS_ADMIN_* — the reis_admin account, which the console's picker
 * lets author for every society, so it covers most testing on its own. Set
 * REIS_ADMIN_SOCIETY to an association id to sign in as that single society
 * instead, which is the only way to see what one association actually sees:
 *
 *   REIS_ADMIN_SOCIETY=esn npm run dev:web:admin
 *
 * Ids are lowercase (esn, supef, af, ldf, zf, au_frrms, reis) and map to
 * REIS_SOCIETY_<ID>_EMAIL / _PASSWORD, uppercased.
 */
function pickCredentials(society?: string): { email?: string; password?: string } {
  if (!society) {
    return { email: process.env.REIS_ADMIN_EMAIL, password: process.env.REIS_ADMIN_PASSWORD };
  }
  const key = society.trim().toUpperCase();
  const email = process.env[`REIS_SOCIETY_${key}_EMAIL`];
  const password = process.env[`REIS_SOCIETY_${key}_PASSWORD`];
  if (!email || !password) {
    // Loud, because the quiet failure — falling back to the reis_admin — would
    // look like it worked while testing the wrong role entirely.
    console.warn(
      `[reis] REIS_ADMIN_SOCIETY="${society}" has no REIS_SOCIETY_${key}_EMAIL/_PASSWORD configured`
    );
  }
  return { email, password };
}

export function reisAdminSessionPlugin(): Plugin {
  return {
    name: 'reis-dev-admin-session',
    apply: 'serve',
    configureServer(server) {
      server.middlewares.use(ADMIN_SESSION_ROUTE, async (_req, res) => {
        res.setHeader('content-type', 'application/json');
        res.setHeader('cache-control', 'no-store');

        const { email, password } = pickCredentials(process.env.REIS_ADMIN_SOCIETY);
        if (!email || !password) {
          // Not configured — not an error. The harness falls back to the login
          // screen, which is the default experience.
          res.statusCode = 204;
          res.end();
          return;
        }

        const client = createClient(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY, {
          auth: { persistSession: false, autoRefreshToken: false },
        });
        const { data, error } = await client.auth.signInWithPassword({ email, password });

        if (error || !data.session) {
          // Report only that it failed. The message can echo the address back,
          // and this lands in a terminal that may be shared in a screenshot.
          console.warn(`[reis] dev admin sign-in failed for REIS_ADMIN_EMAIL`);
          res.statusCode = 502;
          res.end(JSON.stringify({ error: 'sign_in_failed' }));
          return;
        }

        console.log(`[reis] dev admin session issued — admin console is live against Supabase`);
        res.statusCode = 200;
        res.end(
          JSON.stringify({
            access_token: data.session.access_token,
            refresh_token: data.session.refresh_token,
          })
        );
      });
    },
  };
}
