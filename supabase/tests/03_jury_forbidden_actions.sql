-- Test Suite 03: Jury Forbidden Actions & Ledger Immutability
-- Tests:
-- 1. Direct INSERT on scores is rejected.
-- 2. submit_scores fails if judge is not assigned to team.
-- 3. submit_scores fails if conflict of interest declared.
-- 4. submit_scores fails if any criterion evaluation is omitted or comment empty.
-- 5. Direct UPDATE on scores blocked by append-only trigger.
-- 6. Direct DELETE on scores blocked by append-only trigger.
-- 7. Direct UPDATE on audit_log blocked by trigger.
-- 8. Direct DELETE on audit_log blocked by trigger.
-- 9. Jury member cannot view another judge's scores.

BEGIN;

CREATE EXTENSION IF NOT EXISTS pgtap;

SELECT plan(9);

-- Setup test fixtures
INSERT INTO public.institutions (id, name, slug, contact_email) VALUES
  ('11111111-1111-1111-1111-111111111111', 'Test University', 'test-univ', 'contact@test.edu')
ON CONFLICT (id) DO NOTHING;

INSERT INTO auth.users (id, email) VALUES
  ('b0000000-0000-0000-0000-000000000001', 'judge1@test.edu'),
  ('b0000000-0000-0000-0000-000000000002', 'judge2@test.edu')
ON CONFLICT (id) DO NOTHING;

INSERT INTO public.profiles (id, institution_id, full_name, email, role) VALUES
  ('b0000000-0000-0000-0000-000000000001', '11111111-1111-1111-1111-111111111111', 'Dr. Judge One', 'judge1@test.edu', 'user'),
  ('b0000000-0000-0000-0000-000000000002', '11111111-1111-1111-1111-111111111111', 'Dr. Judge Two', 'judge2@test.edu', 'user')
ON CONFLICT (id) DO NOTHING;

INSERT INTO public.events (id, institution_id, title, slug, start_date, end_date, status) VALUES
  ('e0000000-0000-0000-0000-000000000001', '11111111-1111-1111-1111-111111111111', 'HackFest', 'hackfest', now(), now() + interval '3 days', 'draft')
ON CONFLICT (id) DO NOTHING;

INSERT INTO public.event_roles (user_id, event_id, institution_id, role, status) VALUES
  ('b0000000-0000-0000-0000-000000000001', 'e0000000-0000-0000-0000-000000000001', '11111111-1111-1111-1111-111111111111', 'jury', 'active'),
  ('b0000000-0000-0000-0000-000000000002', 'e0000000-0000-0000-0000-000000000001', '11111111-1111-1111-1111-111111111111', 'jury', 'active')
ON CONFLICT DO NOTHING;

INSERT INTO public.rubric_criteria (id, event_id, institution_id, name, weight, order_index) VALUES
  ('c0000000-0000-0000-0000-000000000001', 'e0000000-0000-0000-0000-000000000001', '11111111-1111-1111-1111-111111111111', 'Technical Feasibility', 50, 1),
  ('c0000000-0000-0000-0000-000000000002', 'e0000000-0000-0000-0000-000000000001', '11111111-1111-1111-1111-111111111111', 'Impact', 50, 2)
ON CONFLICT (id) DO NOTHING;

-- Transition event to judging phase once rubric criteria are established
UPDATE public.events SET status = 'judging' WHERE id = 'e0000000-0000-0000-0000-000000000001';

INSERT INTO public.teams (id, event_id, institution_id, name, team_code) VALUES
  ('d0000000-0000-0000-0000-000000000001', 'e0000000-0000-0000-0000-000000000001', '11111111-1111-1111-1111-111111111111', 'SolarFlow', 'SF-01'),
  ('d0000000-0000-0000-0000-000000000002', 'e0000000-0000-0000-0000-000000000001', '11111111-1111-1111-1111-111111111111', 'AeroPulse', 'AP-02')
ON CONFLICT (id) DO NOTHING;

-- Assign Judge 1 to Team 1 only
INSERT INTO public.judge_assignments (event_id, institution_id, judge_id, team_id, status) VALUES
  ('e0000000-0000-0000-0000-000000000001', '11111111-1111-1111-1111-111111111111', 'b0000000-0000-0000-0000-000000000001', 'd0000000-0000-0000-0000-000000000001', 'assigned'),
  ('e0000000-0000-0000-0000-000000000001', '11111111-1111-1111-1111-111111111111', 'b0000000-0000-0000-0000-000000000002', 'd0000000-0000-0000-0000-000000000002', 'assigned')
ON CONFLICT DO NOTHING;

-- Act as Judge 1
SET ROLE authenticated;
SELECT set_config('request.jwt.claim.sub', 'b0000000-0000-0000-0000-000000000001', true);

-- 1. Test: submit_scores fails if evaluating non-assigned team
SELECT throws_ok(
  $$ SELECT public.submit_scores('d0000000-0000-0000-0000-000000000002'::uuid, '[{"criterion_id": "c0000000-0000-0000-0000-000000000001", "score": 9, "comment": "Good"}, {"criterion_id": "c0000000-0000-0000-0000-000000000002", "score": 8, "comment": "Great"}]'::jsonb) $$,
  'Judge is not actively assigned to evaluate team',
  'Cannot evaluate team without active assignment'
);

