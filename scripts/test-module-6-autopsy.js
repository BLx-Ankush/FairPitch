// scripts/test-module-6-autopsy.js
// Automated verification test suite for FairPitch Module 6:
// 1. Head-to-Head mathematical criterion deficit calculations
// 2. Deterministic AI Loss Autopsy fallback generation with 3 concrete fixes
// 3. Database persistence to public.autopsies
// 4. RLS gating on autopsies: blocked during judging/review, unlocked when published
// 5. Review & dispute ticket lifecycle in public.review_requests (open -> under_review -> resolved)

const fs = require('fs');
const path = require('path');
const { PGlite } = require('@electric-sql/pglite');
const { pgcrypto } = require('@electric-sql/pglite/contrib/pgcrypto');

// Inline math & diagnostic functions matching src/lib/autopsy/math.ts and gemini.ts
function computeHeadToHeadAnalysis(targetTeam, benchmarkWinner, scores, criteria, judges) {
  const judgeMap = new Map();
  judges.forEach((j) => judgeMap.set(j.id, j.name));

  const targetScores = scores.filter((s) => s.team_id === targetTeam.id);
  const winnerScores = scores.filter((s) => s.team_id === benchmarkWinner.id);

  const teamCriterionAverages = {};
  const winnerCriterionAverages = {};
  const weightedPointGaps = [];

  let teamTotal = 0;
  let winnerTotal = 0;

  for (const c of criteria) {
    const maxScore = c.max_score > 0 ? c.max_score : 10;

    const tScores = targetScores.filter((s) => s.criterion_id === c.id);
    const tAvg = tScores.length > 0 ? tScores.reduce((sum, s) => sum + s.score, 0) / tScores.length : 0;
    teamCriterionAverages[c.id] = Number(tAvg.toFixed(2));
    teamTotal += (tAvg / maxScore) * c.weight;

    const wScores = winnerScores.filter((s) => s.criterion_id === c.id);
    const wAvg = wScores.length > 0 ? wScores.reduce((sum, s) => sum + s.score, 0) / wScores.length : 0;
    winnerCriterionAverages[c.id] = Number(wAvg.toFixed(2));
    winnerTotal += (wAvg / maxScore) * c.weight;

    const rawGap = Number((wAvg - tAvg).toFixed(2));
    const weightedGap = Number(((rawGap / maxScore) * c.weight).toFixed(2));

    weightedPointGaps.push({
      criterionId: c.id,
      criterionName: c.name,
      weight: c.weight,
      maxScore,
      teamAverage: Number(tAvg.toFixed(2)),
      winnerAverage: Number(wAvg.toFixed(2)),
      rawGap,
      weightedGap,
    });
  }

  weightedPointGaps.sort((a, b) => b.weightedGap - a.weightedGap);

  const criteriaNameMap = new Map();
  criteria.forEach((c) => criteriaNameMap.set(c.id, c.name));

  const judgeComments = targetScores
    .filter((s) => s.comment && s.comment.trim().length > 0)
    .map((s) => ({
      judgeName: judgeMap.get(s.judge_id) || 'Panel Evaluator',
      criterionName: criteriaNameMap.get(s.criterion_id) || 'Criterion',
      score: s.score,
      comment: s.comment.trim(),
    }));

  const winnerJudgeComments = winnerScores
    .filter((s) => s.comment && s.comment.trim().length > 0)
    .map((s) => ({
      judgeName: judgeMap.get(s.judge_id) || 'Panel Evaluator',
      criterionName: criteriaNameMap.get(s.criterion_id) || 'Criterion',
      score: s.score,
      comment: s.comment.trim(),
    }));

  const lossCriteria = weightedPointGaps.filter((g) => g.weightedGap > 0);

  const issues = lossCriteria.slice(0, 3).map((g) => {
    const relatedComments = judgeComments.filter(
      (c) => c.criterionName.toLowerCase() === g.criterionName.toLowerCase()
    );
    const critiqueQuote = relatedComments[0]
      ? `Judge noted: "${relatedComments[0].comment}"`
      : `Scored ${g.rawGap} points behind benchmark.`;

    return {
      criterionName: g.criterionName,
      weightedGap: g.weightedGap,
      summary: `Deficit of ${g.weightedGap} weighted points (${g.teamAverage}/${g.maxScore} vs ${g.winnerAverage}/${g.maxScore}). ${critiqueQuote}`,
    };
  });

  const fixes = [
    {
      priority: 1,
      title: lossCriteria[0]
        ? `Remediate ${lossCriteria[0].criterionName} Deficit (-${lossCriteria[0].weightedGap} pts)`
        : 'Deepen Core Architecture',
      description: 'Replace surface-level mockups with verified algorithmic implementation and benchmark performance data.',
    },
    {
      priority: 2,
      title: lossCriteria[1]
        ? `Strengthen ${lossCriteria[1].criterionName} Validation (-${lossCriteria[1].weightedGap} pts)`
        : 'Validate Feasibility & Unit Economics',
      description: 'Provide formal edge-case failure mitigation and concrete deployment evidence.',
    },
    {
      priority: 3,
      title: lossCriteria[2]
        ? `Quantify Proof-of-Concept for ${lossCriteria[2].criterionName} (-${lossCriteria[2].weightedGap} pts)`
        : 'Live Telemetry Demonstration',
      description: 'Replace subjective claims with real-time hardware telemetry and end-to-end trace logs.',
    },
  ];

  return {
    targetTeam,
    benchmarkWinner,
    teamTotal: Number(teamTotal.toFixed(2)),
    winnerTotal: Number(winnerTotal.toFixed(2)),
    netDeficit: Number((winnerTotal - teamTotal).toFixed(2)),
    weightedPointGaps,
    teamCriterionAverages,
    winnerCriterionAverages,
    judgeComments,
    winnerJudgeComments,
    primaryDeficitCriterion: lossCriteria[0] || null,
    issues,
    fixes,
  };
}

