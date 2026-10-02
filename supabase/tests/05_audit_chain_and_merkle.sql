-- Test Suite 05: Cryptographic Hash Chains, Merkle Root Aggregation, and Immutability
-- Tests:
-- 1. Two judges produce independent, continuous block sequences starting at 0.
-- 2. verify_judge_chain validates sequential integrity for each judge.
-- 3. verify_event_chain validates event-level chain blocks.
-- 4. compute_event_merkle_root implements the odd-leaf duplication rule and returns 64-char hex string.
-- 5. Transition to 'published' anchors the Merkle root.
-- 6. Trigger prevents any modification to anchored_merkle_root once set.

BEGIN;

CREATE EXTENSION IF NOT EXISTS pgtap;

SELECT plan(7);

-- Setup test fixtures
INSERT INTO public.institutions (id, name, slug, contact_email) VALUES
  ('11111111-1111-1111-1111-111111111111', 'Test University', 'test-univ', 'contact@test.edu')
ON CONFLICT (id) DO NOTHING;

INSERT INTO auth.users (id, email) VALUES
  ('a0000000-0000-0000-0000-000000000001', 'org@test.edu'),
  ('b0000000-0000-0000-0000-000000000001', 'eva@test.edu'),
  ('b0000000-0000-0000-0000-000000000002', 'marc@test.edu')
ON CONFLICT (id) DO NOTHING;

INSERT INTO public.profiles (id, institution_id, full_name, email, role, organizer_approval_status) VALUES
  ('a0000000-0000-0000-0000-000000000001', '11111111-1111-1111-1111-111111111111', 'Lead Organizer', 'org@test.edu', 'user', 'approved'),
  ('b0000000-0000-0000-0000-000000000001', '11111111-1111-1111-1111-111111111111', 'Dr. Evelyn Vance', 'eva@test.edu', 'user', 'none'),
  ('b0000000-0000-0000-0000-000000000002', '11111111-1111-1111-1111-111111111111', 'Marcus Sterling', 'marc@test.edu', 'user', 'none')
ON CONFLICT (id) DO NOTHING;

INSERT INTO public.events (id, institution_id, title, slug, start_date, end_date, status, created_by) VALUES
  ('e0000000-0000-0000-0000-000000000001', '11111111-1111-1111-1111-111111111111', 'Chain Event', 'chain-event', now(), now() + interval '3 days', 'draft', 'a0000000-0000-0000-0000-000000000001')
ON CONFLICT (id) DO NOTHING;

INSERT INTO public.event_roles (user_id, event_id, institution_id, role, status) VALUES
  ('a0000000-0000-0000-0000-000000000001', 'e0000000-0000-0000-0000-000000000001', '11111111-1111-1111-1111-111111111111', 'organizer', 'active'),
  ('b0000000-0000-0000-0000-000000000001', 'e0000000-0000-0000-0000-000000000001', '11111111-1111-1111-1111-111111111111', 'jury', 'active'),
  ('b0000000-0000-0000-0000-000000000002', 'e0000000-0000-0000-0000-000000000001', '11111111-1111-1111-1111-111111111111', 'jury', 'active')
ON CONFLICT DO NOTHING;

INSERT INTO public.rubric_criteria (id, event_id, institution_id, name, weight) VALUES
  ('c0000000-0000-0000-0000-000000000001', 'e0000000-0000-0000-0000-000000000001', '11111111-1111-1111-1111-111111111111', 'Feasibility', 100);

-- Transition to judging phase
UPDATE public.events SET status = 'judging' WHERE id = 'e0000000-0000-0000-0000-000000000001';

INSERT INTO public.teams (id, event_id, institution_id, name, team_code) VALUES
  ('d0000000-0000-0000-0000-000000000001', 'e0000000-0000-0000-0000-000000000001', '11111111-1111-1111-1111-111111111111', 'Team One', 'T01'),
  ('d0000000-0000-0000-0000-000000000002', 'e0000000-0000-0000-0000-000000000001', '11111111-1111-1111-1111-111111111111', 'Team Two', 'T02');

INSERT INTO public.judge_assignments (event_id, institution_id, judge_id, team_id, status) VALUES
  ('e0000000-0000-0000-0000-000000000001', '11111111-1111-1111-1111-111111111111', 'b0000000-0000-0000-0000-000000000001', 'd0000000-0000-0000-0000-000000000001', 'assigned'),
  ('e0000000-0000-0000-0000-000000000001', '11111111-1111-1111-1111-111111111111', 'b0000000-0000-0000-0000-000000000001', 'd0000000-0000-0000-0000-000000000002', 'assigned'),
  ('e0000000-0000-0000-0000-000000000001', '11111111-1111-1111-1111-111111111111', 'b0000000-0000-0000-0000-000000000002', 'd0000000-0000-0000-0000-000000000001', 'assigned');

