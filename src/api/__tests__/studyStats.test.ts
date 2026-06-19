import { describe, it, expect } from 'vitest';
import { parseStudyStats } from '../studyStats';

// Real IS Mendelu labels put a non-breaking space after the single-letter
// preposition "z" — "Průměr z odstudovaných...". Credit-count
// labels have no such preposition, so they use plain spaces.
const NBSP = ' ';
const html = `
<html><body>
  <table id="period">
    <tr><td>Počet zapsaných kreditů za dané studijní období</td><td>47</td></tr>
    <tr><td>Počet získaných kreditů za dané studijní období</td><td>47</td></tr>
    <tr><td>Počet odstudovaných předmětů za dané studijní období</td><td>11</td></tr>
    <tr><td>Průměr z${NBSP}odstudovaných předmětů za dané studijní období</td><td>1,22</td></tr>
  </table>
  <table id="total">
    <tr><td>Počet získaných kreditů za celé studium</td><td>147</td></tr>
    <tr><td>Počet získaných kreditů za poslední dvě období</td><td>88</td></tr>
    <tr><td>Průměr z${NBSP}odstudovaných předmětů za celé studium</td><td>1,52</td></tr>
    <tr><td>Vážený průměr z${NBSP}odstudovaných předmětů za celé studium (včetně neúspěšně ukončených předmětů)</td><td>1,53</td></tr>
  </table>
</body></html>`;

describe('parseStudyStats', () => {
  it('extracts averages despite non-breaking spaces in IS labels', () => {
    const doc = new DOMParser().parseFromString(html, 'text/html');
    const stats = parseStudyStats(doc);
    expect(stats).not.toBeNull();
    expect(stats!.currentSemester.gpa).toBeCloseTo(1.22);
    expect(stats!.gpaTotal).toBeCloseTo(1.52);
    expect(stats!.weightedGpaTotal).toBeCloseTo(1.53);
  });

  it('still parses credit counts (which use plain spaces)', () => {
    const doc = new DOMParser().parseFromString(html, 'text/html');
    const stats = parseStudyStats(doc);
    expect(stats!.totalEarnedCredits).toBe(147);
    expect(stats!.creditsLastTwoPeriods).toBe(88);
  });
});
