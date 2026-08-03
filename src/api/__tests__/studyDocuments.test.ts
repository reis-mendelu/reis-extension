import { describe, it, expect } from 'vitest';
import {
  STUDY_DOCUMENTS,
  buildDocumentUrl,
  buildFallbackDocumentUrl,
  buildZadostUrl,
} from '../studyDocuments';

const byId = (id: string) => STUDY_DOCUMENTS.find((d) => d.id === id)!;

describe('studyDocuments catalog', () => {
  it('lists the five one-click documents in order', () => {
    expect(STUDY_DOCUMENTS.map((d) => d.id)).toEqual([
      'potvrzeni-cz',
      'potvrzeni-en',
      'prehled-cz',
      'prehled-en',
      'reg-arch',
    ]);
  });

  it('builds the sealed Czech confirmation URL', () => {
    expect(buildDocumentUrl('149707', byId('potvrzeni-cz'))).toBe(
      'https://is.mendelu.cz/auth/student/tisk_dokumentu.pl?potvrzeni_tisk_el=1;studium=149707;lang=cz'
    );
  });

  it('adds jazyk=eng for the English confirmation', () => {
    expect(buildDocumentUrl('149707', byId('potvrzeni-en'))).toBe(
      'https://is.mendelu.cz/auth/student/tisk_dokumentu.pl?potvrzeni_tisk_el=1;jazyk=eng;studium=149707;lang=cz'
    );
  });

  it('builds the registration-sheet URL (no jazyk)', () => {
    expect(buildDocumentUrl('149707', byId('reg-arch'))).toBe(
      'https://is.mendelu.cz/auth/student/tisk_dokumentu.pl?reg_arch_tisk=1;studium=149707;lang=cz'
    );
  });

  it('offers an unsealed fallback for every sealed document', () => {
    expect(buildFallbackDocumentUrl('149707', byId('potvrzeni-cz'))).toBe(
      'https://is.mendelu.cz/auth/student/tisk_dokumentu.pl?potvrzeni_tisk=1;studium=149707;lang=cz'
    );
    expect(buildFallbackDocumentUrl('149707', byId('prehled-en'))).toBe(
      'https://is.mendelu.cz/auth/student/tisk_dokumentu.pl?prehled_tisk=1;jazyk=eng;studium=149707;lang=cz'
    );
  });

  it('has no fallback for the registration sheet — it was never sealed', () => {
    expect(buildFallbackDocumentUrl('149707', byId('reg-arch'))).toBeNull();
  });

  it('never points a fallback back at a sealed endpoint', () => {
    // A fallback that is itself sealed would retry the exact failure it exists
    // to work around.
    for (const doc of STUDY_DOCUMENTS) {
      expect(buildFallbackDocumentUrl('149707', doc) ?? '').not.toMatch(/_el=/);
    }
  });

  it('keeps the sealed trigger as the primary for every sealed document', () => {
    for (const doc of STUDY_DOCUMENTS) {
      if (doc.fallbackTrigger) expect(doc.trigger).toMatch(/_el=/);
    }
  });

  it('maps each document to an ASCII-safe filename', () => {
    expect(byId('potvrzeni-cz').filename).toBe('Potvrzeni_o_studiu.pdf');
    expect(byId('prehled-en').filename).toBe('Study_overview.pdf');
  });

  it('builds the Žádost form link with the active UI language', () => {
    expect(buildZadostUrl('149707', 'en')).toBe(
      'https://is.mendelu.cz/auth/student/zadost.pl?studium=149707;lang=en'
    );
  });
});