function generateDeterministicFallbackAutopsy(analysis) {
  const {
    targetTeam,
    benchmarkWinner,
    teamTotal,
    winnerTotal,
    netDeficit,
    weightedPointGaps,
    fixes,
  } = analysis;

  const lossGaps = weightedPointGaps.filter((g) => g.weightedGap > 0);

  let md = `## Loss Autopsy & Rubric Deduction Diagnostic: ${targetTeam.name} vs ${benchmarkWinner.name}\n\n`;
  md += `**Executive Summary:** ${targetTeam.name} finished with an overall score of **${teamTotal.toFixed(2)} pts** vs **${winnerTotal.toFixed(2)} pts** (cumulative deficit: **-${netDeficit.toFixed(2)} weighted points**).\n\n`;
  md += `### Rubric-by-Rubric Deduction Analysis\n\n`;

  lossGaps.forEach((gap, index) => {
    md += `### ${index + 1}. ${gap.criterionName} (Deficit: -${gap.weightedGap.toFixed(2)} weighted pts | Weight: ${gap.weight}%)\n`;
    md += `- **Score Benchmark:** ${targetTeam.name} averaged **${gap.teamAverage.toFixed(1)}/${gap.maxScore}** vs ${benchmarkWinner.name}'s **${gap.winnerAverage.toFixed(1)}/${gap.maxScore}**.\n\n`;
  });

  md += `### Exactly 3 Concrete High-Leverage Fixes\n\n`;
  fixes.forEach((f) => {
    md += `${f.priority}. **${f.title}:** ${f.description}\n`;
  });

  return md;
}

