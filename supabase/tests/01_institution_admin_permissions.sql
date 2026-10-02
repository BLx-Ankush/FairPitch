-- Test Suite 01: Institution Admin Permissions & Multi-Tenant Isolation
-- Tests:
-- 1. Admin A can approve organizer A in Institution A.
-- 2. Admin A cannot approve organizer B in Institution B (throws exception).
-- 3. Admin A cannot modify events belonging to Institution B.

BEGIN;

CREATE EXTENSION IF NOT EXISTS pgtap;

SELECT plan(6);

-- Setup test fixtures
INSERT INTO public.institutions (id, name, slug, contact_email) VALUES
  ('11111111-1111-1111-1111-111111111111', 'Institution Alpha', 'inst-alpha', 'admin@alpha.edu'),
  ('22222222-2222-2222-2222-222222222222', 'Institution Beta', 'inst-beta', 'admin@beta.edu')
ON CONFLICT (id) DO NOTHING;

INSERT INTO auth.users (id, email) VALUES
  ('a1111111-0000-0000-0000-000000000001', 'admin@alpha.edu'),
  ('a2222222-0000-0000-0000-000000000002', 'admin@beta.edu'),
  ('b1111111-0000-0000-0000-000000000001', 'org@alpha.edu'),
  ('b2222222-0000-0000-0000-000000000002', 'org@beta.edu')
ON CONFLICT (id) DO NOTHING;

INSERT INTO public.profiles (id, institution_id, full_name, email, role, organizer_approval_status) VALUES
  ('a1111111-0000-0000-0000-000000000001', '11111111-1111-1111-1111-111111111111', 'Admin Alpha', 'admin@alpha.edu', 'institution_admin', 'approved'),
  ('a2222222-0000-0000-0000-000000000002', '22222222-2222-2222-2222-222222222222', 'Admin Beta', 'admin@beta.edu', 'institution_admin', 'approved'),
  ('b1111111-0000-0000-0000-000000000001', '11111111-1111-1111-1111-111111111111', 'Org Alpha', 'org@alpha.edu', 'user', 'pending'),
  ('b2222222-0000-0000-0000-000000000002', '22222222-2222-2222-2222-222222222222', 'Org Beta', 'org@beta.edu', 'user', 'pending')
ON CONFLICT (id) DO NOTHING;

INSERT INTO public.events (id, institution_id, title, slug, start_date, end_date, status, created_by) VALUES
  ('e1111111-0000-0000-0000-000000000001', '11111111-1111-1111-1111-111111111111', 'Alpha Hackathon', 'alpha-hack', now(), now() + interval '2 days', 'draft', 'a1111111-0000-0000-0000-000000000001'),
  ('e2222222-0000-0000-0000-000000000002', '22222222-2222-2222-2222-222222222222', 'Beta Hackathon', 'beta-hack', now(), now() + interval '2 days', 'draft', 'a2222222-0000-0000-0000-000000000002')
ON CONFLICT (id) DO NOTHING;

-- 1. Test: Unauthenticated user cannot approve organizer
SET ROLE anon;
SELECT set_config('request.jwt.claim.sub', '', true);
SELECT throws_ok(
  $$ SELECT public.approve_organizer('b1111111-0000-0000-0000-000000000001'::uuid) $$,
  'Unauthorized: Caller must be an institution administrator',
  'Unauthenticated user cannot approve organizers'
);

-- 2. Test: Admin Alpha can approve Org Alpha within same institution
SET ROLE authenticated;
SELECT set_config('request.jwt.claim.sub', 'a1111111-0000-0000-0000-000000000001', true);
SELECT lives_ok(
  $$ SELECT public.approve_organizer('b1111111-0000-0000-0000-000000000001'::uuid) $$,
  'Admin Alpha successfully approves Org Alpha'
);

SELECT is(
  (SELECT organizer_approval_status FROM public.profiles WHERE id = 'b1111111-0000-0000-0000-000000000001'),
  'approved',
  'Org Alpha approval status updated to approved'
);

-- 3. Test: Admin Alpha CANNOT approve Org Beta from Institution Beta
SELECT throws_ok(
  $$ SELECT public.approve_organizer('b2222222-0000-0000-0000-000000000002'::uuid) $$,
  'Cannot approve user from another institution',
  'Admin cannot approve organizer from another institution'
);

-- 4. Test: Admin Alpha cannot view Beta events under RLS
SELECT is(
  (SELECT count(*)::int FROM public.events WHERE institution_id = '22222222-2222-2222-2222-222222222222' AND status = 'draft'),
  0,
  'Admin Alpha cannot read draft events belonging to Institution Beta'
);

-- 5. Test: Admin Beta can reject Org Beta
SELECT set_config('request.jwt.claim.sub', 'a2222222-0000-0000-0000-000000000002', true);
SELECT lives_ok(
  $$ SELECT public.reject_organizer('b2222222-0000-0000-0000-000000000002'::uuid) $$,
  'Admin Beta can reject Org Beta'
);

RESET ROLE;
SELECT * FROM finish();
ROLLBACK;
