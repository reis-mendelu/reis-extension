import { Capacitor } from '@capacitor/core';
import { Calendar as OsCalendar } from '@capacitor/calendar';
import { Directory, Encoding, Filesystem } from '@capacitor/filesystem';
import { GoogleCalendarAuth } from './googleCalendarAuth';

/**
 * SPIKE harness, not product UI: a bare page of buttons and a log, mounted by
 * capacitor/main.capacitor.tsx only when the build sets VITE_GOOGLE_SPIKE=1.
 * Every button prints what the device actually did; the findings note quotes it.
 */
const CLIENT_ID = import.meta.env.VITE_GOOGLE_IOS_CLIENT_ID as string | undefined;
const CAL = 'https://www.googleapis.com/auth/';
const SCOPES = {
  readonly: [`${CAL}calendar.readonly`],
  eventsOnly: [`${CAL}calendar.events.readonly`],
  listOnly: [`${CAL}calendar.calendarlist.readonly`],
  pair: [`${CAL}calendar.events.readonly`, `${CAL}calendar.calendarlist.readonly`],
};
let current = SCOPES.readonly;
let token: string | null = null;

// Also appended to Documents/spike-log.txt so a cabled device's log can be pulled with
// `devicectl device copy from --domain-type appDataContainer` without tapping or screenshots.
const log = (m: unknown) => {
  const line = `${new Date().toISOString()}  ${typeof m === 'string' ? m : JSON.stringify(m)}`;
  console.log(`SPIKE ${line}`);
  const el = document.getElementById('log');
  if (el) el.textContent = `${line}\n\n${el.textContent}`;
  void Filesystem.appendFile({ path: 'spike-log.txt', data: `${line}\n`, directory: Directory.Documents, encoding: Encoding.UTF8 }).catch(() => undefined);
};

async function run(label: string, fn: () => Promise<unknown>) {
  try {
    log({ [label]: await fn() });
  } catch (e) {
    log({ [label]: 'ERROR', message: e instanceof Error ? e.message : String(e), raw: JSON.stringify(e) });
  }
}

const redact = (r: { accessToken: string | null }) => ({ ...r, accessToken: r.accessToken ? `${r.accessToken.slice(0, 8)}…(${r.accessToken.length})` : null });

async function get(url: string) {
  const r = await fetch(url, { headers: { Authorization: `Bearer ${token}` } });
  return { status: r.status, body: await r.json().catch(() => null) };
}

const iso = (d: number) => new Date(Date.now() + d * 864e5).toISOString();

const actions: [string, () => Promise<unknown>][] = [
  ['scope: calendar.readonly', async () => ((current = SCOPES.readonly), 'ok')],
  ['scope: events.readonly only', async () => ((current = SCOPES.eventsOnly), 'ok')],
  ['scope: calendarlist.readonly only', async () => ((current = SCOPES.listOnly), 'ok')],
  ['scope: events + calendarlist', async () => ((current = SCOPES.pair), 'ok')],
  ['1 Connect (account picker + consent)', async () => {
    const r = await GoogleCalendarAuth.connect({ clientId: CLIENT_ID, scopes: current });
    token = r.accessToken;
    setTimeout(() => void autoRun(), 500);
    return { scopes: current, ...redact(r) };
  }],
  ['2 Silent token (no UI)', async () => {
    const t0 = Date.now();
    const r = await GoogleCalendarAuth.getAccessToken({ clientId: CLIENT_ID, scopes: current });
    token = r.accessToken;
    return { ms: Date.now() - t0, tokenChanged: undefined, ...redact(r) };
  }],
  ['3 tokeninfo (granted scope, expires_in)', async () => get(`https://oauth2.googleapis.com/tokeninfo?access_token=${token}`)],
  ['4 calendarList', async () => get('https://www.googleapis.com/calendar/v3/users/me/calendarList?maxResults=5&fields=items(id,summary,accessRole)')],
  ['5 primary events (next 7 days)', async () =>
    get(`https://www.googleapis.com/calendar/v3/calendars/primary/events?singleEvents=true&orderBy=startTime&maxResults=10&timeMin=${encodeURIComponent(iso(0))}&timeMax=${encodeURIComponent(iso(7))}&fields=items(summary,start,end)`)],
  ['7 OS calendar: permission + calendars + next 7 days', async () => {
    const perm = await OsCalendar.requestPermissions({ permissions: ['readCalendar'] });
    const cals = await OsCalendar.listCalendars();
    const ev = await OsCalendar.findEvents({ startDate: Date.now(), endDate: Date.now() + 7 * 864e5 });
    return {
      perm,
      calendars: cals.calendars.map((c) => ({ name: c.name, displayName: c.displayName })),
      events: ev.events.map((e) => ({ title: e.title, start: e.startDate, calendar: e.calendarName })),
    };
  }],
  ['Disconnect', () => GoogleCalendarAuth.disconnect()],
];

export function mountSpike() {
  document.body.style.cssText = 'font:14px system-ui;padding:env(safe-area-inset-top) 12px 12px';
  document.body.innerHTML = `<h3>Google Calendar spike (${Capacitor.getPlatform()})</h3><div id="btns"></div><pre id="log" style="white-space:pre-wrap;word-break:break-all;font-size:11px"></pre>`;
  const box = document.getElementById('btns') as HTMLElement;
  for (const [label, fn] of actions) {
    const b = document.createElement('button');
    b.textContent = label;
    b.style.cssText = 'display:block;width:100%;margin:4px 0;padding:10px;font-size:15px';
    b.onclick = () => void run(label, fn);
    box.appendChild(b);
  }
  log(`ready · ${Capacitor.getPlatform()} · clientId ${CLIENT_ID ? 'set' : 'MISSING (needed on iOS)'}`);
  void autoRun();
}

/** On every launch: the silent path, then the three Google calls. Needs no taps once connected. */
async function autoRun() {
  for (const i of [5, 6, 7, 8]) {
    const entry = actions[i];
    if (!entry) continue;
    await run(`AUTO ${entry[0]}`, entry[1]);
  }
}
