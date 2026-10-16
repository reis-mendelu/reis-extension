// Expand/contract rules for supabase/migrations. A release applies every
// pending migration to prod (ship.yml) BEFORE the new builds reach students,
// and old builds stay installed for weeks, so a migration has to work for the
// build already out there: it may add, it may not take away. These rules flag
// the statements that take away. A flagged statement is not forbidden; the
// file has to say why it is safe for every released build, in a comment:
//
//   -- migration-lint: allow add-constraint, drop: widens the whitelist; no build sends other labels
//
// `transaction` can never be allowed: the CLI already runs each file in one
// transaction, and a COMMIT inside it makes a failed file half-applied.

/** @typedef {{ rule: string, statement: string, allowable: boolean }} Finding */

export const ALLOWABLE_RULES = [
  'drop',
  'rename',
  'alter-type',
  'not-null',
  'add-constraint',
  'alter-policy',
  'revoke',
  'data',
  'do-block',
];

/** Blank out comments, string literals and $tag$ bodies, keeping `;` that end statements. */
export function stripSql(sql) {
  let out = '';
  let i = 0;
  while (i < sql.length) {
    const rest = sql.slice(i);
    if (rest.startsWith('--')) {
      const end = sql.indexOf('\n', i);
      i = end === -1 ? sql.length : end;
      continue;
    }
    if (rest.startsWith('/*')) {
      const end = sql.indexOf('*/', i + 2);
      i = end === -1 ? sql.length : end + 2;
      out += ' ';
      continue;
    }
    const dollar = /^\$([A-Za-z_][A-Za-z0-9_]*)?\$/.exec(rest);
    if (dollar) {
      const end = sql.indexOf(dollar[0], i + dollar[0].length);
      i = end === -1 ? sql.length : end + dollar[0].length;
      out += " '' ";
      continue;
    }
    if (sql[i] === "'") {
      let j = i + 1;
      while (j < sql.length && !(sql[j] === "'" && sql[j + 1] !== "'")) j += sql[j] === "'" ? 2 : 1;
      i = j + 1;
      out += " '' ";
      continue;
    }
    out += sql[i];
    i += 1;
  }
  return out;
}

/** Rules a file allows, from its `-- migration-lint: allow a, b: reason` comments. */
export function allowedRules(sql) {
  const allowed = new Set();
  const re = /--\s*migration-lint:\s*allow\s+([a-z-]+(?:\s*,\s*[a-z-]+)*)\s*:\s*(.*)$/gim;
  for (const m of sql.matchAll(re)) {
    if ((m[2] ?? '').trim().length < 10) continue; // a reason is required
    for (const r of (m[1] ?? '').split(',')) allowed.add(r.trim());
  }
  return allowed;
}

const created = (s) =>
  [
    ...s.matchAll(
      /\bcreate\s+(?:or\s+replace\s+)?(?:function|table|view)\s+(?:if\s+not\s+exists\s+)?([\w."]+)/gi
    ),
  ].map((m) =>
    (m[1] ?? '')
      .replace(/"/g, '')
      .replace(/^public\./, '')
      .toLowerCase()
  );

/** @returns {string[]} every rule this one statement breaks */
export function statementRules(stmt, createdHere) {
  const s = stmt.replace(/\s+/g, ' ').trim().toLowerCase();
  const rules = [];
  if (/^(begin|start transaction|commit|end|rollback|savepoint|release)\b/.test(s))
    rules.push('transaction');
  // A table this same file creates has no released build reading it yet.
  const altered = /^alter table (?:only )?(?:if exists )?([\w."]+)/
    .exec(s)?.[1]
    ?.replace(/"/g, '')
    .replace(/^public\./, '');
  if (altered && createdHere.includes(altered)) return rules;
  if (/^drop\b/.test(s) || /^alter table\b.*\bdrop\b/.test(s)) rules.push('drop');
  if (/^alter\b.*\brename\b/.test(s)) rules.push('rename');
  if (/^alter table\b.*\balter column\b.*\btype\b/.test(s)) rules.push('alter-type');
  if (/^alter table\b.*\bset not null\b/.test(s)) rules.push('not-null');
  if (/^alter table\b.*\badd column\b.*\bnot null\b/.test(s) && !/\bdefault\b/.test(s))
    rules.push('not-null');
  if (/^alter table\b.*\badd (constraint|check|unique|primary key|foreign key)\b/.test(s))
    rules.push('add-constraint');
  if (/^alter policy\b/.test(s)) rules.push('alter-policy');
  if (/^revoke\b.*\bfrom\b.*\b(anon|authenticated)\b/.test(s)) {
    const target = /\bon\s+(?:function|table)?\s*([\w."]+)/
      .exec(s)?.[1]
      ?.replace(/"/g, '')
      .replace(/^public\./, '');
    if (!target || !createdHere.includes(target)) rules.push('revoke');
  }
  if (/^(delete from|truncate|update)\b/.test(s)) rules.push('data');
  // A DO block's body is hidden from these rules, so it has to say what it changes.
  if (/^do\b/.test(s)) rules.push('do-block');
  return rules;
}

/** @returns {Finding[]} the statements that are not allowed as written */
export function lintSql(sql) {
  const stripped = stripSql(sql);
  const allowed = allowedRules(sql);
  const createdHere = created(stripped);
  const findings = [];
  for (const raw of stripped.split(';')) {
    const statement = raw.replace(/\s+/g, ' ').trim();
    if (!statement) continue;
    for (const rule of statementRules(statement, createdHere)) {
      const allowable = rule !== 'transaction';
      if (allowable && allowed.has(rule)) continue;
      findings.push({ rule, statement: statement.slice(0, 160), allowable });
    }
  }
  return findings;
}

const NAME = /^(\d{14})_[a-z0-9_]+\.sql$/;

/**
 * File-level rules, from `git diff --name-status <base>` over supabase/migrations.
 * @param {{ status: string, path: string }[]} changes
 * @param {string[]} baseFiles file names in supabase/migrations on the base branch
 * @returns {string[]} problems
 */
export function checkFileChanges(changes, baseFiles) {
  const problems = [];
  const newest =
    baseFiles
      .map((f) => NAME.exec(f)?.[1] ?? '')
      .sort()
      .pop() ?? '';
  for (const { status, path } of changes) {
    const file = path.split('/').pop() ?? path;
    if (status !== 'A') {
      problems.push(
        `${path}: ${status === 'D' ? 'deleted' : 'changed'}. A merged migration may already be in prod; add a new file instead.`
      );
      continue;
    }
    const m = NAME.exec(file);
    if (!m) {
      problems.push(`${path}: name it <14-digit timestamp>_<snake_case>.sql.`);
      continue;
    }
    if ((m[1] ?? '') <= newest) {
      problems.push(
        `${path}: timestamp ${m[1]} is not newer than ${newest}, the newest migration on the base branch. Rename it.`
      );
    }
  }
  return problems;
}
