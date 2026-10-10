-- One emoji per production event, and a better legacy category where one
-- exists (builds 5.1.1–5.3.0 still draw the category). Apply only after
-- 20261010120000_event_emoji.sql, and only with Dominik's yes:
--   npx supabase db query --linked -f supabase/backfills/20261010_event_emoji.sql
begin;
update public.spolky_events as e set emoji = v.emoji, category = v.category
from (values
  ('au_frrms', 'Kvíz v S-klubu', '1f9e0', 'quiz'),
  ('au_frrms', 'Filipínský den + fotbálek v Sklubu', '1f1f5-1f1ed', 'culture'),
  ('au_frrms', 'Půlení semestru na fakultě', '1f389', 'party'),
  ('au_frrms', 'Prezentace Costarica + fotbálek', '1f1e8-1f1f7', 'culture'),
  ('au_frrms', 'Deskovky v Sklubu', '1f3b2', 'boardgames'),
  ('au_frrms', 'AU Kvíz', '1f9e0', 'quiz'),
  ('esn', 'Flag Party', '1f389', 'party'),
  ('esn', 'BYO Picnic (B - bring, Y - your, O - own)', '1f9fa', 'social'),
  ('esn', 'City Game (bring a pen)', '1f5fa', 'other'),
  ('esn', 'Erasmus Cup: Football', '26bd', 'sports'),
  ('esn', 'Historical fencing', '1f93a', 'sports'),
  ('esn', 'Brno United Karaoke', '1f3a4', 'karaoke'),
  ('esn', 'Country Presentation', '1f30d', 'culture'),
  ('esn', 'Boat Party', '1f6a2', 'party'),
  ('esn', 'Pub Quiz', '1f9e0', 'quiz'),
  ('esn', 'Beerpong', '1f3d3', 'social'),
  ('esn', 'Erasmus Cup: Volleyball', '1f3d0', 'sports'),
  ('esn', 'Beer Marathon', '1f37a', 'social'),
  ('esn', 'Erasmus Cup: Padel', '1f3be', 'sports'),
  ('esn', 'International Market', '1f6cd', 'culture'),
  ('esn', 'Halloween party', '1f383', 'party'),
  ('esn', 'Board games', '1f3b2', 'boardgames'),
  ('esn', 'Starobrno excursion', '1f37a', 'trip'),
  ('esn', 'Tram Party', '1f68b', 'party'),
  ('esn', 'Timetravels trip to Finland', '1f1eb-1f1ee', 'trip'),
  ('esn', 'Erasmus Cup: Basketball', '1f3c0', 'sports'),
  ('esn', 'Trip to Olomouc', '1f68c', 'trip'),
  ('esn', 'St. Nicholas visit', '1f385', 'culture'),
  ('esn', 'Christmas market', '1f384', 'culture'),
  ('esn', 'Ice skating', '26f8', 'sports'),
  ('esn', 'Trip to Prague', '1f68c', 'trip'),
  ('esn', 'Timetravels trip to Sweden', '1f1f8-1f1ea', 'trip'),
  ('esn', 'Christmas dinner', '1f37d', 'social'),
  ('esn', 'Goodbye party', '1f44b', 'party'),
  ('esn', 'Erasmus awards', '1f3c6', 'other'),
  ('supef', 'Deskovky', '1f3b2', 'boardgames'),
  ('supef', 'Filmový klub', '1f3ac', 'film'),
  ('supef', 'Tour de Pub', '1f37b', 'social'),
  ('supef', 'Redbull Felite Gamenight', '1f3ae', 'other'),
  ('supef', 'Beerpong', '1f3d3', 'social'),
  ('supef', 'PEF Quiz', '1f9e0', 'quiz'),
  ('supef', 'Tour de Svařák', '1f377', 'social'),
  ('supef', 'Pro Dobro Vánoc', '1f381', 'other'),
  ('supef', 'Karneval na ledu', '26f8', 'sports'),
  ('usaf', 'Bruch s USAFem', '1f950', 'social')
) as v(association_id, title, emoji, category)
where e.association_id = v.association_id and e.title = v.title;

-- Every row must now carry an emoji.
do $$
declare missing int;
begin
  select count(*) into missing from public.spolky_events where emoji is null;
  if missing > 0 then raise exception '% rows still without an emoji', missing; end if;
end $$;
commit;
