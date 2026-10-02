-- Test Suite 02: Organizer Permissions, Status Transitions, Rubric Freeze, and Score Gating
-- Tests:
-- 1. Forward-only state transition: draft -> open fails if rubric sum != 100.
-- 2. draft -> open succeeds when rubric sum = 100.
-- 3. Rubric freeze blocks criteria changes during judging and review.
-- 4. Organizer cannot SELECT scores during 'judging'.
-- 5. Organizer CAN SELECT scores during 'review' and 'published'.
-- 6. get_judge_progress functions correctly for organizers.

BEGIN;

CREATE EXTENSION IF NOT EXISTS pgtap;

SELECT plan(8);

-- Setup test fixtures
INSERT INTO public.institutions (id, name, slug, contact_email) VALUES
  ('11111111-1111-1111-1111-111111111111', 'Test University', 'test-univ', 'contact@test.edu')
ON CONFLICT (id) DO NOTHING;

INSERT INTO auth.users (id, email) VALUES
  ('a0000000-0000-0000-0000-000000000001', 'organizer@test.edu'),
  ('b0000000-0000-0000-0000-000000000002', 'judge@test.edu')
ON CONFLICT (id) DO NOTHING;

INSERT INTO public.profiles (id, institution_id, full_name, email, role, organizer_approval_status) VALUES
  ('a0000000-0000-0000-0000-000000000001', '11111111-1111-1111-1111-111111111111', 'Event Organizer', 'organizer@test.edu', 'user', 'approved'),
  ('b0000000-0000-0000-0000-000000000002', '11111111-1111-1111-1111-111111111111', 'Event Judge', 'judge@test.edu', 'user', 'none')
ON CONFLICT (id) DO NOTHING;

INSERT INTO public.events (id, institution_id, title, slug, start_date, end_date, status, created_by) VALUES
  ('e0000000-0000-0000-0000-000000000001', '11111111-1111-1111-1111-111111111111', 'Innovation Cup', 'inno-cup', now(), now() + interval '3 days', 'draft', 'a0000000-0000-0000-0000-000000000001')
ON CONFLICT (id) DO NOTHING;

INSERT INTO public.event_roles (user_id, event_id, institution_id, role, status) VALUES
  ('a0000000-0000-0000-0000-000000000001', 'e0000000-0000-0000-0000-000000000001', '11111111-1111-1111-1111-111111111111', 'organizer', 'active'),
  ('b0000000-0000-0000-0000-000000000002', 'e0000000-0000-0000-0000-000000000001', '11111111-1111-1111-1111-111111111111', 'jury', 'active')
ON CONFLICT DO NOTHING;

-- Act as organizer
SET ROLE authenticated;
SELECT set_config('request.jwt.claim.sub', 'a0000000-0000-0000-0000-000000000001', true);

-- Add incomplete rubric criteria (total weight = 60%, not 100%)
INSERT INTO public.rubric_criteria (id, event_id, institution_id, name, weight, order_index) VALUES
  ('c0000000-0000-0000-0000-000000000001', 'e0000000-0000-0000-0000-000000000001', '11111111-1111-1111-1111-111111111111', 'Innovation', 30, 1),
  ('c0000000-0000-0000-0000-000000000002', 'e0000000-0000-0000-0000-000000000001', '11111111-1111-1111-1111-111111111111', 'Impact', 30, 2);

-- 1. Test: Cannot open event when rubric sum is 60%
SELECT throws_ok(
  $$ SELECT public.transition_event_status('e0000000-0000-0000-0000-000000000001'::uuid, 'open') $$,
  'Cannot open event: Rubric criteria weights must total exactly 100% (current sum: 60)',
  'Opening event fails when rubric criteria weight does not total 100'
);

