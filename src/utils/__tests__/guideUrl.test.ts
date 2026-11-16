import { describe, expect, it } from 'vitest';
import { guideUrl } from '../guideUrl';

/**
 * Expected values are the live reisapp.cz addresses, written out by hand.
 * `?z=app` hides the site's install buttons; the hash opens one section.
 */
describe('guideUrl', () => {
  it('opens the guide index without a section', () => {
    expect(guideUrl('index', 'cz')).toBe('https://reisapp.cz/navody?z=app&utm_source=reis-app');
    expect(guideUrl('index', 'en')).toBe('https://reisapp.cz/en/guides?z=app&utm_source=reis-app');
  });

  it('opens each Czech guide', () => {
    expect(guideUrl('eduroam', 'cz')).toBe(
      'https://reisapp.cz/navody/eduroam?z=app&utm_source=reis-app'
    );
    expect(guideUrl('exams', 'cz')).toBe(
      'https://reisapp.cz/navody/prihlaseni-na-zkousku?z=app&utm_source=reis-app'
    );
    expect(guideUrl('subjects', 'cz')).toBe(
      'https://reisapp.cz/navody/predmety?z=app&utm_source=reis-app'
    );
    expect(guideUrl('isic', 'cz')).toBe(
      'https://reisapp.cz/navody/dobiti-isic?z=app&utm_source=reis-app'
    );
    expect(guideUrl('map', 'cz')).toBe(
      'https://reisapp.cz/navody/mapa-kampusu?z=app&utm_source=reis-app'
    );
    expect(guideUrl('dorms', 'cz')).toBe(
      'https://reisapp.cz/navody/koleje?z=app&utm_source=reis-app'
    );
  });

  it('opens each English guide', () => {
    expect(guideUrl('eduroam', 'en')).toBe(
      'https://reisapp.cz/en/guides/eduroam?z=app&utm_source=reis-app'
    );
    expect(guideUrl('exams', 'en')).toBe(
      'https://reisapp.cz/en/guides/exam-registration?z=app&utm_source=reis-app'
    );
    expect(guideUrl('subjects', 'en')).toBe(
      'https://reisapp.cz/en/guides/subjects?z=app&utm_source=reis-app'
    );
    expect(guideUrl('isic', 'en')).toBe(
      'https://reisapp.cz/en/guides/isic-top-up?z=app&utm_source=reis-app'
    );
    expect(guideUrl('map', 'en')).toBe(
      'https://reisapp.cz/en/guides/campus-map?z=app&utm_source=reis-app'
    );
    expect(guideUrl('dorms', 'en')).toBe(
      'https://reisapp.cz/en/guides/dorms?z=app&utm_source=reis-app'
    );
  });

  it('opens the troubleshooting section in Czech', () => {
    expect(guideUrl('eduroam', 'cz', 'troubleshoot')).toBe(
      'https://reisapp.cz/navody/eduroam?z=app&utm_source=reis-app#nefunguje'
    );
    expect(guideUrl('isic', 'cz', 'troubleshoot')).toBe(
      'https://reisapp.cz/navody/dobiti-isic?z=app&utm_source=reis-app#nefunguje'
    );
    expect(guideUrl('exams', 'cz', 'troubleshoot')).toBe(
      'https://reisapp.cz/navody/prihlaseni-na-zkousku?z=app&utm_source=reis-app#nejde'
    );
    expect(guideUrl('subjects', 'cz', 'troubleshoot')).toBe(
      'https://reisapp.cz/navody/predmety?z=app&utm_source=reis-app#nejde'
    );
  });

  it('opens the troubleshooting section in English', () => {
    expect(guideUrl('eduroam', 'en', 'troubleshoot')).toBe(
      'https://reisapp.cz/en/guides/eduroam?z=app&utm_source=reis-app#not-working'
    );
    expect(guideUrl('isic', 'en', 'troubleshoot')).toBe(
      'https://reisapp.cz/en/guides/isic-top-up?z=app&utm_source=reis-app#not-working'
    );
    expect(guideUrl('exams', 'en', 'troubleshoot')).toBe(
      'https://reisapp.cz/en/guides/exam-registration?z=app&utm_source=reis-app#cant-register'
    );
    expect(guideUrl('subjects', 'en', 'troubleshoot')).toBe(
      'https://reisapp.cz/en/guides/subjects?z=app&utm_source=reis-app#no-files'
    );
  });

  it('opens the official way in both languages', () => {
    expect(guideUrl('isic', 'cz', 'official')).toBe(
      'https://reisapp.cz/navody/dobiti-isic?z=app&utm_source=reis-app#oficialne'
    );
    expect(guideUrl('subjects', 'cz', 'official')).toBe(
      'https://reisapp.cz/navody/predmety?z=app&utm_source=reis-app#oficialne'
    );
    expect(guideUrl('dorms', 'cz', 'official')).toBe(
      'https://reisapp.cz/navody/koleje?z=app&utm_source=reis-app#oficialne'
    );
    expect(guideUrl('isic', 'en', 'official')).toBe(
      'https://reisapp.cz/en/guides/isic-top-up?z=app&utm_source=reis-app#official'
    );
    expect(guideUrl('subjects', 'en', 'official')).toBe(
      'https://reisapp.cz/en/guides/subjects?z=app&utm_source=reis-app#official'
    );
    expect(guideUrl('map', 'en', 'official')).toBe(
      'https://reisapp.cz/en/guides/campus-map?z=app&utm_source=reis-app#official'
    );
  });

  it('drops a section the guide does not have rather than inventing one', () => {
    expect(guideUrl('map', 'cz', 'troubleshoot')).toBe(
      'https://reisapp.cz/navody/mapa-kampusu?z=app&utm_source=reis-app'
    );
    expect(guideUrl('dorms', 'en', 'troubleshoot')).toBe(
      'https://reisapp.cz/en/guides/dorms?z=app&utm_source=reis-app'
    );
    expect(guideUrl('index', 'cz', 'official')).toBe(
      'https://reisapp.cz/navody?z=app&utm_source=reis-app'
    );
  });

  it('treats anything that is not Czech as English', () => {
    expect(guideUrl('index', 'cs')).toBe('https://reisapp.cz/en/guides?z=app&utm_source=reis-app');
  });
});
