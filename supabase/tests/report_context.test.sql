begin;

-- v3 stores the platform and OS the report was sent from
do $$
declare v_r text; v_p text; v_o text;
begin
  set local role anon;
  v_r := public.submit_suggestion_v3('bug', 'ctx', 'body', 'exams', null, '5.4.1', 'Safari', '17',
                                     '390x844', null, null, 'ios', 'iOS 18');
  reset role;
  if v_r is distinct from 'ok' then raise exception 'v3 answered %', v_r; end if;
  select platform, os_version into v_p, v_o from public.suggestions where title = 'ctx';
  if v_p is distinct from 'ios' or v_o is distinct from 'iOS 18' then
    raise exception 'context not stored: % / %', v_p, v_o;
  end if;
end $$;

-- a build that still calls v2 keeps working, with empty labels
do $$
declare v_r text; v_p text;
begin
  set local role anon;
  v_r := public.submit_suggestion_v2('bug', 'old-build', 'body', 'exams');
  reset role;
  if v_r is distinct from 'ok' then raise exception 'v2 answered %', v_r; end if;
  select platform into v_p from public.suggestions where title = 'old-build';
  if v_p is distinct from '' then raise exception 'v2 platform not empty: %', v_p; end if;
end $$;

-- attachments are kept: not by age, not when the report is marked done
do $$
declare v_id bigint; v_n int;
begin
  select id into v_id from public.suggestions where title = 'ctx';
  insert into public.suggestion_attachments (suggestion_id, diagnostics, created_at)
    values (v_id, '{"entries":[]}'::jsonb, now() - interval '400 days');
  update public.suggestions set status = 'done' where id = v_id;
  set local role anon;
  perform public.submit_suggestion_v2('bug', 'later', 'body', 'exams');
  reset role;
  select count(*) into v_n from public.suggestion_attachments where suggestion_id = v_id;
  if v_n <> 1 then raise exception 'attachment was deleted'; end if;
  if exists (select 1 from pg_proc where proname in ('prune_suggestion_attachments', 'drop_attachments_when_done'))
     or exists (select 1 from pg_trigger where tgname = 'suggestions_drop_attachments_when_done') then
    raise exception 'retention machinery is still installed';
  end if;
end $$;

rollback;
