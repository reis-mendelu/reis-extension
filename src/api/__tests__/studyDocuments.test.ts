import { describe, it, expect } from 'vitest';
import { STUDY_DOCUMENTS, buildDocumentUrl, buildZadostUrl } from '../studyDocuments';

const byId = (id: string) => STUDY_DOCUMENTS.find(d => d.id === id)!;

describe('studyDocuments catalog', () => {
  it('lists the five one-click documents in order', () => {
    expect(STUDY_DOCUMENTS.map(d => d.id)).toEqual([
      'potvrzeni-cz', 'potvrzeni-en', 'prehled-cz', 'prehled-en', 'reg-arch',
    ]);
  });

  it('builds the Czech confirmation URL', () => {
    expect(buildDocumentUrl('149707', byId('potvrzeni-cz'))).toBe(
      'https://is.mendelu.cz/auth/student/tisk_dokumentu.pl?potvrzeni_tisk=1;studium=149707;lang=cz'
    );
  });

  it('adds jazyk=eng for the English confirmation', () => {
    expect(buildDocumentUrl('149707', byId('potvrzeni-en'))).toBe(
      'https://is.mendelu.cz/auth/student/tisk_dokumentu.pl?potvrzeni_tisk=1;jazyk=eng;studium=149707;lang=cz'
    );
  });

  it('uses NO _el trigger anywhere — sealed prints are not downloads', () => {
    // Measured against live IS on 2026-08-03: every `_el` trigger answers a GET
    // with HTML ("Request body constraint violation"), and the page states the
    // sealed document appears in Úložiště dokumentů within an hour. Every plain
    // trigger returns application/pdf. Re-adding `_el` here silently breaks
    // BOTH platforms — on the extension a non-PDF 200 is read as an expired
    // session and force-navigates the student to the login page.
    for (const doc of STUDY_DOCUMENTS) {
      expect(doc.trigger).not.toMatch(/_el=/);
    }
  });

  it('builds the registration-sheet URL (no jazyk)', () => {
    expect(buildDocumentUrl('149707', byId('reg-arch'))).toBe(
      'https://is.mendelu.cz/auth/student/tisk_dokumentu.pl?reg_arch_tisk=1;studium=149707;lang=cz'
    );
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
