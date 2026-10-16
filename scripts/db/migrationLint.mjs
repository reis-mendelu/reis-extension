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

/** `"Public".T` and `t` both become `public.t`. */
const qualify = (name) => {
  const n = (name ?? '').replace(/"/g, '').toLowerCase();
  return n.includes('.') ? n : `public.${n}`;
};

/** Tables and functions a migration defines, by kind, whatever the CREATE's form. */
export function definedIn(stripped) {
  const names = (re) => new Set([...stripped.matchAll(re)].map((m) => qualify(m[1])));
  return {
    tables: names(/\bcreate\s+table\s+(?:if\s+not\s+exists\s+)?([\w."]+)/gi),
    functions: names(/\bcreate\s+(?:or\s+replace\s+)?function\s+([\w."]+)/gi),
  };
}

const NONE = { tables: new Set(), functions: new Set() };

/**
 * Objects this file brings into existence: defined here and in no other
 * migration. `create table if not exists` or `create or replace function` on
 * something prod already has is not new, and a released build already uses it.
 */
export function createdHere(stripped, existing = NONE) {
  const mine = definedIn(stripped);
  const fresh = (set, old) => new Set([...set].filter((n) => !old.has(n)));
  return {
    tables: fresh(mine.tables, existing.tables),
    functions: fresh(mine.functions, existing.functions),
  };
}

/** @returns {string[]} every rule this one statement breaks */
export function statementRules(stmt, created) {
  const s = stmt.replace(/\s+/g, ' ').trim().toLowerCase();
  const rules = [];
  if (/^(begin|start transaction|commit|end|rollback|savepoint|release)\b/.test(s))
    rules.push('transaction');
  // A table this same file creates has no released build reading it yet.
  const altered = /^alter table (?:only )?(?:if exists )?([\w."]+)/.exec(s)?.[1];
  if (altered && created.tables.has(qualify(altered))) return rules;
  if (/^drop\b/.test(s) || /^alter table\b.*\bdrop\b/.test(s)) rules.push('drop');
  if (/^alter\b.*\brename\b/.test(s)) rules.push('rename');
  // COLUMN is optional in both: `alter t alter c type x`, `alter t add c int not null`.
  if (/^alter table\b.*\balter (column )?\S+ (set data )?type\b/.test(s)) rules.push('alter-type');
  if (/^alter table\b.*\bset not null\b/.test(s)) rules.push('not-null');
  const addsColumn =
    /^alter table\b.*\badd (?!constraint\b|check\b|unique\b|primary key\b|foreign key\b|exclude\b)/;
  if (addsColumn.test(s) && /\bnot null\b/.test(s) && !/\bdefault\b/.test(s))
    rules.push('not-null');
  if (/^alter table\b.*\badd (constraint|check|unique|primary key|foreign key)\b/.test(s))
    rules.push('add-constraint');
  if (/^alter policy\b/.test(s)) rules.push('alter-policy');
  if (/^revoke\b.*\bfrom\b.*\b(anon|authenticated)\b/.test(s)) {
    const on = /\bon (function |table )?([\w."]+)/.exec(s);
    const kind = on?.[1] === 'function ' ? created.functions : created.tables;
    if (!on || !kind.has(qualify(on[2]))) rules.push('revoke');
  }
  if (/^(delete from|truncate|update|merge)\b/.test(s)) rules.push('data');
  // `with x as (...) delete ...`: a CTE can change rows too.
  if (/^with\b/.test(s) && /\b(delete from|update|merge into|insert into)\b/.test(s))
    rules.push('data');
  // A DO block's body is hidden from these rules, so it has to say what it changes.
  if (/^do\b/.test(s)) rules.push('do-block');
  return rules;
}

/**
 * @param {string} sql the migration
 * @param {{ tables: Set<string>, functions: Set<string> }} [existing] what the
 *   OTHER migrations define (definedIn over each), so "new" objects really are
 * @returns {Finding[]} the statements that are not allowed as written
 */
export function lintSql(sql, existing = NONE) {
  const stripped = stripSql(sql);
  const allowed = allowedRules(sql);
  const created = createdHere(stripped, existing);
  const findings = [];
  for (const raw of stripped.split(';')) {
    const statement = raw.replace(/\s+/g, ' ').trim();
    if (!statement) continue;
    for (const rule of statementRules(statement, created)) {
      const allowable = rule !== 'transaction';
      if (allowable && allowed.has(rule)) continue;
      findings.push({ rule, statement: statement.slice(0, 160), allowable });
    }
  }
  return findings;
}