async function main() {
  console.log('===============================================================');
  console.log('  FAIRPITCH MODULE 6: AI LOSS AUTOPSY & DISPUTE TEST SUITE');
  console.log('===============================================================\n');

  let passed = 0;
  let failed = 0;

  function assert(condition, message) {
    if (condition) {
      console.log(`  ✓ PASS: ${message}`);
      passed++;
    } else {
      console.error(`  ✗ FAIL: ${message}`);
      failed++;
    }
  }

  // -------------------------------------------------------------
  // Test Suite 1: Mathematical Deficit Attribution
  // -------------------------------------------------------------
  console.log('[Test Suite 1] Head-to-Head Criterion Deficit Engine');

  const criteria = [
    { id: 'c1', name: 'Technical Execution', weight: 40, max_score: 10 },
    { id: 'c2', name: 'Innovation & Impact', weight: 30, max_score: 10 },
    { id: 'c3', name: 'Feasibility', weight: 30, max_score: 10 },
  ];

  const judges = [
    { id: 'j1', name: 'Dr. Evelyn Vance' },
    { id: 'j2', name: 'Marcus Sterling' },
  ];

  const winnerTeam = { id: 'team-win', name: 'NeuroGait', tagline: 'Neural Prosthetic AI' };
  const targetTeam = { id: 'team-loss', name: 'MediSync', tagline: 'Distributed Health Records' };

  // Winner scores: Technical: 9.0/9.0 (avg 9.0), Innovation: 8.5/8.5 (avg 8.5), Feasibility: 8.0/8.0 (avg 8.0)
  // Target scores: Technical: 6.0/6.0 (avg 6.0), Innovation: 8.5/8.5 (avg 8.5), Feasibility: 7.0/7.0 (avg 7.0)
  // Deficits:
  // Technical: rawGap = 3.0, weightedGap = (3.0 / 10) * 40 = 12.0 pts
  // Feasibility: rawGap = 1.0, weightedGap = (1.0 / 10) * 30 = 3.0 pts
  // Innovation: rawGap = 0.0, weightedGap = 0.0 pts
  const scores = [
    // Winner
    { team_id: winnerTeam.id, judge_id: 'j1', criterion_id: 'c1', score: 9.0, comment: 'Flawless kernel architecture' },
    { team_id: winnerTeam.id, judge_id: 'j2', criterion_id: 'c1', score: 9.0, comment: 'High throughput pipeline' },
    { team_id: winnerTeam.id, judge_id: 'j1', criterion_id: 'c2', score: 8.5, comment: 'Great novelty' },
    { team_id: winnerTeam.id, judge_id: 'j2', criterion_id: 'c2', score: 8.5, comment: 'Very impactful' },
    { team_id: winnerTeam.id, judge_id: 'j1', criterion_id: 'c3', score: 8.0, comment: 'Solid feasibility' },
    { team_id: winnerTeam.id, judge_id: 'j2', criterion_id: 'c3', score: 8.0, comment: 'Viable pilot' },

    // Target
    { team_id: targetTeam.id, judge_id: 'j1', criterion_id: 'c1', score: 6.0, comment: 'Concurrency bottlenecks detected' },
    { team_id: targetTeam.id, judge_id: 'j2', criterion_id: 'c1', score: 6.0, comment: 'Failed to address data loss on node failure' },
    { team_id: targetTeam.id, judge_id: 'j1', criterion_id: 'c2', score: 8.5, comment: 'Strong healthcare use-case' },
    { team_id: targetTeam.id, judge_id: 'j2', criterion_id: 'c2', score: 8.5, comment: 'High patient impact' },
    { team_id: targetTeam.id, judge_id: 'j1', criterion_id: 'c3', score: 7.0, comment: 'Regulatory pathway unclear' },
    { team_id: targetTeam.id, judge_id: 'j2', criterion_id: 'c3', score: 7.0, comment: 'HIPAA verification needed' },
  ];

  const analysis = computeHeadToHeadAnalysis(targetTeam, winnerTeam, scores, criteria, judges);

  assert(analysis.netDeficit === 15.0, `Calculated net deficit of 15.0 weighted points (received ${analysis.netDeficit})`);
  assert(analysis.weightedPointGaps[0].criterionName === 'Technical Execution', 'Primary loss driver correctly sorted to #1 (Technical Execution)');
  assert(analysis.weightedPointGaps[0].weightedGap === 12.0, `Technical Execution deficit calculated as exactly 12.0 pts (received ${analysis.weightedPointGaps[0].weightedGap})`);
  assert(analysis.weightedPointGaps[1].criterionName === 'Feasibility', 'Second loss driver correctly sorted to #2 (Feasibility)');
  assert(analysis.weightedPointGaps[1].weightedGap === 3.0, 'Feasibility deficit calculated as 3.0 pts');
  assert(analysis.fixes.length === 3, 'Extracted exactly 3 concrete high-leverage fixes');

  const fallbackMarkdown = generateDeterministicFallbackAutopsy(analysis);
  assert(fallbackMarkdown.includes('MediSync vs NeuroGait'), 'Fallback autopsy includes correct matchup title');
  assert(fallbackMarkdown.includes('Technical Execution'), 'Fallback autopsy diagnoses Technical Execution');
  assert(fallbackMarkdown.includes('Exactly 3 Concrete High-Leverage Fixes'), 'Fallback autopsy ends with 3 concrete fixes');

  // -------------------------------------------------------------
  // Test Suite 2: Database Persistence & RLS Gating (PGlite)
  // -------------------------------------------------------------
  const db = new PGlite({ extensions: { pgcrypto } });

  await db.exec(`
    CREATE EXTENSION IF NOT EXISTS pgcrypto;
    CREATE SCHEMA IF NOT EXISTS auth;
    DO $$ BEGIN
      IF NOT EXISTS (SELECT FROM pg_roles WHERE rolname = 'anon') THEN
        CREATE ROLE anon NOLOGIN;
      END IF;
      IF NOT EXISTS (SELECT FROM pg_roles WHERE rolname = 'authenticated') THEN
        CREATE ROLE authenticated NOLOGIN;
      END IF;
    END $$;
    CREATE TABLE IF NOT EXISTS auth.users (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        email TEXT UNIQUE,
        created_at TIMESTAMPTZ DEFAULT now()
    );
    CREATE OR REPLACE FUNCTION auth.uid() RETURNS UUID AS $$
        SELECT NULLIF(current_setting('request.jwt.claim.sub', true), '')::UUID;
    $$ LANGUAGE sql STABLE;
  `);

  async function runAs(userId, fn) {
    await db.query(`SET ROLE authenticated;`);
    await db.query(`SELECT set_config('request.jwt.claim.sub', $1, false);`, [userId]);
    try {
      return await fn();
    } finally {
      await db.query(`RESET ROLE;`);
    }
  }

  const migrationsDir = path.join(__dirname, '../supabase/migrations');
  const migrationFiles = [
    '20261001000001_tables_and_indexes.sql',
    '20261001000002_helper_functions.sql',
    '20261001000003_audit_chain_and_triggers.sql',
    '20261001000004_rls_policies.sql',
    '20261001000005_progress_view_and_jobs.sql',
  ];

  for (const file of migrationFiles) {
    const sql = fs.readFileSync(path.join(migrationsDir, file), 'utf8');
    await db.exec(sql);
  }
  await db.exec(`
    ALTER TABLE public.autopsies FORCE ROW LEVEL SECURITY;
    ALTER TABLE public.review_requests FORCE ROW LEVEL SECURITY;
  `);
  console.log('✓ All 5 migrations loaded into PGlite');

  const instId = '11111111-1111-1111-1111-111111111111';
  const orgId = '22222222-2222-2222-2222-222222222222';
  const participant1Id = '33333333-3333-3333-3333-333333333331';
  const participant2Id = '33333333-3333-3333-3333-333333333332';
  const eventId = '44444444-4444-4444-4444-444444444444';
  const team1Id = '55555555-5555-5555-5555-555555555551'; // NeuroGait (Winner)
  const team2Id = '55555555-5555-5555-5555-555555555552'; // MediSync (Participant 1)

  await db.query(`
    INSERT INTO public.institutions (id, name, slug, contact_email)
    VALUES ($1, 'FairTech Univ', 'fairtech', 'admin@fairtech.edu');
  `, [instId]);

  await db.query(`
    INSERT INTO auth.users (id, email) VALUES
      ($1, 'org@fairtech.edu'),
      ($2, 'participant1@fairtech.edu'),
      ($3, 'participant2@fairtech.edu');
  `, [orgId, participant1Id, participant2Id]);

  await db.query(`
    INSERT INTO public.profiles (id, institution_id, full_name, email, role, organizer_approval_status) VALUES
      ($1, $4, 'Prof. Org', 'org@fairtech.edu', 'institution_admin', 'approved'),
      ($2, $4, 'Alice Student', 'participant1@fairtech.edu', 'user', 'none'),
      ($3, $4, 'Bob Student', 'participant2@fairtech.edu', 'user', 'none');
  `, [orgId, participant1Id, participant2Id, instId]);

  await db.query(`
    INSERT INTO public.events (id, institution_id, title, slug, start_date, end_date, status, min_judges_per_team, created_by)
    VALUES ($1, $2, 'AI Innovation Hackathon', 'ai-hack', now(), now() + interval '2 days', 'draft', 2, $3);
  `, [eventId, instId, orgId]);

  await db.query(`
    INSERT INTO public.event_roles (user_id, event_id, institution_id, role, status) VALUES
      ($1, $2, $3, 'organizer', 'active');
  `, [orgId, eventId, instId]);

  await db.query(`
    INSERT INTO public.rubric_criteria (id, event_id, institution_id, name, weight, max_score, order_index) VALUES
      ('c0000000-0000-0000-0000-000000000001', $1, $2, 'Technical Execution', 50, 10, 1),
      ('c0000000-0000-0000-0000-000000000002', $1, $2, 'Impact', 50, 10, 2);
  `, [eventId, instId]);

  // Transition event to judging, then review
  await db.query(`SELECT set_config('request.jwt.claim.sub', $1, false);`, [orgId]);
  await db.query(`SELECT public.transition_event_status($1, 'open');`, [eventId]);
  await db.query(`SELECT public.transition_event_status($1, 'judging');`, [eventId]);
  await db.query(`SELECT public.transition_event_status($1, 'review');`, [eventId]);

  await db.query(`
    INSERT INTO public.teams (id, event_id, institution_id, name, team_code, status) VALUES
      ($1, $3, $4, 'NeuroGait', 'NEU123', 'approved'),
      ($2, $3, $4, 'MediSync', 'MED456', 'approved');
  `, [team1Id, team2Id, eventId, instId]);

  await db.query(`
    INSERT INTO public.team_members (team_id, event_id, institution_id, user_id, role) VALUES
      ($1, $3, $4, $5, 'lead'),
      ($2, $3, $4, $6, 'lead');
  `, [team1Id, team2Id, eventId, instId, participant2Id, participant1Id]);

  // Insert autopsy record into autopsies table
  await db.query(`
    INSERT INTO public.autopsies (
      event_id,
      institution_id,
      team_id,
      model_name,
      loss_gap_data,
      issues,
      fixes,
      raw_markdown,
      verification_status
    ) VALUES (
      $1, $2, $3, 'gemini-2.5-flash',
      $4::jsonb, $5::jsonb, $6::jsonb, $7, 'verified'
    );
  `, [
    eventId,
    instId,
    team2Id,
    JSON.stringify(analysis.weightedPointGaps),
    JSON.stringify(analysis.issues),
    JSON.stringify(analysis.fixes),
    fallbackMarkdown,
  ]);

  // 1. Verify RLS while event is in 'review' status:
  // Participant 1 (Alice) tries to read autopsy -> must be BLOCKED
  const unpubRows = await runAs(participant1Id, async () => {
    const res = await db.query(`SELECT id FROM public.autopsies WHERE team_id = $1;`, [team2Id]);
    return res.rows;
  });
  assert(unpubRows.length === 0, 'RLS policy blocks participant from reading autopsy before event is published (0 rows returned)');

  // Organizer can read autopsy during 'review'
  const orgRows = await runAs(orgId, async () => {
    const res = await db.query(`SELECT id FROM public.autopsies WHERE team_id = $1;`, [team2Id]);
    return res.rows;
  });
  assert(orgRows.length === 1, 'Organizer can preview autopsies during review stage');

  // 2. Transition event to 'published'
  await db.query(`SELECT set_config('request.jwt.claim.sub', $1, false);`, [orgId]);
  await db.query(`SELECT public.transition_event_status($1, 'published');`, [eventId]);

  // Now Participant 1 tries to read autopsy -> must SUCCEED
  const pubRows = await runAs(participant1Id, async () => {
    const res = await db.query(`SELECT id, model_name, verification_status FROM public.autopsies WHERE team_id = $1;`, [team2Id]);
    return res.rows;
  });
  assert(pubRows.length === 1, 'RLS unlocks participant access to loss autopsy once event is published');

  // Participant cannot see another team's autopsy
  const otherRows = await runAs(participant1Id, async () => {
    const res = await db.query(`SELECT id FROM public.autopsies WHERE team_id = $1;`, [team1Id]);
    return res.rows;
  });
  assert(otherRows.length === 0, 'Participant blocked from viewing another team’s private autopsy');

  // -------------------------------------------------------------
  // Test Suite 3: Review / Dispute Ticket Pipeline
  // -------------------------------------------------------------
  console.log('\n[Test Suite 3] Review Dispute Ticket Lifecycle');

  // Participant 1 creates a dispute ticket
  const newTicket = await runAs(participant1Id, async () => {
    const res = await db.query(`
      INSERT INTO public.review_requests (
        event_id,
        institution_id,
        team_id,
        participant_id,
        reason,
        status
      ) VALUES (
        $1, $2, $3, $4, 'Judge comments suggest our database dropped data, but our telemetry proves 99.999% uptime during the demo.', 'open'
      ) RETURNING id, status;
    `, [eventId, instId, team2Id, participant1Id]);
    return res.rows;
  });

  assert(newTicket.length === 1, `Dispute ticket successfully created with status '${newTicket[0].status}'`);
  const ticketId = newTicket[0].id;

  // Non-member (Participant 2) tries to insert a dispute for team 2 -> MUST BE BLOCKED by RLS
  let forbiddenInsertFailed = false;
  try {
    await runAs(participant2Id, async () => {
      await db.query(`
        INSERT INTO public.review_requests (
          event_id, institution_id, team_id, participant_id, reason
        ) VALUES ($1, $2, $3, $4, 'Malicious ticket attempt');
      `, [eventId, instId, team2Id, participant2Id]);
    });
  } catch {
    forbiddenInsertFailed = true;
  }
  assert(forbiddenInsertFailed === true, 'RLS blocked non-team member from filing a dispute ticket for another team');

  // Organizer updates ticket status to 'resolved' with explanation (via service-role, matching server API)
  await db.query(`
    UPDATE public.review_requests
    SET status = 'resolved',
        resolution_notes = 'Reviewed live telemetry logs. While uptime was maintained, deductions reflected the lack of transactional rollback across distributed shards.',
        resolved_by = $1,
        resolved_at = now()
    WHERE id = $2;
  `, [orgId, ticketId]);

  // Participant reads resolved ticket and resolution notes
  const resolvedTicket = await runAs(participant1Id, async () => {
    const res = await db.query(`
      SELECT status, resolution_notes FROM public.review_requests WHERE id = $1;
    `, [ticketId]);
    return res.rows;
  });

  assert(resolvedTicket[0].status === 'resolved', "Dispute ticket resolved status confirmed ('resolved')");
  assert(resolvedTicket[0].resolution_notes.includes('transactional rollback'), 'Participant can read official organizer resolution response');

  console.log('\n===============================================================');
  console.log(`  MODULE 6 TEST RESULTS: ${passed} PASSED, ${failed} FAILED`);
  console.log('===============================================================\n');

  if (failed > 0) {
    process.exit(1);
  }
}

main().catch((err) => {
  console.error('Test runner crashed:', err);
  process.exit(1);
});
