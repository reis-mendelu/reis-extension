import { describe, it, expect } from 'vitest';
import { mainItems } from '../MainItems';

const t = (key: string) => key;

function confirmationEntry(lang: string) {
  const items = mainItems('143752', '812', t, lang);
  const isItem = items.find(i => i.id === 'is')!;
  return isItem.children!.find(c => c.id === 'potvrzeni-studia')!;
}

describe('mainItems — Potvrzení o studiu entry', () => {
  it('is the first entry in the "is" item\'s children', () => {
    const items = mainItems('143752', '812', t, 'cz');
    const isItem = items.find(i => i.id === 'is')!;
    expect(isItem.children![0].id).toBe('potvrzeni-studia');
  });

  it('builds the Czech instant-print URL without jazyk=eng', () => {
    expect(confirmationEntry('cz').href).toBe(
      'https://is.mendelu.cz/auth/student/tisk_dokumentu.pl?potvrzeni_tisk=1;studium=143752;lang=cz'
    );
  });

  it('adds jazyk=eng when reIS language is English', () => {
    expect(confirmationEntry('en').href).toBe(
      'https://is.mendelu.cz/auth/student/tisk_dokumentu.pl?potvrzeni_tisk=1;jazyk=eng;studium=143752;lang=en'
    );
  });

  it('uses the sidebar.confirmation i18n key for the label', () => {
    expect(confirmationEntry('cz').label).toBe('sidebar.confirmation');
  });
});
