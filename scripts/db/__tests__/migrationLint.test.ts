import { readFileSync } from 'node:fs';
import { describe, it, expect } from 'vitest';
import { lintSql, checkFileChanges, stripSql, allowedRules } from '../migrationLint.mjs';

const rules = (sql: string) => lintSql(sql).map((f: { rule: string }) => f.rule);
const archive = (f: string) => readFileSync(`supabase/migrations_archive/${f}`, 'utf8');

describe('lintSql', () => {
  it('lets additive migrations through', () => {
    expect(rules(archive('20260922120000_engagement_signals.sql'))).toEqual([]);
    expect(
      rules(`create table public.t (id int not null);
             alter table public.t add constraint t_id_check check (id > 0);
             alter table public.t enable row level security;
             create index t_id on public.t (id);
             insert into public.t values (1);
             create or replace function public.f() returns void language sql as $$ delete from public.t; drop table x; $$;
             revoke execute on function public.f() from anon, authenticated;
             alter table public.spolky_events add column note text;
             grant update (status) on table public.suggestions to authenticated;`)
    ).toEqual([]);
  });

  it('flags what takes something away from a released build', () => {
    expect(rules('drop table public.course_tips;')).toEqual(['drop']);
    expect(rules('alter table public.societies drop column instagram;')).toEqual(['drop']);
    expect(rules('alter table public.societies rename column name to title;')).toEqual(['rename']);
    expect(rules('alter function public.f() rename to g;')).toEqual(['rename']);
    expect(rules('alter table public.t alter column id type bigint;')).toEqual(['alter-type']);
    expect(rules('alter table public.t alter column id set not null;')).toEqual(['not-null']);
    expect(rules('alter table public.t add column x int not null;')).toEqual(['not-null']);
    expect(rules('alter table public.t add column x int not null default 0;')).toEqual([]);
    expect(rules('alter table public.t add constraint c check (x > 0);')).toEqual([
      'add-constraint',
    ]);
    expect(rules('alter policy p on public.t using (false);')).toEqual(['alter-policy']);
    expect(rules('revoke execute on function public.usage_stats(integer) from anon;')).toEqual([
      'revoke',
    ]);
    expect(rules('delete from public.suggestions;')).toEqual(['data']);
    expect(rules('update public.societies set name = $$x$$;')).toEqual(['data']);
    expect(rules('truncate public.feature_usage;')).toEqual(['data']);
    expect(rules('do $$ begin update public.societies set id = 1; end $$;')).toEqual(['do-block']);
  });

  it('flags a COMMIT inside the file and never lets it be allowed', () => {
    const sql =
      '-- migration-lint: allow transaction: I know what I am doing\nbegin;\ncreate table t (id int);\ncommit;';
    expect(lintSql(sql)).toEqual([
      expect.objectContaining({ rule: 'transaction', allowable: false }),
      expect.objectContaining({ rule: 'transaction', allowable: false }),
    ]);
  });

  it("flags #556's file as written: transaction control, and a constraint swap that needs a reason", () => {
    const sql = `-- whitelist
begin;
alter table public.feature_usage drop constraint feature_usage_feature_check;
alter table public.feature_usage add constraint feature_usage_feature_check
  check (feature in ('map_dwell_3s','support_prompt_yes'));
commit;`;
    expect(rules(sql)).toEqual(['transaction', 'drop', 'add-constraint', 'transaction']);
    const fixed = `-- migration-lint: allow drop, add-constraint: widens the whitelist, every old label stays valid
${sql.replace('begin;', '').replace('commit;', '')}`;
    expect(rules(fixed)).toEqual([]);
  });

  it('needs a real reason to allow a rule', () => {
    expect(allowedRules('-- migration-lint: allow drop: ok')).toEqual(new Set());
    expect(
      allowedRules('-- migration-lint: allow drop, rename: the column was never read by any build')
    ).toEqual(new Set(['drop', 'rename']));
  });

  it('ignores comments, strings and function bodies', () => {
    expect(
      stripSql("select 'drop table x'; -- drop table y\n/* drop */ select $f$ drop $f$;")
    ).not.toMatch(/drop/);
    expect(rules("insert into public.t (s) values ('it''s; drop table x');")).toEqual([]);
  });
});

describe('checkFileChanges', () => {
  const base = ['20261016000000_baseline.sql'];

  it('accepts a new file newer than the newest on the base', () => {
    expect(
      checkFileChanges([{ status: 'A', path: 'supabase/migrations/20261017120000_x.sql' }], base)
    ).toEqual([]);
  });

  it('refuses editing, deleting or renaming a merged migration', () => {
    for (const status of ['M', 'D', 'R']) {
      expect(
        checkFileChanges(
          [{ status, path: 'supabase/migrations/20261016000000_baseline.sql' }],
          base
        )
      ).toHaveLength(1);
    }
  });

  it('refuses a file that sorts before the newest merged one, or is misnamed', () => {
    expect(
      checkFileChanges(
        [{ status: 'A', path: 'supabase/migrations/20261015000000_old.sql' }],
        base
      )[0]
    ).toMatch(/not newer/);
    expect(
      checkFileChanges([{ status: 'A', path: 'supabase/migrations/fix.sql' }], base)[0]
    ).toMatch(/name it/);
  });
});
