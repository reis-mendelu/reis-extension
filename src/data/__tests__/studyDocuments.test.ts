import { describe, it, expect } from 'vitest';
import { STUDY_DOCUMENTS, buildDocumentUrl, type StudyDocument } from '../studyDocuments';

const STUDIUM = '149707';

describe('study documents catalog', () => {
  it('has both cs & en labels and a valid section for every entry', () => {
    for (const doc of STUDY_DOCUMENTS) {
      expect(doc.id).toBeTruthy();
      expect(doc.label.cs).toBeTruthy();
      expect(doc.label.en).toBeTruthy();
      expect(['sealed', 'plain']).toContain(doc.section);
      expect(doc.href).toContain('{{studium}}');
      expect(doc.href).toContain('{{lang}}');
    }
  });

  it('has unique ids', () => {
    const ids = STUDY_DOCUMENTS.map(d => d.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('covers both sealed and plain sections', () => {
    expect(STUDY_DOCUMENTS.some(d => d.section === 'sealed')).toBe(true);
    expect(STUDY_DOCUMENTS.some(d => d.section === 'plain')).toBe(true);
  });
});

describe('buildDocumentUrl', () => {
  const byId = (id: string): StudyDocument => {
    const doc = STUDY_DOCUMENTS.find(d => d.id === id);
    if (!doc) throw new Error(`missing doc ${id}`);
    return doc;
  };

  it('builds the exact scraped URL for the plain Potvrzení o studiu (cz)', () => {
    expect(buildDocumentUrl(byId('potvrzeni'), STUDIUM, 'cz')).toBe(
      'https://is.mendelu.cz/auth/student/tisk_dokumentu.pl?potvrzeni_tisk=1;studium=149707;lang=cz'
    );
  });

  it('builds the exact scraped URL for the sealed Potvrzení o studiu (cz)', () => {
    expect(buildDocumentUrl(byId('potvrzeni-sealed'), STUDIUM, 'cz')).toBe(
      'https://is.mendelu.cz/auth/student/tisk_dokumentu.pl?potvrzeni_tisk_el=1;studium=149707;lang=cz'
    );
  });

  it('keeps jazyk=eng on English content variants regardless of UI lang', () => {
    expect(buildDocumentUrl(byId('potvrzeni-en'), STUDIUM, 'cz')).toBe(
      'https://is.mendelu.cz/auth/student/tisk_dokumentu.pl?potvrzeni_tisk=1;jazyk=eng;studium=149707;lang=cz'
    );
  });

  it('builds the Přehled studia URL under the studijni path', () => {
    expect(buildDocumentUrl(byId('prehled'), STUDIUM, 'cz')).toBe(
      'https://is.mendelu.cz/auth/studijni/V7_tisk.pl?v7_tisk=1;studium=149707;lang=cz'
    );
  });

  it('builds the žádost URL', () => {
    expect(buildDocumentUrl(byId('zadost'), STUDIUM, 'cz')).toBe(
      'https://is.mendelu.cz/auth/student/zadost.pl?studium=149707;lang=cz'
    );
  });

  it('substitutes the UI lang param', () => {
    expect(buildDocumentUrl(byId('potvrzeni'), STUDIUM, 'en')).toContain('lang=en');
  });
});
