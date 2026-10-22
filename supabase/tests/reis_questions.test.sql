begin;

-- fixtures, as the table owner
insert into public.reis_questions (id, prompt_cz, prompt_en, buttons, starts_at, ends_at) values
  ('00000000-0000-0000-0000-0000000000a1', 'Chceš X?', 'Want X?',
   '[{"key":"yes","cz":"Ano","en":"Yes"},{"key":"no","cz":"Ne","en":"No"}]',
   now() - interval '1 day', now() + interval '7 days'),
  ('00000000-0000-0000-0000-0000000000a2', 'Skončila', 'Ended',
   '[{"key":"yes","cz":"Ano","en":"Yes"}]',
   now() - interval '9 days', now() - interval '1 day'),
  ('00000000-0000-0000-0000-0000000000a3', 'Budoucí', 'Future',
   '[{"key":"open","cz":"Otevřít","en":"Open","url":"https://example.com/x"}]',
   now() + interval '1 day', now() + interval '9 days');

-- anon reads only the live question
do $$
declare v_n int;
begin
  set local role anon;
  select count(*) into v_n from public.reis_questions;
  reset role;
  if v_n is distinct from 1 then raise exception 'anon sees % questions, want 1', v_n; end if;
end $$;

-- anon counts 'seen' and a real key on the live question, per day
do $$
declare v_seen int; v_yes int;
begin
  set local role anon;
  perform public.count_question('00000000-0000-0000-0000-0000000000a1', 'seen');
  perform public.count_question('00000000-0000-0000-0000-0000000000a1', 'seen');
  perform public.count_question('00000000-0000-0000-0000-0000000000a1', 'yes');
  reset role;
  select n into v_seen from public.reis_question_counts
   where question_id = '00000000-0000-0000-0000-0000000000a1' and key = 'seen';
  select n into v_yes from public.reis_question_counts
   where question_id = '00000000-0000-0000-0000-0000000000a1' and key = 'yes';
  if v_seen is distinct from 2 then raise exception 'seen: %', v_seen; end if;
  if v_yes is distinct from 1 then raise exception 'yes: %', v_yes; end if;
end $$;

-- an unknown key, an ended, a future and a missing question are dropped silently
do $$
declare v_n int;
begin
  set local role anon;
  perform public.count_question('00000000-0000-0000-0000-0000000000a1', 'maybe');
  perform public.count_question('00000000-0000-0000-0000-0000000000a2', 'yes');
  perform public.count_question('00000000-0000-0000-0000-0000000000a3', 'open');
  perform public.count_question('00000000-0000-0000-0000-0000000000ff', 'seen');
  reset role;
  select count(*) into v_n from public.reis_question_counts;
  if v_n is distinct from 2 then raise exception 'stray counts: % rows', v_n; end if;
end $$;

-- anon can neither read nor write the counts, nor write questions
do $$
begin
  set local role anon;
  perform 1 from public.reis_question_counts;
  raise exception 'anon read reis_question_counts';
exception when insufficient_privilege then reset role;
end $$;

do $$
begin
  set local role anon;
  insert into public.reis_questions (prompt_cz, prompt_en, buttons, ends_at)
  values ('x', 'x', '[{"key":"yes","cz":"Ano","en":"Yes"}]', now() + interval '1 day');
  raise exception 'anon inserted a question';
exception when insufficient_privilege then reset role;
end $$;

-- the results are reis_admin only: anon has no EXECUTE, a non-admin is refused
do $$
begin
  if has_function_privilege('anon', 'public.question_results()', 'EXECUTE') then
    raise exception 'anon may execute question_results';
  end if;
  if not has_function_privilege('anon', 'public.count_question(uuid, text)', 'EXECUTE') then
    raise exception 'anon may not execute count_question';
  end if;
end $$;

do $$
begin
  set local role authenticated;
  perform public.question_results();
  raise exception 'a non-admin read question_results';
exception when raise_exception then
  reset role;
  if sqlerrm <> 'forbidden' then raise; end if;
end $$;

