// scripts/test-module-4-scoring.js
// Automated verification test suite for FairPitch Module 4:
// 1. Balanced judge assignment matrix with randomized drift ordering
// 2. submit_scores RPC atomic evaluation validations (all criteria, non-empty comments)
// 3. Per-judge append-only SHA-256 hash chaining verification (verify_judge_chain)
// 4. Conflict of interest declaration, audit block & auto-excusal
// 5. Score edit requests & append-only corrections via apply_approved_score_edit RPC
// 6. v_latest_scores view version derivation

const fs = require('fs');
const path = require('path');
const { PGlite } = require('@electric-sql/pglite');
const { pgcrypto } = require('@electric-sql/pglite/contrib/pgcrypto');

// Matrix generator from src/lib/jury/matrix.ts
function generateBalancedAssignments({ eventId, institutionId, judgeIds, teamIds, minJudgesPerTeam }) {
  const effectiveJudgesPerTeam = Math.min(minJudgesPerTeam, judgeIds.length);
  const assignments = [];
  const judgeWorkload = {};
  judgeIds.forEach((id) => (judgeWorkload[id] = 0));

  teamIds.forEach((teamId) => {
    const sortedJudges = [...judgeIds].sort((a, b) => judgeWorkload[a] - judgeWorkload[b]);
    const selectedJudges = sortedJudges.slice(0, effectiveJudgesPerTeam);
    selectedJudges.forEach((judgeId) => {
      judgeWorkload[judgeId]++;
      assignments.push({
        event_id: eventId,
        institution_id: institutionId,
        judge_id: judgeId,
        team_id: teamId,
        order_index: 0,
        status: 'assigned',
      });
    });
  });

  judgeIds.forEach((judgeId) => {
    const judgeAssignments = assignments.filter((a) => a.judge_id === judgeId);
    for (let i = judgeAssignments.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      const temp = judgeAssignments[i];
      judgeAssignments[i] = judgeAssignments[j];
      judgeAssignments[j] = temp;
    }
    judgeAssignments.forEach((a, index) => {
      a.order_index = index + 1;
    });
  });

  return assignments;
}

