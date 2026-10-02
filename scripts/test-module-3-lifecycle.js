// scripts/test-module-3-lifecycle.js
// Automated verification test suite for FairPitch Module 3:
// 1. Event creation in 'draft' status
// 2. Rubric 100% weight check on transition 'draft' -> 'open'
// 3. Rubric immutability freeze trigger ('open' -> 'judging')
// 4. Forward-only lifecycle state machine enforcement
// 5. Team creation and code-based roster joining
// 6. Project submissions
// 7. Jury / participant mutual exclusion triggers

const fs = require('fs');
const path = require('path');
const { PGlite } = require('@electric-sql/pglite');
const { pgcrypto } = require('@electric-sql/pglite/contrib/pgcrypto');

async function main() {
  console.log('===============================================================');
  console.log('  FAIRPITCH MODULE 3: EVENT LIFECYCLE & RUBRICS TEST SUITE');
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
  const participant1 = 'b0000000-0000-0000-0000-000000000002';
  const participant2 = 'b0000000-0000-0000-0000-000000000003';
  const juryId = 'b0000000-0000-0000-0000-000000000004';
  const eventId = 'e0000000-0000-0000-0000-000000000001';
  const teamId = 'd0000000-0000-0000-0000-000000000001';

  // Seed Institution & Users
  await db.exec(`
    INSERT INTO public.institutions (id, name, slug, contact_email)
    VALUES ('${instId}', 'Caltech Innovation', 'caltech', 'admin@caltech.edu');

    INSERT INTO auth.users (id, email) VALUES
    ('${orgId}', 'organizer@caltech.edu'),
    ('${participant1}', 'lead@team.org'),
    ('${participant2}', 'member@team.org'),
    ('${juryId}', 'jury@caltech.edu');

    INSERT INTO public.profiles (id, institution_id, full_name, email, role, organizer_approval_status) VALUES
    ('${orgId}', '${instId}', 'Dr. Event Lead', 'organizer@caltech.edu', 'user', 'approved'),
    ('${participant1}', '${instId}', 'Alice Lead', 'lead@team.org', 'user', 'none'),
    ('${participant2}', '${instId}', 'Bob Dev', 'member@team.org', 'user', 'none'),
    ('${juryId}', '${instId}', 'Prof. Evaluator', 'jury@caltech.edu', 'user', 'none');
  `);

  // -------------------------------------------------------------
  // Test Suite 1: Event Creation & Initial Draft State
  // -------------------------------------------------------------
  console.log('[Test Suite 1] Event Creation & Draft State');
  await db.exec(`SELECT set_config('request.jwt.claim.sub', '${orgId}', false)`);

  await db.exec(`
    INSERT INTO public.events (
      id, institution_id, title, slug, start_date, end_date, status, blind_mode, min_judges_per_team, created_by
    ) VALUES (
      '${eventId}', '${instId}', 'Caltech AI Sprint', 'caltech-ai-sprint', now(), now() + interval '3 days', 'draft', true, 3, '${orgId}'
    );

    INSERT INTO public.event_roles (user_id, event_id, institution_id, role, status)
    VALUES ('${orgId}', '${eventId}', '${instId}', 'organizer', 'active');
  `);

  const eventRes = await db.query(`SELECT status, blind_mode FROM public.events WHERE id = '${eventId}'`);
  assert('Event created in draft status', eventRes.rows[0].status === 'draft');
  assert('Blind mode enabled', eventRes.rows[0].blind_mode === true);
  console.log('');

  // -------------------------------------------------------------
  // Test Suite 2: Rubric 100% Weight Check on Transition
  // -------------------------------------------------------------
  console.log('[Test Suite 2] Rubric 100% Total Sum Constraint');

  // Case 2.1: Transition draft -> open without any criteria (sum = 0)
  let zeroSumFailed = false;
  try {
    await db.exec(`SELECT public.transition_event_status('${eventId}', 'open')`);
  } catch (err) {
    zeroSumFailed = true;
  }
  assert('Blocked transition when rubric sum is 0%', zeroSumFailed);

  // Case 2.2: Add criteria totaling 80% (incomplete)
  await db.exec(`
    INSERT INTO public.rubric_criteria (event_id, institution_id, name, weight, max_score, order_index) VALUES
    ('${eventId}', '${instId}', 'Innovation', 40, 10, 1),
    ('${eventId}', '${instId}', 'Execution', 40, 10, 2);
  `);

  let incompleteSumFailed = false;
  try {
    await db.exec(`SELECT public.transition_event_status('${eventId}', 'open')`);
  } catch (err) {
    incompleteSumFailed = true;
  }
  assert('Blocked transition when rubric sum is 80% (< 100%)', incompleteSumFailed);

  // Case 2.3: Add final criterion to make sum exactly 100%
  await db.exec(`
    INSERT INTO public.rubric_criteria (event_id, institution_id, name, weight, max_score, order_index) VALUES
    ('${eventId}', '${instId}', 'Pitch & Presentation', 20, 10, 3);
  `);

  await db.exec(`SELECT public.transition_event_status('${eventId}', 'open')`);
  const openEventRes = await db.query(`SELECT status FROM public.events WHERE id = '${eventId}'`);
  assert('Transition to open succeeded when rubric sum equals exactly 100%', openEventRes.rows[0].status === 'open');
  console.log('');

  // -------------------------------------------------------------
  // Test Suite 3: Rubric Immutability Freeze During Judging
  // -------------------------------------------------------------
  console.log('[Test Suite 3] Rubric Freeze Trigger (trg_freeze_rubric)');

  // Transition to judging
  await db.exec(`SELECT public.transition_event_status('${eventId}', 'judging')`);
  const judgingEventRes = await db.query(`SELECT status FROM public.events WHERE id = '${eventId}'`);
  assert('Event transitioned to judging status', judgingEventRes.rows[0].status === 'judging');

  // Attempt to insert a new criterion while in judging
  let insertDuringJudgingFailed = false;
  try {
    await db.exec(`
      INSERT INTO public.rubric_criteria (event_id, institution_id, name, weight, max_score, order_index)
      VALUES ('${eventId}', '${instId}', 'Cheating Criterion', 10, 10, 4);
    `);
  } catch (err) {
    insertDuringJudgingFailed = true;
  }
  assert('trg_freeze_rubric blocked INSERT during judging', insertDuringJudgingFailed);

  // Attempt to delete a criterion while in judging
  let deleteDuringJudgingFailed = false;
  try {
    await db.exec(`DELETE FROM public.rubric_criteria WHERE event_id = '${eventId}' AND order_index = 1;`);
  } catch (err) {
    deleteDuringJudgingFailed = true;
  }
  assert('trg_freeze_rubric blocked DELETE during judging', deleteDuringJudgingFailed);

  // Attempt to update weight while in judging
  let updateDuringJudgingFailed = false;
  try {
    await db.exec(`UPDATE public.rubric_criteria SET weight = 50 WHERE event_id = '${eventId}' AND order_index = 1;`);
  } catch (err) {
    updateDuringJudgingFailed = true;
  }
  assert('trg_freeze_rubric blocked UPDATE during judging', updateDuringJudgingFailed);
  console.log('');

  // -------------------------------------------------------------
  // Test Suite 4: Forward-Only State Machine
  // -------------------------------------------------------------
  console.log('[Test Suite 4] Forward-Only Status Transitions');

  // Attempt backward transition: judging -> open
  let backwardJudgingToOpen = false;
  try {
    await db.exec(`SELECT public.transition_event_status('${eventId}', 'open')`);
  } catch (err) {
    backwardJudgingToOpen = true;
  }
  assert('Blocked illegal backward transition (judging -> open)', backwardJudgingToOpen);

  // Transition forward to review
  await db.exec(`SELECT public.transition_event_status('${eventId}', 'review')`);
  const reviewEventRes = await db.query(`SELECT status FROM public.events WHERE id = '${eventId}'`);
  assert('Event transitioned forward to review status', reviewEventRes.rows[0].status === 'review');

  // Attempt backward transition: review -> draft
  let backwardReviewToDraft = false;
  try {
    await db.exec(`SELECT public.transition_event_status('${eventId}', 'draft')`);
  } catch (err) {
    backwardReviewToDraft = true;
  }
  assert('Blocked illegal backward transition (review -> draft)', backwardReviewToDraft);
  console.log('');

  // -------------------------------------------------------------
  // Test Suite 5: Teams, Team Codes & Member Roster
  // -------------------------------------------------------------
  console.log('[Test Suite 5] Team Creation, Code-Based Joining & Roster');

  // Alice Lead creates team
  await db.exec(`SELECT set_config('request.jwt.claim.sub', '${participant1}', false)`);
  await db.exec(`
    INSERT INTO public.teams (id, event_id, institution_id, name, team_code, tagline, track, status, created_by)
    VALUES ('${teamId}', '${eventId}', '${instId}', 'Neural Innovators', 'TEAM-9X1A', 'AI Diagnostic Imaging', 'MedTech', 'pending', '${participant1}');

    INSERT INTO public.team_members (team_id, event_id, institution_id, user_id, role)
    VALUES ('${teamId}', '${eventId}', '${instId}', '${participant1}', 'lead');

    INSERT INTO public.event_roles (user_id, event_id, institution_id, role, status)
    VALUES ('${participant1}', '${eventId}', '${instId}', 'participant', 'active');
  `);

  const teamRes = await db.query(`SELECT team_code, name, status FROM public.teams WHERE id = '${teamId}'`);
  assert('Team created with unique code TEAM-9X1A', teamRes.rows[0].team_code === 'TEAM-9X1A');

  // Bob Dev joins team via team code
  await db.exec(`SELECT set_config('request.jwt.claim.sub', '${participant2}', false)`);
  await db.exec(`
    INSERT INTO public.team_members (team_id, event_id, institution_id, user_id, role)
    VALUES ('${teamId}', '${eventId}', '${instId}', '${participant2}', 'member');

    INSERT INTO public.event_roles (user_id, event_id, institution_id, role, status)
    VALUES ('${participant2}', '${eventId}', '${instId}', 'participant', 'active');
  `);

  const rosterRes = await db.query(`SELECT count(*)::int as count FROM public.team_members WHERE team_id = '${teamId}'`);
  assert('Roster has 2 members (lead + member)', rosterRes.rows[0].count === 2);
  console.log('');

  // -------------------------------------------------------------
  // Test Suite 6: Project Submissions
  // -------------------------------------------------------------
  console.log('[Test Suite 6] Project Submission Management');

  await db.exec(`SELECT set_config('request.jwt.claim.sub', '${participant1}', false)`);
  await db.exec(`
    INSERT INTO public.submissions (team_id, event_id, institution_id, title, description, repo_url, demo_url)
    VALUES (
      '${teamId}', '${eventId}', '${instId}',
      'NeuralScan AI',
      'Real-time automated MRI lesion detection',
      'https://github.com/neural-innovators/scan',
      'https://neuralscan.vercel.app'
    );
  `);

  const subRes = await db.query(`SELECT title, repo_url FROM public.submissions WHERE team_id = '${teamId}'`);
  assert('Project submission created with repository URL', subRes.rows[0].repo_url === 'https://github.com/neural-innovators/scan');
  console.log('');

  // -------------------------------------------------------------
  // Test Suite 7: Jury / Participant Mutual Exclusion Triggers
  // -------------------------------------------------------------
  console.log('[Test Suite 7] Jury / Participant Mutual Exclusion Enforcements');

  // Case 7.1: Active team member (Alice Lead) cannot be assigned as jury in the same event
  let assignParticipantAsJuryFailed = false;
  try {
    await db.exec(`
      INSERT INTO public.event_roles (user_id, event_id, institution_id, role, status)
      VALUES ('${participant1}', '${eventId}', '${instId}', 'jury', 'active');
    `);
  } catch (err) {
    assignParticipantAsJuryFailed = true;
  }
  assert('trg_exclude_teams_from_jury blocked assigning team member as jury', assignParticipantAsJuryFailed);

  // Case 7.2: Active jury member cannot join a team in the same event
  await db.exec(`
    INSERT INTO public.event_roles (user_id, event_id, institution_id, role, status)
    VALUES ('${juryId}', '${eventId}', '${instId}', 'jury', 'active');
  `);

  let juryJoinTeamFailed = false;
  try {
    await db.exec(`
      INSERT INTO public.team_members (team_id, event_id, institution_id, user_id, role)
      VALUES ('${teamId}', '${eventId}', '${instId}', '${juryId}', 'member');
    `);
  } catch (err) {
    juryJoinTeamFailed = true;
  }
  assert('trg_exclude_jury_from_teams blocked active jury member from joining team', juryJoinTeamFailed);
  console.log('');

  console.log('===============================================================');
  console.log(`  MODULE 3 TEST RESULTS: ${passed} PASSED, ${failed} FAILED`);
  console.log('===============================================================\n');

  if (failed > 0) {
    process.exit(1);
  }
}

main().catch((err) => {
  console.error('Fatal error during Module 3 testing:', err);
  process.exit(1);
});
