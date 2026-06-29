import { describe, it, expect } from 'vitest';
import { parseSubjectResults } from '../subjectParser';

const link = (predmet: string, text: string, tail = '') =>
  `<span style="background-color: #79be15"></span><a href="../katalog/syllabus.pl?predmet=${predmet};lang=cz">${text}</a>${tail}`;

describe('parseSubjectResults', () => {
  it('extracts code, name, id, semester and faculty from a result row', () => {
    const html = `<html><body>${link('12345', 'EBC-WGD Webová grafika a design', ' LS 2025/2026 - PEF')}</body></html>`;
    const [s] = parseSubjectResults(html);
    expect(s.id).toBe('12345');
    expect(s.code).toBe('EBC-WGD');
    expect(s.name).toBe('Webová grafika a design');
    expect(s.semester).toBe('LS 2025/2026');
    expect(s.faculty).toBe('PEF');
    expect(s.link).toContain('https://is.mendelu.cz/auth/katalog/syllabus.pl?predmet=12345');
  });

  it('deduplicates repeated predmet ids', () => {
    const html = `<html><body>
      ${link('999', 'EBC-MAN Management', ' LS 2025/2026 - PEF')}
      ${link('999', 'EBC-MAN Management', ' ZS 2025/2026 - PEF')}
    </body></html>`;
    const out = parseSubjectResults(html);
    expect(out).toHaveLength(1);
  });

  it('skips links whose text does not start with a subject code', () => {
    const html = `<html><body>
      <a href="../katalog/syllabus.pl?predmet=1">Just a plain title with no code</a>
      ${link('2', 'MZD Mezinárodní zdanění', ' LS 2025/2026 - PEF')}
    </body></html>`;
    const out = parseSubjectResults(html);
    expect(out.map(s => s.code)).toEqual(['MZD']);
  });

  it('handles short hyphenated codes and missing semester/faculty gracefully', () => {
    const html = `<html><body>${link('7', 'ENC-A Auditing')}</body></html>`;
    const [s] = parseSubjectResults(html);
    expect(s.code).toBe('ENC-A');
    expect(s.name).toBe('Auditing');
    expect(s.semester).toBe('');
    expect(s.faculty).toBe('N/A');
  });

  it('returns an empty array when there are no subject links', () => {
    expect(parseSubjectResults('<html><body><p>nothing here</p></body></html>')).toEqual([]);
  });
});
