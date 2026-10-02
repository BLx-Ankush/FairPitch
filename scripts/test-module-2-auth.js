// scripts/test-module-2-auth.js
// Automated verification test suite for FairPitch Module 2:
// - Cryptographic tokens (SHA-256 invite hashes)
// - Route authorization & proxy decision matrix
// - Database role management (approve_organizer, cross-institution barriers)
// - DPDP consent recording
// - Magic link invite lifecycle & event_role activation

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { PGlite } = require('@electric-sql/pglite');
const { pgcrypto } = require('@electric-sql/pglite/contrib/pgcrypto');

// Helper: Token hashing
function hashToken(rawToken) {
  return crypto.createHash('sha256').update(rawToken).digest('hex');
}

// Simulated Proxy Decision Engine (mirroring src/proxy.ts)
function evaluateProxyDecision({
  pathname,
  user,
  profile,
  hasConsent,
  juryRoles = [],
  teamRoles = []
}) {
  const isPublicRoute =
    pathname === '/' ||
    pathname.startsWith('/verify') ||
    pathname.startsWith('/invite') ||
    pathname === '/unauthorized';

  const isAuthRoute = pathname === '/login' || pathname === '/signup';

  if (!user) {
    if (isPublicRoute || isAuthRoute) {
      return { action: 'ALLOW' };
    }
    return {
      action: 'REDIRECT',
      destination: `/login?redirectTo=${encodeURIComponent(pathname)}`
    };
  }

  const role = profile?.role || 'user';
  const organizerStatus = profile?.organizer_approval_status || 'none';

  // DPDP Consent Check
  if (!hasConsent) {
    if (pathname !== '/consent') {
      return {
        action: 'REDIRECT',
        destination: `/consent?redirectTo=${encodeURIComponent(pathname)}`
      };
    }
    return { action: 'ALLOW' };
  } else if (pathname === '/consent') {
    const dest =
      role === 'institution_admin' || role === 'platform_owner'
        ? '/admin'
        : organizerStatus === 'approved'
        ? '/org'
        : organizerStatus === 'pending'
        ? '/pending-approval'
        : '/team';
    return { action: 'REDIRECT', destination: dest };
  }

  // Auth route redirect for logged in users
  if (isAuthRoute) {
    const dest =
      role === 'institution_admin' || role === 'platform_owner'
        ? '/admin'
        : organizerStatus === 'approved'
        ? '/org'
        : organizerStatus === 'pending'
        ? '/pending-approval'
        : '/team';
    return { action: 'REDIRECT', destination: dest };
  }

  // /admin/*
  if (pathname.startsWith('/admin')) {
    if (role !== 'platform_owner' && role !== 'institution_admin') {
      return { action: 'REDIRECT', destination: '/unauthorized?reason=admin_privileges_required' };
    }
    return { action: 'ALLOW' };
  }

  // /org/*
  if (pathname.startsWith('/org')) {
    if (role === 'platform_owner' || role === 'institution_admin') {
      return { action: 'ALLOW' };
    }
    if (organizerStatus === 'pending') {
      return { action: 'REDIRECT', destination: '/pending-approval' };
    }
    if (organizerStatus === 'rejected') {
      return { action: 'REDIRECT', destination: '/unauthorized?reason=organizer_application_rejected' };
    }
    if (organizerStatus !== 'approved') {
      return { action: 'REDIRECT', destination: '/unauthorized?reason=organizer_approval_required' };
    }
    return { action: 'ALLOW' };
  }

  // /pending-approval
  if (pathname === '/pending-approval') {
    if (organizerStatus === 'approved' || role === 'institution_admin' || role === 'platform_owner') {
      return { action: 'REDIRECT', destination: '/org' };
    }
    return { action: 'ALLOW' };
  }

  // /jury/*
  if (pathname.startsWith('/jury')) {
    if (role === 'platform_owner' || role === 'institution_admin') {
      return { action: 'ALLOW' };
    }
    if (juryRoles.length > 0) {
      return { action: 'ALLOW' };
    }
    return { action: 'REDIRECT', destination: '/unauthorized?reason=jury_access_required' };
  }

  // /team/*
  if (pathname.startsWith('/team')) {
    return { action: 'ALLOW' };
  }

  return { action: 'ALLOW' };
}