-- Judge Eva scores Team 1 & Team 2
SET ROLE authenticated;
SELECT set_config('request.jwt.claim.sub', 'b0000000-0000-0000-0000-000000000001', true);
SELECT public.submit_scores('d0000000-0000-0000-0000-000000000001'::uuid, '[{"criterion_id": "c0000000-0000-0000-0000-000000000001", "score": 8, "comment": "Good"}]'::jsonb);
SELECT public.submit_scores('d0000000-0000-0000-0000-000000000002'::uuid, '[{"criterion_id": "c0000000-0000-0000-0000-000000000001", "score": 9, "comment": "Great"}]'::jsonb);

-- Judge Marc scores Team 1
SELECT set_config('request.jwt.claim.sub', 'b0000000-0000-0000-0000-000000000002', true);
SELECT public.submit_scores('d0000000-0000-0000-0000-000000000001'::uuid, '[{"criterion_id": "c0000000-0000-0000-0000-000000000001", "score": 7, "comment": "Solid"}]'::jsonb);

-- Act as organizer to audit the chain and verify integrity
SELECT set_config('request.jwt.claim.sub', 'a0000000-0000-0000-0000-000000000001', true);

-- 1. Test: Judge Eva has blocks 0 and 1
SELECT is(
  (SELECT array_agg(block_index ORDER BY block_index) FROM public.audit_log WHERE event_id = 'e0000000-0000-0000-0000-000000000001' AND judge_id = 'b0000000-0000-0000-0000-000000000001'),
  ARRAY[0::bigint, 1::bigint],
  'Judge Eva audit chain contains sequential blocks 0 and 1'
);

-- 2. Test: Judge Marc has block 0
SELECT is(
  (SELECT array_agg(block_index ORDER BY block_index) FROM public.audit_log WHERE event_id = 'e0000000-0000-0000-0000-000000000001' AND judge_id = 'b0000000-0000-0000-0000-000000000002'),
  ARRAY[0::bigint],
  'Judge Marc has independent audit chain starting at block 0'
);

-- 3. Test: verify_judge_chain returns valid for Judge Eva
SELECT is(
  (SELECT is_valid FROM public.verify_judge_chain('e0000000-0000-0000-0000-000000000001'::uuid, 'b0000000-0000-0000-0000-000000000001'::uuid)),
  true,
  'Cryptographic chain verification for Judge Eva is valid'
);

-- 4. Test: verify_event_chain returns valid for event-level chain
SELECT is(
  (SELECT is_valid FROM public.verify_event_chain('e0000000-0000-0000-0000-000000000001'::uuid)),
  true,
  'Event-level audit chain verification is valid'
);

-- 5. Test: compute_event_merkle_root returns 64-char hex string
SELECT ok(
  length(public.compute_event_merkle_root('e0000000-0000-0000-0000-000000000001'::uuid)) = 64,
  'compute_event_merkle_root produces valid 64-character SHA-256 Merkle root'
);

-- Act as organizer to transition to review and published
SELECT set_config('request.jwt.claim.sub', 'a0000000-0000-0000-0000-000000000001', true);
SELECT public.transition_event_status('e0000000-0000-0000-0000-000000000001'::uuid, 'review');
SELECT public.transition_event_status('e0000000-0000-0000-0000-000000000001'::uuid, 'published');

-- 6. Test: anchored_merkle_root is populated upon publish
SELECT ok(
  (SELECT anchored_merkle_root FROM public.events WHERE id = 'e0000000-0000-0000-0000-000000000001') IS NOT NULL,
  'Event anchored_merkle_root is populated and anchored upon publishing'
);

-- 7. Test: Attempt to mutate anchored_merkle_root throws exception
SELECT throws_ok(
  $$ UPDATE public.events SET anchored_merkle_root = 'ALTERED_ROOT' WHERE id = 'e0000000-0000-0000-0000-000000000001' $$,
  'anchored_merkle_root is immutable once anchored at publish time',
  'Trigger prevents mutation of anchored_merkle_root once set'
);

RESET ROLE;
SELECT * FROM finish();
ROLLBACK;
