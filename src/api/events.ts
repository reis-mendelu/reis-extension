import type { MendeluEvent, FacultyKey } from '../types/events';
import { COLOR_TO_FACULTY } from '../types/events';
import { fetchViaProxy } from './proxyClient';

const API_URL = 'https://mendelu.cz/wp-json/mendelu/v1/event-list/html';

const LANG_CONFIG = {
  cz: { lang: 'cs', categories: [351, 1023], limit: 10 },
  en: { lang: 'en', categories: [353, 359, 355, 420], limit: 9 },
} as const;

function parseEventsFromHtml(html: string): MendeluEvent[] {
  const parser = new DOMParser();
  const doc = parser.parseFromString(`<div>${html}</div>`, 'text/html');
  const cards = doc.querySelectorAll('a.event-card');
  const events: MendeluEvent[] = [];

  for (const card of cards) {
    const title = card.querySelector('.event-card__heading')?.textContent?.trim() ?? '';
    const href = card.getAttribute('href') ?? '';

    const infoItems = card.querySelectorAll('.event-card__info-item');
    const texts = Array.from(infoItems).map(el => el.textContent?.replace(/\s+/g, ' ').trim() ?? '');

    const rawDate = texts[0] ?? '';
    const dateParts = rawDate.split('–').map(s => s.replace(/\u00a0/g, ' ').trim());
    const date = dateParts[0] ?? '';
    const endDate = dateParts[1] || null;

    let time: string | null = null;
    let location: string | null = null;
    for (let i = 1; i < texts.length; i++) {
      const t = texts[i];
      if (/\d{1,2}:\d{2}/.test(t) && !time) time = t;
      else if (t && !location) location = t;
    }

    const imgDiv = card.querySelector('.event-card__image');
    const style = imgDiv?.getAttribute('style') ?? '';
    const imgMatch = style.match(/url\(\s*(.*?)\s*\)/);
    const imageUrl = imgMatch?.[1]?.trim() || null;

    const dateDay = card.querySelector('.event-card__date-day');
    const dateStyle = dateDay?.getAttribute('style') ?? '';
    const colorMatch = dateStyle.match(/#[a-f0-9]+/i);
    const color = colorMatch?.[0]?.toLowerCase() ?? '';
    const organizerKey: FacultyKey = COLOR_TO_FACULTY[color] ?? 'mendelu';

    events.push({ title, url: href, date, endDate, time, location, imageUrl, organizerKey });
  }

  return events;
}

async function fetchEventPage(lang: string, page: number, categories: readonly number[], limit: number): Promise<string> {
  const body = JSON.stringify({ page, limit, categories: [...categories], faculties: [], lang });
  const raw = await fetchViaProxy(API_URL, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body });
  const json = JSON.parse(raw) as { html: string };
  return json.html;
}

export async function fetchEvents(lang: 'cz' | 'en'): Promise<MendeluEvent[]> {
  const config = LANG_CONFIG[lang];
  const allEvents: MendeluEvent[] = [];

  for (let page = 1; page <= 10; page++) {
    const html = await fetchEventPage(config.lang, page, config.categories, config.limit);
    const events = parseEventsFromHtml(html);
    if (events.length === 0) break;
    allEvents.push(...events);
    if (events.length < config.limit) break;
  }

  return allEvents;
}