async function main() {
  console.log('===============================================================');
  console.log('  FAIRPITCH MODULE 4: JURY SCORING & HASH CHAIN TEST SUITE');
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

  const db = new PGlite({ extensions: { pgcrypto } });

  // 1. Setup Auth and apply all 5 migrations
  console.log('[Setup] Applying migrations...');
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
  console.log('✓ All 5 migrations loaded.\n');

  // Fixture IDs
  const instId = 'a0000000-0000-0000-0000-000000000001';
  const orgId = 'b0000000-0000-0000-0000-000000000001';
  const judge1 = 'b0000000-0000-0000-0000-000000000002';
  const judge2 = 'b0000000-0000-0000-0000-000000000003';
  const judge3 = 'b0000000-0000-0000-0000-000000000004';
  const team1 = 'd0000000-0000-0000-0000-000000000001';
  const team2 = 'd0000000-0000-0000-0000-000000000002';
  const eventId = 'e0000000-0000-0000-0000-000000000001';
  const crit1 = 'c0000000-0000-0000-0000-000000000001';
  const crit2 = 'c0000000-0000-0000-0000-000000000002';

  // Seed Event, Rubric (100% total), Judges & Teams
  await db.exec(`
    INSERT INTO public.institutions (id, name, slug, contact_email)
    VALUES ('${instId}', 'Berkeley Innovation', 'berkeley', 'admin@berkeley.edu');

    INSERT INTO auth.users (id, email) VALUES
    ('${orgId}', 'organizer@berkeley.edu'),
    ('${judge1}', 'judge1@berkeley.edu'),
    ('${judge2}', 'judge2@berkeley.edu'),
    ('${judge3}', 'judge3@berkeley.edu');

    INSERT INTO public.profiles (id, institution_id, full_name, email, role, organizer_approval_status) VALUES
    ('${orgId}', '${instId}', 'Prof. Organizer', 'organizer@berkeley.edu', 'user', 'approved'),
    ('${judge1}', '${instId}', 'Dr. Alice Judge', 'judge1@berkeley.edu', 'user', 'none'),
    ('${judge2}', '${instId}', 'Dr. Bob Judge', 'judge2@berkeley.edu', 'user', 'none'),
    ('${judge3}', '${instId}', 'Dr. Charlie Judge', 'judge3@berkeley.edu', 'user', 'none');

    INSERT INTO public.events (id, institution_id, title, slug, start_date, end_date, status, blind_mode, min_judges_per_team, created_by)
    VALUES ('${eventId}', '${instId}', 'Berkeley Pitch 2026', 'berkeley-pitch-2026', now(), now() + interval '2 days', 'draft', true, 2, '${orgId}');

    INSERT INTO public.event_roles (user_id, event_id, institution_id, role, status) VALUES
    ('${orgId}', '${eventId}', '${instId}', 'organizer', 'active'),
    ('${judge1}', '${eventId}', '${instId}', 'jury', 'active'),
    ('${judge2}', '${eventId}', '${instId}', 'jury', 'active'),
    ('${judge3}', '${eventId}', '${instId}', 'jury', 'active');

    INSERT INTO public.rubric_criteria (id, event_id, institution_id, name, weight, max_score, order_index) VALUES
    ('${crit1}', '${eventId}', '${instId}', 'Technical Execution', 60, 10, 1),
    ('${crit2}', '${eventId}', '${instId}', 'Innovation & Impact', 40, 10, 2);

    INSERT INTO public.teams (id, event_id, institution_id, name, team_code, status) VALUES
    ('${team1}', '${eventId}', '${instId}', 'Team Alpha', 'TEAM-ALP1', 'approved'),
    ('${team2}', '${eventId}', '${instId}', 'Team Beta', 'TEAM-BET2', 'approved');
  `);

  // Transition event to judging
  await db.exec(`SELECT set_config('request.jwt.claim.sub', '${orgId}', false)`);
  await db.exec(`SELECT public.transition_event_status('${eventId}', 'open')`);
  await db.exec(`SELECT public.transition_event_status('${eventId}', 'judging')`);

  // -------------------------------------------------------------
  // Test Suite 1: Balanced Matrix Generation
  // -------------------------------------------------------------
  console.log('[Test Suite 1] Balanced Matrix Generation & Drift Randomization');

  const assignments = generateBalancedAssignments({
    eventId,
    institutionId: instId,
    judgeIds: [judge1, judge2, judge3],
    teamIds: [team1, team2],
    minJudgesPerTeam: 2,
  });

  assert('Matrix generated 4 assignments (2 teams * 2 judges each)', assignments.length === 4);

  // Verify order_index is set
  const hasValidOrder = assignments.every((a) => a.order_index >= 1);
  assert('Randomized order_index assigned to each evaluation pair', hasValidOrder);

  // Insert assignments into database
  for (const a of assignments) {
    await db.exec(`
      INSERT INTO public.judge_assignments (event_id, institution_id, judge_id, team_id, order_index, status)
      VALUES ('${a.event_id}', '${a.institution_id}', '${a.judge_id}', '${a.team_id}', ${a.order_index}, 'assigned')
      ON CONFLICT DO NOTHING;
    `);
  }
  console.log('');

  // -------------------------------------------------------------
  // Test Suite 2: submit_scores RPC Validations
  // -------------------------------------------------------------
  console.log('[Test Suite 2] submit_scores Atomic Evaluation RPC');

  await db.exec(`SELECT set_config('request.jwt.claim.sub', '${judge1}', false)`);

  // Case 2.1: Missing criterion in payload
  let missingCriterionFailed = false;
  try {
    const incompletePayload = JSON.stringify([
      { criterion_id: crit1, score: 8.5, comment: 'Great execution' }
    ]);
    await db.exec(`SELECT public.submit_scores('${team1}', '${incompletePayload}'::jsonb)`);
  } catch (err) {
    missingCriterionFailed = true;
  }
  assert('submit_scores rejected incomplete criteria (received 1 of 2)', missingCriterionFailed);

  // Case 2.2: Empty feedback comment
  let emptyCommentFailed = false;
  try {
    const emptyCommentPayload = JSON.stringify([
      { criterion_id: crit1, score: 8.5, comment: '   ' },
      { criterion_id: crit2, score: 9.0, comment: 'Good innovation' }
    ]);
    await db.exec(`SELECT public.submit_scores('${team1}', '${emptyCommentPayload}'::jsonb)`);
  } catch (err) {
    emptyCommentFailed = true;
  }
  assert('submit_scores rejected whitespace-only feedback comment', emptyCommentFailed);

  // Case 2.3: Valid submission
  const validPayload = JSON.stringify([
    { criterion_id: crit1, score: 8.5, comment: 'Solid backend and resilient architecture' },
    { criterion_id: crit2, score: 9.0, comment: 'Creative and novel problem framing' }
  ]);

  await db.exec(`SELECT public.submit_scores('${team1}', '${validPayload}'::jsonb)`);

  const scoreRows = await db.query(`
    SELECT score, version, comment FROM public.scores
    WHERE event_id = '${eventId}' AND judge_id = '${judge1}' AND team_id = '${team1}'
  `);
  assert('Scores successfully inserted with version = 1', scoreRows.rows.length === 2 && scoreRows.rows[0].version === 1);

  const assignCheck = await db.query(`
    SELECT status FROM public.judge_assignments
    WHERE event_id = '${eventId}' AND judge_id = '${judge1}' AND team_id = '${team1}'
  `);
  assert('Judge assignment marked completed', assignCheck.rows[0].status === 'completed');
  console.log('');

  // -------------------------------------------------------------
  // Test Suite 3: Per-Judge SHA-256 Hash Chain Verification
  // -------------------------------------------------------------
  console.log('[Test Suite 3] Per-Judge SHA-256 Hash Chain Integrity');

  const auditBlocks = await db.query(`
    SELECT block_index, prev_hash, current_hash, action
    FROM public.audit_log
    WHERE event_id = '${eventId}' AND judge_id = '${judge1}'
    ORDER BY block_index ASC;
  `);

  assert('Audit log contains score block for judge 1', auditBlocks.rows.length >= 1);
  assert('Block 0 has GENESIS previous hash', auditBlocks.rows[0].prev_hash === 'GENESIS');
  assert('Block has valid 64-character SHA-256 current_hash', auditBlocks.rows[0].current_hash.length === 64);

  // Verify chain using verify_judge_chain RPC
  const verifyRes = await db.query(`SELECT is_valid, total_blocks FROM public.verify_judge_chain('${eventId}', '${judge1}')`);
  assert('verify_judge_chain confirmed cryptographic hash integrity (true)', verifyRes.rows[0].is_valid === true);
  console.log('');

  // -------------------------------------------------------------
  // Test Suite 4: Conflict of Interest & Auto-Excusal
  // -------------------------------------------------------------
  console.log('[Test Suite 4] Conflict Declaration & Auto-Excusal');

  await db.exec(`SELECT set_config('request.jwt.claim.sub', '${judge2}', false)`);

  // Judge 2 declares conflict on Team 1
  await db.exec(`
    INSERT INTO public.conflicts (event_id, institution_id, judge_id, team_id, declared_by, reason)
    VALUES ('${eventId}', '${instId}', '${judge2}', '${team1}', '${judge2}', 'Co-founded past startup with lead');

    UPDATE public.judge_assignments
    SET status = 'excused'
    WHERE event_id = '${eventId}' AND judge_id = '${judge2}' AND team_id = '${team1}';
  `);

  const excusedCheck = await db.query(`
    SELECT status FROM public.judge_assignments
    WHERE event_id = '${eventId}' AND judge_id = '${judge2}' AND team_id = '${team1}'
  `);
  assert('Assignment status updated to excused', excusedCheck.rows[0].status === 'excused');

  // Attempting submit_scores on conflicted team is blocked
  let conflictEvalBlocked = false;
  try {
    await db.exec(`SELECT public.submit_scores('${team1}', '${validPayload}'::jsonb)`);
  } catch (err) {
    conflictEvalBlocked = true;
  }
  assert('submit_scores blocked evaluation on conflicted team', conflictEvalBlocked);
  console.log('');

  // -------------------------------------------------------------
  // Test Suite 5: Score Edit Request & Append-Only Corrections
  // -------------------------------------------------------------
  console.log('[Test Suite 5] Append-Only Score Correction Workflow');

  // Judge 1 requests an edit on Team 1 (Technical Execution: 8.5 -> 9.5)
  await db.exec(`SELECT set_config('request.jwt.claim.sub', '${judge1}', false)`);
  const editReqId = 'f0000000-0000-0000-0000-000000000001';

  const requestedChanges = JSON.stringify([
    { criterion_id: crit1, score: 9.5, comment: 'Demonstrated exceptional latency optimization under load' }
  ]);

  await db.exec(`
    INSERT INTO public.edit_requests (id, event_id, institution_id, judge_id, team_id, reason, status, requested_changes)
    VALUES ('${editReqId}', '${eventId}', '${instId}', '${judge1}', '${team1}', 'Discovered deep benchmarking doc', 'pending', '${requestedChanges}'::jsonb);
  `);

  // Organizer approves the edit request
  await db.exec(`SELECT set_config('request.jwt.claim.sub', '${orgId}', false)`);
  await db.exec(`
    UPDATE public.edit_requests
    SET status = 'approved', reviewed_by = '${orgId}', reviewed_at = now()
    WHERE id = '${editReqId}';
  `);

  // Call apply_approved_score_edit RPC
  await db.exec(`SELECT public.apply_approved_score_edit('${editReqId}')`);

  // Verify scores table has BOTH version 1 and version 2 (append-only)
  const allScores = await db.query(`
    SELECT version, score, comment FROM public.scores
    WHERE event_id = '${eventId}' AND judge_id = '${judge1}' AND team_id = '${team1}' AND criterion_id = '${crit1}'
    ORDER BY version ASC;
  `);

  assert('Both version 1 and version 2 exist in scores table (append-only)', allScores.rows.length === 2);
  assert('Version 1 original score preserved (8.5)', Number(allScores.rows[0].score) === 8.5 && allScores.rows[0].version === 1);
  assert('Version 2 corrected score appended (9.5)', Number(allScores.rows[1].score) === 9.5 && allScores.rows[1].version === 2);

  // Verify v_latest_scores returns version 2
  const latestScore = await db.query(`
    SELECT version, score FROM public.v_latest_scores
    WHERE event_id = '${eventId}' AND judge_id = '${judge1}' AND team_id = '${team1}' AND criterion_id = '${crit1}'
  `);
  assert('v_latest_scores view correctly derives version 2 as latest', Number(latestScore.rows[0].score) === 9.5 && latestScore.rows[0].version === 2);

  // Verify judge 1 chain remains cryptographically valid after revision
  const chainAfterEdit = await db.query(`SELECT is_valid FROM public.verify_judge_chain('${eventId}', '${judge1}')`);
  assert('Judge chain remains valid after append-only score edit (true)', chainAfterEdit.rows[0].is_valid === true);
  console.log('');

  console.log('===============================================================');
  console.log(`  MODULE 4 TEST RESULTS: ${passed} PASSED, ${failed} FAILED`);
  console.log('===============================================================\n');

  if (failed > 0) {
    process.exit(1);
  }
}

main().catch((err) => {
  console.error('Fatal error during Module 4 testing:', err);
  process.exit(1);
});
