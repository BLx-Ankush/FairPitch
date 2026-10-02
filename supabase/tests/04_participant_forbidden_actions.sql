-- Test Suite 04: Participant Forbidden Actions & Dual-Role Mutual Exclusion
-- Tests:
-- 1. Participant has zero direct SELECT access to scores table.
-- 2. get_published_team_results fails before event is published.
-- 3. get_published_team_results returns masked results when published.
-- 4. User registered in team_members cannot be granted 'jury' role in same event.
-- 5. User registered as 'jury' cannot be added to team_members in same event.

BEGIN;

CREATE EXTENSION IF NOT EXISTS pgtap;

SELECT plan(5);

-- Setup fixtures
INSERT INTO public.institutions (id, name, slug, contact_email) VALUES
  ('11111111-1111-1111-1111-111111111111', 'Test University', 'test-univ', 'contact@test.edu')
ON CONFLICT (id) DO NOTHING;

INSERT INTO auth.users (id, email) VALUES
  ('a0000000-0000-0000-0000-000000000001', 'participant1@test.edu'),
  ('b0000000-0000-0000-0000-000000000001', 'judge1@test.edu')
ON CONFLICT (id) DO NOTHING;

INSERT INTO public.profiles (id, institution_id, full_name, email, role) VALUES
  ('a0000000-0000-0000-0000-000000000001', '11111111-1111-1111-1111-111111111111', 'Participant One', 'participant1@test.edu', 'user'),
  ('b0000000-0000-0000-0000-000000000001', '11111111-1111-1111-1111-111111111111', 'Dr. Evelyn Vance', 'judge1@test.edu', 'user')
ON CONFLICT (id) DO NOTHING;

INSERT INTO public.events (id, institution_id, title, slug, start_date, end_date, status) VALUES
  ('e0000000-0000-0000-0000-000000000001', '11111111-1111-1111-1111-111111111111', 'FairPitch Hackathon', 'fp-hack', now(), now() + interval '2 days', 'draft')
ON CONFLICT (id) DO NOTHING;

INSERT INTO public.event_roles (user_id, event_id, institution_id, role, status) VALUES
  ('a0000000-0000-0000-0000-000000000001', 'e0000000-0000-0000-0000-000000000001', '11111111-1111-1111-1111-111111111111', 'participant', 'active'),
  ('b0000000-0000-0000-0000-000000000001', 'e0000000-0000-0000-0000-000000000001', '11111111-1111-1111-1111-111111111111', 'jury', 'active')
ON CONFLICT DO NOTHING;

INSERT INTO public.teams (id, event_id, institution_id, name, team_code) VALUES
  ('d0000000-0000-0000-0000-000000000001', 'e0000000-0000-0000-0000-000000000001', '11111111-1111-1111-1111-111111111111', 'Team Alpha', 'TA-01');

INSERT INTO public.team_members (team_id, event_id, institution_id, user_id, role) VALUES
  ('d0000000-0000-0000-0000-000000000001', 'e0000000-0000-0000-0000-000000000001', '11111111-1111-1111-1111-111111111111', 'a0000000-0000-0000-0000-000000000001', 'lead');

INSERT INTO public.rubric_criteria (id, event_id, institution_id, name, weight) VALUES
  ('c0000000-0000-0000-0000-000000000001', 'e0000000-0000-0000-0000-000000000001', '11111111-1111-1111-1111-111111111111', 'Innovation', 100);

-- Transition to judging phase
UPDATE public.events SET status = 'judging' WHERE id = 'e0000000-0000-0000-0000-000000000001';

INSERT INTO public.judge_assignments (event_id, institution_id, judge_id, team_id, status) VALUES
  ('e0000000-0000-0000-0000-000000000001', '11111111-1111-1111-1111-111111111111', 'b0000000-0000-0000-0000-000000000001', 'd0000000-0000-0000-0000-000000000001', 'assigned');

-- Judge scores the team
SELECT set_config('request.jwt.claim.sub', 'b0000000-0000-0000-0000-000000000001', true);
SELECT public.submit_scores('d0000000-0000-0000-0000-000000000001'::uuid, '[{"criterion_id": "c0000000-0000-0000-0000-000000000001", "score": 9.5, "comment": "Brilliant pitch"}]'::jsonb);

-- Set judge alias
INSERT INTO public.aliases (event_id, institution_id, user_id, entity_type, alias_label) VALUES
  ('e0000000-0000-0000-0000-000000000001', '11111111-1111-1111-1111-111111111111', 'b0000000-0000-0000-0000-000000000001', 'judge', 'Judge A');

-- Act as participant
SET ROLE authenticated;
SELECT set_config('request.jwt.claim.sub', 'a0000000-0000-0000-0000-000000000001', true);

-- 1. Test: Participant cannot directly query scores table
SELECT is(
  (SELECT count(*)::int FROM public.scores WHERE team_id = 'd0000000-0000-0000-0000-000000000001'),
  0,
  'Participant has zero direct SELECT access to scores table'
);

-- 2. Test: Participant cannot access get_published_team_results before published status
SELECT throws_ok(
  $$ SELECT public.get_published_team_results('d0000000-0000-0000-0000-000000000001'::uuid) $$,
  'Results are not available: Event has not been published yet',
  'Participant cannot view results when event status is judging'
);

-- Publish event (executed as superuser)
RESET ROLE;
UPDATE public.events SET status = 'published' WHERE id = 'e0000000-0000-0000-0000-000000000001';
SET ROLE authenticated;
SELECT set_config('request.jwt.claim.sub', 'a0000000-0000-0000-0000-000000000001', true);

-- 3. Test: Participant can access results once published, with masked judge alias (Judge A)
SELECT is(
  (SELECT public.get_published_team_results('d0000000-0000-0000-0000-000000000001'::uuid)->'scores'->0->>'judge_alias'),
  'Judge A',
  'Participant sees masked judge alias Judge A, never real judge identity'
);

-- 4. Test: Participant cannot be granted jury role in the same event
SELECT throws_ok(
  $$ INSERT INTO public.event_roles (user_id, event_id, institution_id, role, status)
     VALUES ('a0000000-0000-0000-0000-000000000001', 'e0000000-0000-0000-0000-000000000001', '11111111-1111-1111-1111-111111111111', 'jury', 'active') $$,
  'is already a team participant in event',
  'Mutual exclusion prevents team participant from being added as jury'
);

-- 5. Test: Jury member cannot be added as a team member in the same event
SELECT throws_ok(
  $$ INSERT INTO public.team_members (team_id, event_id, institution_id, user_id, role)
     VALUES ('d0000000-0000-0000-0000-000000000001', 'e0000000-0000-0000-0000-000000000001', '11111111-1111-1111-1111-111111111111', 'b0000000-0000-0000-0000-000000000001', 'member') $$,
  'is already registered as a jury member for event',
  'Mutual exclusion prevents jury member from joining a team'
);

RESET ROLE;
SELECT * FROM finish();
ROLLBACK;
