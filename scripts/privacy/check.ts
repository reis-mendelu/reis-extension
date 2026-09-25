import { readFileSync, readdirSync } from 'node:fs';
import { join, relative } from 'node:path';
import type { Flow, Exempt } from '../../privacy/disclosures';
import { renderPolicyTable, readGenerated } from './policyTable';

// privacy:check — the six rules that keep privacy/disclosures.ts true.
// Pure over a RepoSnapshot so every rule is unit-tested; readRepoSnapshot is
// the only part that touches the disk.

export interface Model {
  flows: Flow[];
  exempt: Exempt[];
  permissions: { ios: string[]; android: string[] };
}

export interface RepoSnapshot {
  /** Non-test .ts/.tsx under src/, by repo-relative path. */
  srcFiles: Record<string, string>;
  /** SUPABASE_CALLERS in src/test/guards/noStudentDataLeaves.test.ts. */
  supabaseCallers: string[];
  firefoxOptional: string[];
  iosUsageKeys: string[];
  androidPermissions: string[];
  policyMd: string;
  playCsv: string;
}

const CALL = /\b(?:supabase|adminAuthClient)\s*\.\s*(?:rpc|from)\(\s*'([a-z0-9_]+)'/g;
const isTest = (p: string) => /(__tests__|\/test\/|\.test\.|\.spec\.)/.test(p);

function setDiff(label: string, actual: string[], declared: string[], fix: string): string[] {
  const a = new Set(actual);
  const d = new Set(declared);
  return [
    ...[...a]
      .filter((x) => !d.has(x))
      .map((x) => `${label}: "${x}" is present but not declared. ${fix}`),
    ...[...d]
      .filter((x) => !a.has(x))
      .map((x) => `${label}: "${x}" is declared but not present. ${fix}`),
  ];
}

/** Response ids of every TRUE `PSL_DATA_TYPES_*` answer in a Play Data safety CSV. */
export function playDataTypes(csv: string): string[] {
  return csv
    .split('\n')
    .map((l) => l.split(','))
    .filter(
      (c) =>
        (c[0] ?? '').startsWith('PSL_DATA_TYPES_') && (c[2] ?? '').trim().toLowerCase() === 'true'
    )
    .map((c) => c[1] ?? '');
}

export function checkDisclosures(s: RepoSnapshot, m: Model): string[] {
  const out: string[] = [];
  const SRC = 'privacy/disclosures.ts';

  // 1. Every Supabase call is described, and every described call exists.
  const found = new Map<string, string[]>();
  for (const [path, text] of Object.entries(s.srcFiles)) {
    if (isTest(path)) continue;
    for (const match of text.matchAll(CALL)) {
      const name = match[1] ?? '';
      found.set(name, [...(found.get(name) ?? []), path]);
    }
  }
  const described = new Set([...m.flows.flatMap((f) => f.calls), ...m.exempt.map((e) => e.call)]);
  for (const [name, files] of found) {
    if (!described.has(name)) {
      out.push(
        `Supabase call "${name}" (${files.join(', ')}) is on no flow and not exempt. Describe it in ${SRC}.`
      );
    }
  }
  for (const name of described) {
    if (!found.has(name))
      out.push(`"${name}" is listed in ${SRC} but no longer called anywhere in src/.`);
  }

  // 2. The privacy guard's allowlist and the flows agree.
  const flowFiles = new Set(m.flows.flatMap((f) => f.files));
  const owned = new Set([...flowFiles, ...m.exempt.flatMap((e) => e.files)]);
  for (const f of s.supabaseCallers) {
    if (!owned.has(f))
      out.push(`SUPABASE_CALLERS allows ${f}, but no flow or exemption in ${SRC} owns it.`);
  }
  for (const f of flowFiles) {
    if (!s.supabaseCallers.includes(f)) {
      out.push(`SUPABASE_CALLERS does not allow ${f}, which a flow in ${SRC} sends from.`);
    }
  }

  // 3–4. Manifest and platform permissions match what is declared.
  out.push(
    ...setDiff(
      'Firefox data_collection_permissions.optional (wxt.config.ts)',
      s.firefoxOptional,
      m.flows.flatMap((f) => f.stores.firefox),
      `Keep it equal to the flows' stores.firefox.`
    ),
    ...setDiff(
      'iOS Info.plist usage key',
      s.iosUsageKeys,
      m.permissions.ios,
      `Update PLATFORM_PERMISSIONS.ios.`
    ),
    ...setDiff(
      'Android uses-permission',
      s.androidPermissions,
      m.permissions.android,
      `Update PLATFORM_PERMISSIONS.android.`
    )
  );

  // 5. The published table is generated from the flows.
  const current = readGenerated(s.policyMd);
  if (current === null) {
    out.push('docs/privacy-policy-app.md is missing the generated:flows markers.');
  } else if (current !== renderPolicyTable(m.flows)) {
    out.push(
      'docs/privacy-policy-app.md "What we do send" is stale. Run `npm run privacy:generate`.'
    );
  }

  // 6. Play's CSV declares exactly the flows' Play types.
  out.push(
    ...setDiff(
      'Play Data safety type (privacy/play-data-safety.csv)',
      playDataTypes(s.playCsv),
      m.flows.flatMap((f) => f.stores.play),
      `Keep the CSV and the flows' stores.play equal.`
    )
  );

  return out;
}

function walk(dir: string, root: string, out: Record<string, string>): void {
  // Entries carry their type, so there is no separate stat to race against.
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const full = join(dir, entry.name);
    if (entry.isDirectory()) {
      if (entry.name !== 'node_modules') walk(full, root, out);
    } else if (entry.isFile() && /\.tsx?$/.test(entry.name)) {
      out[relative(root, full)] = readFileSync(full, 'utf-8');
    }
  }
}

export function readRepoSnapshot(root: string): RepoSnapshot {
  const read = (p: string) => readFileSync(join(root, p), 'utf-8');
  const srcFiles: Record<string, string> = {};
  walk(join(root, 'src'), root, srcFiles);
  const guard = read('src/test/guards/noStudentDataLeaves.test.ts');
  const callersBlock = guard.slice(
    guard.indexOf('const SUPABASE_CALLERS'),
    guard.indexOf(']);', guard.indexOf('const SUPABASE_CALLERS'))
  );
  const supabaseCallers = [...callersBlock.matchAll(/^\s*'(src\/[^']+)'/gm)].map((x) => x[1] ?? '');
  const wxt = read('wxt.config.ts');
  const optionalBlock = wxt.slice(
    wxt.indexOf('optional:', wxt.indexOf('data_collection_permissions'))
  );
  const firefoxOptional = [
    ...optionalBlock.slice(0, optionalBlock.indexOf(']')).matchAll(/'([A-Za-z]+)'/g),
  ].map((x) => x[1] ?? '');
  return {
    srcFiles,
    supabaseCallers,
    firefoxOptional,
    iosUsageKeys: [
      ...read('ios/App/App/Info.plist').matchAll(/<key>(NS\w+UsageDescription)<\/key>/g),
    ].map((x) => x[1] ?? ''),
    androidPermissions: [
      ...read('android/app/src/main/AndroidManifest.xml').matchAll(/android\.permission\.(\w+)/g),
    ].map((x) => x[1] ?? ''),
    policyMd: read('docs/privacy-policy-app.md'),
    playCsv: read('privacy/play-data-safety.csv'),
  };
}