-- Complete rubric criteria to total exactly 100%
INSERT INTO public.rubric_criteria (id, event_id, institution_id, name, weight, order_index) VALUES
  ('c0000000-0000-0000-0000-000000000003', 'e0000000-0000-0000-0000-000000000001', '11111111-1111-1111-1111-111111111111', 'Technical Rigor', 40, 3);

-- 2. Test: Successfully open event when sum = 100%
SELECT is(
  (SELECT public.transition_event_status('e0000000-0000-0000-0000-000000000001'::uuid, 'open')),
  'open',
  'Event transitions to open successfully with 100% rubric weight'
);

-- 3. Test: Transition open -> judging
SELECT is(
  (SELECT public.transition_event_status('e0000000-0000-0000-0000-000000000001'::uuid, 'judging')),
  'judging',
  'Event transitions open -> judging successfully'
);

-- 4. Test: Rubric freeze: cannot modify or add criteria once judging starts
SELECT throws_ok(
  $$ INSERT INTO public.rubric_criteria (event_id, institution_id, name, weight) VALUES ('e0000000-0000-0000-0000-000000000001', '11111111-1111-1111-1111-111111111111', 'Presentation', 10) $$,
  'Rubric criteria are frozen once judging begins (current event status: judging)',
  'Inserting criteria during judging phase is blocked by trigger'
);

-- Setup team, assignment, and sample score
INSERT INTO public.teams (id, event_id, institution_id, name, team_code) VALUES
  ('d0000000-0000-0000-0000-000000000001', 'e0000000-0000-0000-0000-000000000001', '11111111-1111-1111-1111-111111111111', 'Quantum Leap', 'QL-01');

INSERT INTO public.judge_assignments (event_id, institution_id, judge_id, team_id, status) VALUES
  ('e0000000-0000-0000-0000-000000000001', '11111111-1111-1111-1111-111111111111', 'b0000000-0000-0000-0000-000000000002', 'd0000000-0000-0000-0000-000000000001', 'assigned');

-- Judge submits score via submit_scores
SELECT set_config('request.jwt.claim.sub', 'b0000000-0000-0000-0000-000000000002', true);
SELECT public.submit_scores('d0000000-0000-0000-0000-000000000001'::uuid, '[
  {"criterion_id": "c0000000-0000-0000-0000-000000000001", "score": 8.5, "comment": "Excellent creativity"},
  {"criterion_id": "c0000000-0000-0000-0000-000000000002", "score": 9.0, "comment": "Huge real-world potential"},
  {"criterion_id": "c0000000-0000-0000-0000-000000000003", "score": 7.5, "comment": "Solid backend"}
]'::jsonb);

-- 5. Test: Organizer cannot SELECT scores during 'judging' phase
SELECT set_config('request.jwt.claim.sub', 'a0000000-0000-0000-0000-000000000001', true);
SELECT is(
  (SELECT count(*)::int FROM public.scores WHERE event_id = 'e0000000-0000-0000-0000-000000000001'),
  0,
  'Organizer cannot SELECT raw scores during judging phase'
);

-- 6. Test: Transition judging -> review
SELECT is(
  (SELECT public.transition_event_status('e0000000-0000-0000-0000-000000000001'::uuid, 'review')),
  'review',
  'Event transitions judging -> review successfully'
);

-- 7. Test: Organizer CAN SELECT scores during review phase
SELECT is(
  (SELECT count(*)::int FROM public.scores WHERE event_id = 'e0000000-0000-0000-0000-000000000001'),
  3,
  'Organizer can view all scores once event is in review phase'
);

-- 8. Test: get_judge_progress returns 100% progress for judge who completed all criteria
SELECT is(
  (SELECT progress_pct FROM public.get_judge_progress('e0000000-0000-0000-0000-000000000001'::uuid) WHERE judge_id = 'b0000000-0000-0000-0000-000000000002'),
  100.0,
  'get_judge_progress accurately reports 100% completion for judge'
);

RESET ROLE;
SELECT * FROM finish();
ROLLBACK;