-- a reis_admin writes a question, ends it, and reads the results; a society cannot write
insert into public.societies (id, name, short_name, color, faculty_key) values
  ('reis', 'reIS', 'reIS', '#000000', 'mendelu'), ('esn', 'ESN', 'ESN', '#000000', 'mendelu')
on conflict (id) do nothing;
insert into auth.users (id, email) values
  ('00000000-0000-0000-0000-00000000ad01', 'admin@test'),
  ('00000000-0000-0000-0000-00000000e501', 'esn@test');
insert into public.spolky_accounts (email, association_id, association_name, role, user_id) values
  ('admin@test', 'reis', 'reIS', 'reis_admin', '00000000-0000-0000-0000-00000000ad01'),
  ('esn@test', 'esn', 'ESN', 'association', '00000000-0000-0000-0000-00000000e501');

do $$
declare v_results json; v_id uuid;
begin
  perform set_config('request.jwt.claims',
    '{"sub":"00000000-0000-0000-0000-00000000ad01","role":"authenticated"}', true);
  set local role authenticated;
  insert into public.reis_questions (prompt_cz, prompt_en, buttons, ends_at)
  values ('Admin?', 'Admin?', '[{"key":"yes","cz":"Ano","en":"Yes"}]', now() + interval '1 day')
  returning id into v_id;
  update public.reis_questions set ends_at = now() where id = v_id;
  v_results := public.question_results();
  reset role;
  if json_array_length(v_results) <> 4 then
    raise exception 'admin sees % questions, want 4', json_array_length(v_results);
  end if;
  if (select (r->'totals'->>'seen')::int from json_array_elements(v_results) r
       where r->>'id' = '00000000-0000-0000-0000-0000000000a1') is distinct from 2 then
    raise exception 'results lost the seen total: %', v_results;
  end if;
end $$;

do $$
begin
  perform set_config('request.jwt.claims',
    '{"sub":"00000000-0000-0000-0000-00000000e501","role":"authenticated"}', true);
  set local role authenticated;
  insert into public.reis_questions (prompt_cz, prompt_en, buttons, ends_at)
  values ('Spolek?', 'Society?', '[{"key":"yes","cz":"Ano","en":"Yes"}]', now() + interval '1 day');
  raise exception 'a society inserted a question';
exception when insufficient_privilege then reset role;
end $$;

-- bad button lists are refused by the CHECK
do $$
declare bad jsonb;
begin
  foreach bad in array array[
    '[]'::jsonb,
    '[{"key":"seen","cz":"A","en":"A"}]',
    '[{"key":"a","cz":"A","en":"A"},{"key":"a","cz":"B","en":"B"}]',
    '[{"key":"Bad Key","cz":"A","en":"A"}]',
    '[{"key":"a","cz":"","en":"A"}]',
    '[{"key":"a","cz":"A","en":"A","url":"http://insecure.example"}]',
    '[{"key":"1","cz":1,"en":1}]',
    '[{"key":"a","cz":"A","en":"A","url":42}]',
    '[{"key":"1","cz":"1","en":"1","hintCz":"tohle je moc dlouhý popisek konce"}]',
    '[{"key":"a","cz":"1","en":"1"},{"key":"b","cz":"2","en":"2"},{"key":"c","cz":"3","en":"3"},{"key":"d","cz":"4","en":"4"},{"key":"e","cz":"5","en":"5"},{"key":"f","cz":"6","en":"6"}]'
  ] loop
    begin
      insert into public.reis_questions (prompt_cz, prompt_en, buttons, ends_at)
      values ('x', 'x', bad, now() + interval '1 day');
      raise exception 'accepted buttons %', bad;
    exception when check_violation then null;
    end;
  end loop;
end $$;

-- a 1–5 scale is a valid list
insert into public.reis_questions (prompt_cz, prompt_en, buttons, ends_at) values ('x', 'x',
  '[{"key":"1","cz":"1","en":"1","hintCz":"nejhorší","hintEn":"worst"},{"key":"2","cz":"2","en":"2"},{"key":"3","cz":"3","en":"3"},{"key":"4","cz":"4","en":"4"},{"key":"5","cz":"5","en":"5","hintCz":"nejlepší","hintEn":"best"}]',
  now() + interval '1 day');

rollback;
