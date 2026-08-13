/**
 * Shared by the dev-server middleware (adminSessionPlugin.ts) and the browser
 * module that calls it (devAdminSession.ts).
 *
 * Its own file on purpose: importing the constant straight from the plugin
 * would pull the plugin's source — Vite types, a server-side Supabase client,
 * and `process.env` reads — into the browser bundle, purely to read one string.
 */
export const ADMIN_SESSION_ROUTE = '/__dev/admin-session';
