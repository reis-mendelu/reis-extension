#!/usr/bin/env node
/**
 * Fetches all Erasmus country JSONs from CDN and precomputes rich stats
 * for the EuropeMap tooltip. Run: node scripts/computeErasmusStats.mjs
 */

const CDN = 'https://cdn.jsdelivr.net/gh/reis-mendelu/reis-data@main/erasmus';

const COUNTRIES = [
  { id: '040', file: 'country-040-study.json' },
  { id: '056', file: 'country-056-study.json' },
  { id: '100', file: 'country-100-study.json' },
  { id: '191', file: 'country-191-study.json' },
  { id: '196', file: 'country-196-study.json' },
  { id: '208', file: 'country-208-study.json' },
  { id: '233', file: 'country-233-study.json' },
  { id: '246', file: 'country-246-study.json' },
  { id: '250', file: 'country-250-study.json' },
  { id: '276', file: 'country-276-study.json' },
  { id: '300', file: 'country-300-study.json' },
  { id: '348', file: 'country-348-study.json' },
  { id: '372', file: 'country-372-study.json' },
  { id: '380', file: 'country-380-study.json' },
  { id: '428', file: 'country-428-study.json' },
  { id: '440', file: 'country-440-study.json' },
  { id: '528', file: 'country-528-study.json' },
  { id: '578', file: 'country-578-study.json' },
  { id: '616', file: 'country-616-study.json' },
  { id: '620', file: 'country-620-study.json' },
  { id: '642', file: 'country-642-study.json' },
  { id: '688', file: 'country-688-study.json' },
  { id: '703', file: 'country-703-study.json' },
  { id: '705', file: 'slovenia-study.json' },
  { id: '724', file: 'country-724-study.json' },
  { id: '752', file: 'country-752-study.json' },
  { id: '792', file: 'country-792-study.json' },
  { id: '826', file: 'country-826-study.json' },
];

function median(arr) {
  if (!arr.length) return 0;
  const s = [...arr].sort((a, b) => a - b);
  const mid = Math.floor(s.length / 2);
  return s.length % 2 ? s[mid] : (s[mid - 1] + s[mid]) / 2;
}

async function main() {
  const results = {};

  for (const c of COUNTRIES) {
    try {
      const res = await fetch(`${CDN}/${c.file}`);
      const data = await res.json();
      const reports = data.reports || [];

      const schools = new Set(reports.map(r => r.host.name));
      const costs = reports
        .map(r => {
          const cost = parseFloat(String(r.finance.totalCostCZK).replace(/\s/g, ''));
          const dur = parseFloat(r.stay.durationMonths);
          return cost > 0 && dur > 0 ? Math.round(cost / dur) : null;
        })
        .filter(Boolean);

      const durations = reports
        .map(r => parseFloat(r.stay.durationMonths))
        .filter(d => d > 0);

      const ratings = reports
        .map(r => parseFloat(r.overall.rating))
        .filter(r => r > 0 && r <= 5);

      // Find top school by frequency
      const schoolCounts = {};
      for (const r of reports) {
        schoolCounts[r.host.name] = (schoolCounts[r.host.name] || 0) + 1;
      }
      const topSchool = Object.entries(schoolCounts)
        .sort((a, b) => b[1] - a[1])[0]?.[0] || '';

      results[c.id] = {
        count: reports.length,
        avgRating: ratings.length ? +(ratings.reduce((a, b) => a + b, 0) / ratings.length).toFixed(1) : 0,
        schools: schools.size,
        medianCostPerMonth: median(costs),
        avgDuration: durations.length ? +(durations.reduce((a, b) => a + b, 0) / durations.length).toFixed(1) : 0,
        topSchool: topSchool.length > 45 ? topSchool.slice(0, 42) + '...' : topSchool,
      };

      console.error(`✓ ${c.id} — ${reports.length} reports, ${schools.size} schools`);
    } catch (err) {
      console.error(`✗ ${c.id} — ${err.message}`);
    }
  }

  console.log(`/** Pre-computed stats per Erasmus country (generated ${new Date().toISOString().split('T')[0]}). */
export const ERASMUS_COUNTRY_STATS: Record<string, {
  count: number;
  avgRating: number;
  schools: number;
  medianCostPerMonth: number;
  avgDuration: number;
  topSchool: string;
}> = ${JSON.stringify(results, null, 2)};`);
}

main();