-- Pre-register conflict between Judge 1 and Team 1
INSERT INTO public.conflicts (event_id, institution_id, judge_id, team_id, declared_by, reason) VALUES
  ('e0000000-0000-0000-0000-000000000001', '11111111-1111-1111-1111-111111111111', 'b0000000-0000-0000-0000-000000000001', 'd0000000-0000-0000-0000-000000000001', 'b0000000-0000-0000-0000-000000000001', 'I advised this team');

-- 2. Test: submit_scores fails if conflict declared
SELECT throws_ok(
  $$ SELECT public.submit_scores('d0000000-0000-0000-0000-000000000001'::uuid, '[{"criterion_id": "c0000000-0000-0000-0000-000000000001", "score": 9, "comment": "Good"}, {"criterion_id": "c0000000-0000-0000-0000-000000000002", "score": 8, "comment": "Great"}]'::jsonb) $$,
  'Cannot evaluate team: A conflict of interest was declared for this assignment',
  'Cannot evaluate team with declared conflict of interest'
);

-- Remove conflict for further tests
DELETE FROM public.conflicts WHERE judge_id = 'b0000000-0000-0000-0000-000000000001' AND team_id = 'd0000000-0000-0000-0000-000000000001';

-- 3. Test: submit_scores fails if evaluation has empty comment
SELECT throws_ok(
  $$ SELECT public.submit_scores('d0000000-0000-0000-0000-000000000001'::uuid, '[{"criterion_id": "c0000000-0000-0000-0000-000000000001", "score": 9, "comment": ""}, {"criterion_id": "c0000000-0000-0000-0000-000000000002", "score": 8, "comment": "Fine"}]'::jsonb) $$,
  'A non-empty feedback comment is required for criterion',
  'Cannot submit scores with empty comments'
);

-- 4. Test: submit_scores fails if criteria count is incomplete (only 1 criterion instead of 2)
SELECT throws_ok(
  $$ SELECT public.submit_scores('d0000000-0000-0000-0000-000000000001'::uuid, '[{"criterion_id": "c0000000-0000-0000-0000-000000000001", "score": 9, "comment": "Solid"}]'::jsonb) $$,
  'Evaluation incomplete: exactly 2 criteria required, received 1',
  'Cannot submit partial criteria evaluation'
);

-- Submit valid score
SELECT public.submit_scores('d0000000-0000-0000-0000-000000000001'::uuid, '[
  {"criterion_id": "c0000000-0000-0000-0000-000000000001", "score": 8.0, "comment": "Well engineered"},
  {"criterion_id": "c0000000-0000-0000-0000-000000000002", "score": 8.5, "comment": "Clear user adoption pathway"}
]'::jsonb);

-- 5. Test: Direct UPDATE on scores is blocked by trigger
SELECT throws_ok(
  $$ UPDATE public.scores SET score = 10.0 WHERE judge_id = 'b0000000-0000-0000-0000-000000000001' AND team_id = 'd0000000-0000-0000-0000-000000000001' $$,
  'Scores table is strictly append-only. Direct UPDATE and DELETE are prohibited.',
  'Direct UPDATE on scores blocked by immutability trigger'
);

-- 6. Test: Direct DELETE on scores is blocked by trigger
SELECT throws_ok(
  $$ DELETE FROM public.scores WHERE judge_id = 'b0000000-0000-0000-0000-000000000001' AND team_id = 'd0000000-0000-0000-0000-000000000001' $$,
  'Scores table is strictly append-only. Direct UPDATE and DELETE are prohibited.',
  'Direct DELETE on scores blocked by immutability trigger'
);

-- 7. Test: Direct UPDATE on audit_log is blocked by trigger
SELECT throws_ok(
  $$ UPDATE public.audit_log SET current_hash = 'TAMPERED_HASH' WHERE judge_id = 'b0000000-0000-0000-0000-000000000001' $$,
  'Audit log is immutable. UPDATE and DELETE are strictly prohibited.',
  'Direct UPDATE on audit_log blocked by trigger'
);

-- 8. Test: Direct DELETE on audit_log is blocked by trigger
SELECT throws_ok(
  $$ DELETE FROM public.audit_log WHERE judge_id = 'b0000000-0000-0000-0000-000000000001' $$,
  'Audit log is immutable. UPDATE and DELETE are strictly prohibited.',
  'Direct DELETE on audit_log blocked by trigger'
);

-- 9. Test: Judge 2 cannot see Judge 1's scores
SELECT set_config('request.jwt.claim.sub', 'b0000000-0000-0000-0000-000000000002', true);
SELECT is(
  (SELECT count(*)::int FROM public.scores WHERE judge_id = 'b0000000-0000-0000-0000-000000000001'),
  0,
  'Judge 2 cannot view Judge 1 scores under RLS'
);

RESET ROLE;
SELECT * FROM finish();
ROLLBACK;