async function main() {
  console.log('===============================================================');
  console.log('  FAIRPITCH MODULE 2: AUTH, SESSION & ROLE PROXY TEST SUITE');
  console.log('===============================================================\n');

  let passed = 0;
  let failed = 0;

  function assert(description, condition, details = '') {
    if (condition) {
      console.log(`  ✓ PASS: ${description}`);
      passed++;
    } else {
      console.error(`  ✗ FAIL: ${description} ${details ? `(${details})` : ''}`);
      failed++;
    }
  }

  // -------------------------------------------------------------
  // Test Section 1: Cryptographic Tokens & Hashing
  // -------------------------------------------------------------
  console.log('[Test Suite 1] Cryptographic Tokens & SHA-256 Hashing');
  const rawToken = crypto.randomBytes(32).toString('hex');
  const hashedToken = hashToken(rawToken);

  assert('Raw token is 64 hex characters (32 bytes)', rawToken.length === 64);
  assert('Hashed token is 64 hex characters (SHA-256)', hashedToken.length === 64);
  assert('SHA-256 hash is deterministic', hashToken(rawToken) === hashedToken);
  assert('Different token produces different hash', hashToken('different-token') !== hashedToken);
  console.log('');

  // -------------------------------------------------------------
  // Test Section 2: Next.js 16 Proxy Authorization Matrix
  // -------------------------------------------------------------
  console.log('[Test Suite 2] Route Protection & Proxy Decision Matrix');

  // Case 2.1: Unauthenticated access
  const unauthAdmin = evaluateProxyDecision({ pathname: '/admin', user: null });
  assert('Unauthenticated /admin redirects to /login', unauthAdmin.action === 'REDIRECT' && unauthAdmin.destination.startsWith('/login'));

  const unauthOrg = evaluateProxyDecision({ pathname: '/org', user: null });
  assert('Unauthenticated /org redirects to /login', unauthOrg.action === 'REDIRECT' && unauthOrg.destination.startsWith('/login'));

  const unauthJury = evaluateProxyDecision({ pathname: '/jury', user: null });
  assert('Unauthenticated /jury redirects to /login', unauthJury.action === 'REDIRECT' && unauthJury.destination.startsWith('/login'));

  const unauthPublicVerify = evaluateProxyDecision({ pathname: '/verify', user: null });
  assert('Unauthenticated /verify is ALLOWED (public)', unauthPublicVerify.action === 'ALLOW');

  const unauthInvite = evaluateProxyDecision({ pathname: `/invite/${rawToken}`, user: null });
  assert('Unauthenticated /invite/[token] is ALLOWED (public redemption)', unauthInvite.action === 'ALLOW');

  // Case 2.2: Authenticated user without DPDP consent
  const authNoConsent = evaluateProxyDecision({
    pathname: '/team',
    user: { id: 'u1' },
    profile: { role: 'user', organizer_approval_status: 'none' },
    hasConsent: false
  });
  assert('Authenticated without consent redirects to /consent', authNoConsent.action === 'REDIRECT' && authNoConsent.destination.startsWith('/consent'));

  // Case 2.3: Authenticated user with DPDP consent visiting /consent
  const authWithConsentOnConsentPage = evaluateProxyDecision({
    pathname: '/consent',
    user: { id: 'u1' },
    profile: { role: 'user', organizer_approval_status: 'none' },
    hasConsent: true
  });
  assert('User with existing consent on /consent redirects to dashboard', authWithConsentOnConsentPage.action === 'REDIRECT' && authWithConsentOnConsentPage.destination === '/team');

  // Case 2.4: Organizer in pending status accessing /org
  const pendingOrg = evaluateProxyDecision({
    pathname: '/org',
    user: { id: 'u2' },
    profile: { role: 'user', organizer_approval_status: 'pending' },
    hasConsent: true
  });
  assert('Organizer in pending status redirects to /pending-approval', pendingOrg.action === 'REDIRECT' && pendingOrg.destination === '/pending-approval');

  // Case 2.5: Organizer in pending status trying /admin
  const pendingOrgAdmin = evaluateProxyDecision({
    pathname: '/admin',
    user: { id: 'u2' },
    profile: { role: 'user', organizer_approval_status: 'pending' },
    hasConsent: true
  });
  assert('Organizer trying /admin redirects to /unauthorized', pendingOrgAdmin.action === 'REDIRECT' && pendingOrgAdmin.destination.startsWith('/unauthorized'));

  // Case 2.6: Approved organizer accessing /org
  const approvedOrg = evaluateProxyDecision({
    pathname: '/org',
    user: { id: 'u3' },
    profile: { role: 'user', organizer_approval_status: 'approved' },
    hasConsent: true
  });
  assert('Approved organizer accessing /org is ALLOWED', approvedOrg.action === 'ALLOW');

  // Case 2.7: Institution Admin accessing /admin and /org
  const instAdmin = evaluateProxyDecision({
    pathname: '/admin',
    user: { id: 'u4' },
    profile: { role: 'institution_admin', organizer_approval_status: 'approved' },
    hasConsent: true
  });
  assert('Institution Admin accessing /admin is ALLOWED', instAdmin.action === 'ALLOW');

  const instAdminOrg = evaluateProxyDecision({
    pathname: '/org',
    user: { id: 'u4' },
    profile: { role: 'institution_admin', organizer_approval_status: 'approved' },
    hasConsent: true
  });
  assert('Institution Admin accessing /org is ALLOWED', instAdminOrg.action === 'ALLOW');

  // Case 2.8: Participant accessing /jury without jury role
  const participantJury = evaluateProxyDecision({
    pathname: '/jury',
    user: { id: 'u5' },
    profile: { role: 'user', organizer_approval_status: 'none' },
    hasConsent: true,
    juryRoles: []
  });
  assert('Participant accessing /jury without assignment redirects to /unauthorized', participantJury.action === 'REDIRECT' && participantJury.destination.startsWith('/unauthorized'));

  // Case 2.9: Evaluator with active jury role accessing /jury
  const activeJury = evaluateProxyDecision({
    pathname: '/jury',
    user: { id: 'u6' },
    profile: { role: 'user', organizer_approval_status: 'none' },
    hasConsent: true,
    juryRoles: [{ id: 'jr1' }]
  });
  assert('Evaluator with active jury role accessing /jury is ALLOWED', activeJury.action === 'ALLOW');
  console.log('');

  // -------------------------------------------------------------
  // Test Section 3: Database Multi-Tenant Role Operations
  // -------------------------------------------------------------
  console.log('[Test Suite 3] Database Multi-Tenant Enforcement & RPCs');
  const db = new PGlite({ extensions: { pgcrypto } });

  // 1. Setup Auth and Migrations
  await db.exec(`
    CREATE EXTENSION IF NOT EXISTS pgcrypto;
    CREATE SCHEMA IF NOT EXISTS auth;
    CREATE TABLE IF NOT EXISTS auth.users (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        email TEXT UNIQUE,
        created_at TIMESTAMPTZ DEFAULT now()
    );
    CREATE OR REPLACE FUNCTION auth.uid() RETURNS UUID AS $$
        SELECT NULLIF(current_setting('request.jwt.claim.sub', true), '')::UUID;
    $$ LANGUAGE sql STABLE;
  `);

  const migrationFiles = [
    '20261001000001_tables_and_indexes.sql',
    '20261001000002_helper_functions.sql',
    '20261001000003_audit_chain_and_triggers.sql',
    '20261001000004_rls_policies.sql',
    '20261001000005_progress_view_and_jobs.sql'
  ];

  for (const file of migrationFiles) {
    const filePath = path.join(__dirname, '..', 'supabase', 'migrations', file);
    await db.exec(fs.readFileSync(filePath, 'utf8'));
  }

  // 2. Setup Tenants and Users
  const instA = 'a0000000-0000-0000-0000-000000000001';
  const instB = 'a0000000-0000-0000-0000-000000000002';
  const adminA = 'b0000000-0000-0000-0000-000000000001';
  const orgA = 'b0000000-0000-0000-0000-000000000002';
  const orgB = 'b0000000-0000-0000-0000-000000000003';
  const juryA = 'b0000000-0000-0000-0000-000000000004';
  const eventA = 'e0000000-0000-0000-0000-000000000001';

  await db.exec(`
    INSERT INTO public.institutions (id, name, slug, domain, contact_email) VALUES
    ('${instA}', 'MIT Institute', 'mit', 'mit.edu', 'admin@mit.edu'),
    ('${instB}', 'Stanford Institute', 'stanford', 'stanford.edu', 'admin@stanford.edu');

    INSERT INTO auth.users (id, email) VALUES
    ('${adminA}', 'admin@mit.edu'),
    ('${orgA}', 'organizer@mit.edu'),
    ('${orgB}', 'organizer@stanford.edu'),
    ('${juryA}', 'jury@mit.edu');

    INSERT INTO public.profiles (id, institution_id, full_name, email, role, organizer_approval_status) VALUES
    ('${adminA}', '${instA}', 'MIT Admin', 'admin@mit.edu', 'institution_admin', 'approved'),
    ('${orgA}', '${instA}', 'MIT Organizer', 'organizer@mit.edu', 'user', 'pending'),
    ('${orgB}', '${instB}', 'Stanford Organizer', 'organizer@stanford.edu', 'user', 'pending'),
    ('${juryA}', '${instA}', 'Dr. Evaluator', 'jury@mit.edu', 'user', 'none');

    INSERT INTO public.events (id, institution_id, title, slug, start_date, end_date, created_by) VALUES
    ('${eventA}', '${instA}', 'MIT Hackathon 2026', 'mit-hack-2026', now(), now() + interval '2 days', '${adminA}');
  `);

  // Test Case 3.1: Institution Admin A approves Organizer A (same institution)
  await db.exec(`SELECT set_config('request.jwt.claim.sub', '${adminA}', false)`);
  await db.exec(`SELECT public.approve_organizer('${orgA}')`);

  const orgAStatus = await db.query(`SELECT organizer_approval_status FROM public.profiles WHERE id = '${orgA}'`);
  assert('Admin A successfully approved Organizer A (status=approved)', orgAStatus.rows[0].organizer_approval_status === 'approved');

  // Test Case 3.2: Institution Admin A attempts to approve Organizer B (cross-institution attack)
  let crossInstFailed = false;
  try {
    await db.exec(`SELECT public.approve_organizer('${orgB}')`);
  } catch (err) {
    crossInstFailed = true;
  }
  assert('Cross-institution approval blocked with exception', crossInstFailed);

  // Test Case 3.3: DPDP Consent capture in public.consents
  await db.exec(`SELECT set_config('request.jwt.claim.sub', '${orgA}', false)`);
  await db.exec(`
    INSERT INTO public.consents (user_id, institution_id, consent_version, consent_text, ip_address)
    VALUES ('${orgA}', '${instA}', 'v1.0-dpdp-2026', 'I agree to the audit policy', '192.168.1.50');
  `);

  const consentQuery = await db.query(`
    SELECT user_id, consent_version, ip_address FROM public.consents WHERE user_id = '${orgA}'
  `);
  assert('Consent record stored in database', consentQuery.rows.length === 1 && consentQuery.rows[0].consent_version === 'v1.0-dpdp-2026');

  // Test Case 3.4: Magic link token invite creation and redemption
  const rawInviteToken = crypto.randomBytes(32).toString('hex');
  const tokenHash = hashToken(rawInviteToken);

  await db.exec(`SELECT set_config('request.jwt.claim.sub', '${adminA}', false)`);
  await db.exec(`
    INSERT INTO public.invites (institution_id, event_id, email, role, token_hash, invited_by, expires_at)
    VALUES ('${instA}', '${eventA}', 'jury@mit.edu', 'jury', '${tokenHash}', '${adminA}', now() + interval '7 days');
  `);

  // Lookup invite by token hash
  const inviteLookup = await db.query(`
    SELECT id, role, used_at FROM public.invites WHERE token_hash = '${tokenHash}'
  `);
  assert('Invite queried by SHA-256 token hash successfully', inviteLookup.rows.length === 1 && inviteLookup.rows[0].role === 'jury');

  // Redeem invite by linking event_role
  await db.exec(`SELECT set_config('request.jwt.claim.sub', '${juryA}', false)`);
  await db.exec(`
    INSERT INTO public.event_roles (user_id, event_id, institution_id, role, status)
    VALUES ('${juryA}', '${eventA}', '${instA}', 'jury', 'active');

    UPDATE public.invites
    SET used_at = now()
    WHERE token_hash = '${tokenHash}';
  `);

  const redeemedInvite = await db.query(`SELECT used_at FROM public.invites WHERE token_hash = '${tokenHash}'`);
  assert('Invite marked as used with used_at timestamp', redeemedInvite.rows[0].used_at !== null);

  const juryRoleCheck = await db.query(`
    SELECT role, status FROM public.event_roles WHERE user_id = '${juryA}' AND event_id = '${eventA}'
  `);
  assert('Jury role activated in event_roles', juryRoleCheck.rows.length === 1 && juryRoleCheck.rows[0].status === 'active');

  console.log('\n===============================================================');
  console.log(`  MODULE 2 TEST RESULTS: ${passed} PASSED, ${failed} FAILED`);
  console.log('===============================================================\n');

  if (failed > 0) {
    process.exit(1);
  }
}

main().catch((err) => {
  console.error('Fatal error during Module 2 testing:', err);
  process.exit(1);
});
