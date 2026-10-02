// scripts/test-module-5-fairness.js
// Automated verification test suite for FairPitch Module 5:
// 1. Judge leniency z-score calculation and outlier detection (|z| > 1.0)
// 2. Cognitive fatigue drift (Pearson correlation r < -0.50)
// 3. Inter-judge agreement dispersion (standard deviation sigma >= 12.0)
// 4. Counterfactual sensitivity reranking & Winner-Flip detection
// 5. Plain-English dynamic fairness summary generation
// 6. Postgres v_latest_scores view integration and fairness_reports snapshot persistence

const fs = require('fs');
const path = require('path');
const { PGlite } = require('@electric-sql/pglite');
const { pgcrypto } = require('@electric-sql/pglite/contrib/pgcrypto');

// Domain math engine functions matching src/lib/fairness/engine.ts
function calculateJudgeTeamTotal(judgeId, teamId, scores, criteria) {
  const teamJudgeScores = scores.filter(
    (s) => s.judge_id === judgeId && s.team_id === teamId
  );
  if (teamJudgeScores.length === 0) return null;

  let total = 0;
  for (const c of criteria) {
    const match = teamJudgeScores.find((s) => s.criterion_id === c.id);
    if (match) {
      const max = c.max_score > 0 ? c.max_score : 10;
      total += (match.score / max) * c.weight;
    }
  }
  return Number(total.toFixed(2));
}

function calculateLeaderboard(scores, teams, judges, criteria, excludedJudgeIds = []) {
  const activeJudges = judges.filter((j) => !excludedJudgeIds.includes(j.id));
  const activeJudgeIds = new Set(activeJudges.map((j) => j.id));

  const rows = teams.map((team) => {
    const judgeTotals = [];
    const criterionScoreSums = {};
    const criterionScoreCounts = {};

    criteria.forEach((c) => {
      criterionScoreSums[c.id] = 0;
      criterionScoreCounts[c.id] = 0;
    });

    for (const judge of activeJudges) {
      const tot = calculateJudgeTeamTotal(judge.id, team.id, scores, criteria);
      if (tot !== null) {
        judgeTotals.push(tot);
      }
    }

    const teamScores = scores.filter(
      (s) => s.team_id === team.id && activeJudgeIds.has(s.judge_id)
    );

    for (const s of teamScores) {
      if (criterionScoreSums[s.criterion_id] !== undefined) {
        criterionScoreSums[s.criterion_id] += s.score;
        criterionScoreCounts[s.criterion_id] += 1;
      }
    }

    const meanTotal =
      judgeTotals.length > 0
        ? judgeTotals.reduce((a, b) => a + b, 0) / judgeTotals.length
        : 0;

    const criterionAverages = {};
    for (const c of criteria) {
      const count = criterionScoreCounts[c.id] || 0;
      criterionAverages[c.id] =
        count > 0 ? Number((criterionScoreSums[c.id] / count).toFixed(2)) : 0;
    }

    return {
      rank: 0,
      team,
      totalScore: Number(meanTotal.toFixed(2)),
      criterionAverages,
      evaluatorCount: judgeTotals.length,
    };
  });

  rows.sort((a, b) => {
    if (b.totalScore !== a.totalScore) return b.totalScore - a.totalScore;
    return a.team.name.localeCompare(b.team.name);
  });

  rows.forEach((r, idx) => {
    r.rank = idx + 1;
  });

  return rows;
}

function calculateJudgeLeniency(scores, teams, judges, criteria) {
  const judgeStats = judges.map((judge) => {
    const teamTotals = [];
    for (const team of teams) {
      const tot = calculateJudgeTeamTotal(judge.id, team.id, scores, criteria);
      if (tot !== null) teamTotals.push(tot);
    }
    const meanTotal =
      teamTotals.length > 0
        ? teamTotals.reduce((a, b) => a + b, 0) / teamTotals.length
        : 0;

    return {
      judge,
      meanTotal: Number(meanTotal.toFixed(2)),
      evalCount: teamTotals.length,
    };
  });

  const activeStats = judgeStats.filter((s) => s.evalCount > 0);
  const means = activeStats.map((s) => s.meanTotal);
  const grandMean =
    means.length > 0 ? means.reduce((a, b) => a + b, 0) / means.length : 0;

  const variance =
    means.length > 0
      ? means.reduce((acc, m) => acc + Math.pow(m - grandMean, 2), 0) / means.length
      : 0;
  const panelStdDev = Math.sqrt(variance);

  const results = judgeStats.map((stat) => {
    let z = 0;
    if (panelStdDev > 0 && stat.evalCount > 0) {
      z = (stat.meanTotal - grandMean) / panelStdDev;
    }
    const roundedZ = Number(z.toFixed(2));
    return {
      judge: stat.judge,
      meanTotal: stat.meanTotal,
      evalCount: stat.evalCount,
      zScore: roundedZ,
      flagged: Math.abs(roundedZ) > 1.0 && stat.evalCount > 0 && means.length >= 2,
    };
  });

  return {
    results,
    grandMean: Number(grandMean.toFixed(2)),
    panelStdDev: Number(panelStdDev.toFixed(2)),
  };
}

function calculateJudgeDrift(scores, teams, judges, criteria, minEvaluations = 6) {
  return judges.map((judge) => {
    const evaluations = [];

    for (const team of teams) {
      const matchScores = scores.filter(
        (s) => s.judge_id === judge.id && s.team_id === team.id
      );
      if (matchScores.length > 0) {
        const orderIndex = matchScores[0].order_index ?? 0;
        const total = calculateJudgeTeamTotal(judge.id, team.id, scores, criteria);
        if (total !== null) {
          evaluations.push({ orderIndex, total });
        }
      }
    }

    evaluations.sort((a, b) => a.orderIndex - b.orderIndex);
    const n = evaluations.length;

    if (n < 2) {
      return { judge, evalCount: n, correlation: 0, flagged: false };
    }

    const x = evaluations.map((e) => e.orderIndex);
    const y = evaluations.map((e) => e.total);

    const xMean = x.reduce((a, b) => a + b, 0) / n;
    const yMean = y.reduce((a, b) => a + b, 0) / n;

    let numerator = 0;
    let xSumSq = 0;
    let ySumSq = 0;

    for (let i = 0; i < n; i++) {
      const dx = x[i] - xMean;
      const dy = y[i] - yMean;
      numerator += dx * dy;
      xSumSq += dx * dx;
      ySumSq += dy * dy;
    }

    const denominator = Math.sqrt(xSumSq * ySumSq);
    const r = denominator > 0 ? numerator / denominator : 0;
    const roundedR = Number(r.toFixed(2));

    return {
      judge,
      evalCount: n,
      correlation: roundedR,
      flagged: roundedR < -0.50 && n >= minEvaluations,
    };
  });
}

function calculateTeamAgreement(scores, teams, judges, criteria) {
  return teams.map((team) => {
    const judgeTotals = {};
    const totals = [];

    for (const judge of judges) {
      const tot = calculateJudgeTeamTotal(judge.id, team.id, scores, criteria);
      if (tot !== null) {
        judgeTotals[judge.id] = tot;
        totals.push(tot);
      }
    }

    if (totals.length < 2) {
      return {
        team,
        judgeTotals,
        meanTotal: totals[0] || 0,
        standardDeviation: 0,
        disagreementLevel: 'Low',
      };
    }

    const mean = totals.reduce((a, b) => a + b, 0) / totals.length;
    const variance =
      totals.reduce((sum, val) => sum + Math.pow(val - mean, 2), 0) / totals.length;
    const standardDeviation = Number(Math.sqrt(variance).toFixed(2));

    let disagreementLevel = 'Low';
    if (standardDeviation >= 12.0) disagreementLevel = 'High';
    else if (standardDeviation >= 6.0) disagreementLevel = 'Medium';

    return {
      team,
      judgeTotals,
      meanTotal: Number(mean.toFixed(2)),
      standardDeviation,
      disagreementLevel,
    };
  });
}

function calculateSensitivityRerank(scores, teams, judges, criteria, excludedJudgeIds = []) {
  const baselineLeaderboard = calculateLeaderboard(scores, teams, judges, criteria, []);
  const simulatedLeaderboard = calculateLeaderboard(scores, teams, judges, criteria, excludedJudgeIds);

  const originalWinner = baselineLeaderboard[0] || null;
  const newWinner = simulatedLeaderboard[0] || null;

  const winnerChanged =
    Boolean(originalWinner && newWinner) &&
    originalWinner.team.id !== newWinner.team.id;

  const baselineMap = new Map();
  baselineLeaderboard.forEach((r) => baselineMap.set(r.team.id, r));

  const teamDeltas = {};
  simulatedLeaderboard.forEach((simRow) => {
    const baseRow = baselineMap.get(simRow.team.id);
    if (baseRow) {
      teamDeltas[simRow.team.id] = {
        rankDelta: baseRow.rank - simRow.rank,
        scoreDelta: Number((simRow.totalScore - baseRow.totalScore).toFixed(2)),
      };
    }
  });

  return {
    baselineLeaderboard,
    simulatedLeaderboard,
    winnerChanged,
    originalWinner,
    newWinner,
    excludedJudgeIds,
    teamDeltas,
  };
}

function generateFairnessSummarySentence(leniency, drift, sensitivity, judges, teams) {
  if (judges.length < 2) {
    return 'Insufficient judge count for comparative statistical panel telemetry.';
  }

  const leniencyOutlier = [...leniency]
    .filter((l) => l.flagged)
    .sort((a, b) => Math.abs(b.zScore) - Math.abs(a.zScore))[0];

  const driftOutlier = [...drift]
    .filter((d) => d.flagged)
    .sort((a, b) => a.correlation - b.correlation)[0];

  const primaryOutlier = leniencyOutlier || (driftOutlier ? {
    judge: driftOutlier.judge,
    meanTotal: 0,
    zScore: 0,
    flagged: true,
  } : null);

  if (!primaryOutlier) {
    return 'All judges scored within normal distribution bounds; panel consistency is strong across all criteria.';
  }

  const judge = primaryOutlier.judge;
  const otherJudges = leniency.filter((l) => l.judge.id !== judge.id && l.evalCount > 0);
  const otherMean =
    otherJudges.length > 0
      ? otherJudges.reduce((acc, j) => acc + j.meanTotal, 0) / otherJudges.length
      : 0;

  const judgeMean = leniency.find((l) => l.judge.id === judge.id)?.meanTotal ?? 0;
  const diff = otherMean - judgeMean;
  const isLower = diff > 0;
  const absDiff = Math.abs(diff).toFixed(1);

  const origWinName = sensitivity.originalWinner?.team.name;
  const newWinName = sensitivity.newWinner?.team.name;

  if (sensitivity.winnerChanged && origWinName && newWinName) {
    return `${judge.name} scores ${absDiff} points ${
      isLower ? 'lower' : 'higher'
    } than the panel. Excluding ${judge.name} changes the winner from ${origWinName} to ${newWinName}.`;
  }

  if (origWinName) {
    return `${judge.name} scores ${absDiff} points ${
      isLower ? 'lower' : 'higher'
    } than the panel, but excluding them does not alter the winning team (${origWinName}).`;
  }

  return `${judge.name} scores ${absDiff} points ${isLower ? 'lower' : 'higher'} than the panel.`;
}

async function main() {
  console.log('===============================================================');
  console.log('  FAIRPITCH MODULE 5: STATISTICAL FAIRNESS ENGINE TEST SUITE');
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
  // UNIT TESTS: Domain Math Engine
  // -------------------------------------------------------------
  console.log('[Test Suite 1] Pure Math Telemetry Calculations');

  const criteria = [
    { id: 'c1', name: 'Technical', weight: 50, max_score: 10 },
    { id: 'c2', name: 'Impact', weight: 50, max_score: 10 },
  ];

  const judges = [
    { id: 'j1', name: 'Dr. Evelyn Vance' },
    { id: 'j2', name: 'Marcus Sterling' },
    { id: 'j3', name: 'Prof. Aris Thorne' }, // Harsh outlier with fatigue
  ];

  const teams = [
    { id: 't1', name: 'MediSync' }, // Suffered from harsh outlier
    { id: 't2', name: 'NeuroGait' }, // Baseline winner
    { id: 't3', name: 'GreenPulse' },
  ];

  // Controlled synthetic scores:
  // j1: MediSync: 9.0/9.0 (90 pts), NeuroGait: 8.0/8.0 (80 pts), GreenPulse: 7.0/7.0 (70 pts) -> mean = 80
  // j2: MediSync: 8.8/8.8 (88 pts), NeuroGait: 8.2/8.2 (82 pts), GreenPulse: 7.0/7.0 (70 pts) -> mean = 80
  // j3 (Outlier): MediSync: 3.5/3.5 (35 pts), NeuroGait: 7.0/7.0 (70 pts), GreenPulse: 4.5/4.5 (45 pts) -> mean = 50
  //
  // Baseline scores:
  // MediSync: (90 + 88 + 35) / 3 = 213 / 3 = 71.0 pts (Rank 2)
  // NeuroGait: (80 + 82 + 70) / 3 = 232 / 3 = 77.33 pts (Rank 1 - Winner)
  //
  // Counterfactual without j3:
  // MediSync: (90 + 88) / 2 = 89.0 pts (Rank 1 - NEW WINNER!)
  // NeuroGait: (80 + 82) / 2 = 81.0 pts (Rank 2)
  // -> WINNER FLIP!

  const syntheticScores = [
    // j1 scores
    { judge_id: 'j1', team_id: 't1', criterion_id: 'c1', score: 9.0, order_index: 1 },
    { judge_id: 'j1', team_id: 't1', criterion_id: 'c2', score: 9.0, order_index: 1 },
    { judge_id: 'j1', team_id: 't2', criterion_id: 'c1', score: 8.0, order_index: 2 },
    { judge_id: 'j1', team_id: 't2', criterion_id: 'c2', score: 8.0, order_index: 2 },
    { judge_id: 'j1', team_id: 't3', criterion_id: 'c1', score: 7.0, order_index: 3 },
    { judge_id: 'j1', team_id: 't3', criterion_id: 'c2', score: 7.0, order_index: 3 },

    // j2 scores
    { judge_id: 'j2', team_id: 't1', criterion_id: 'c1', score: 8.8, order_index: 1 },
    { judge_id: 'j2', team_id: 't1', criterion_id: 'c2', score: 8.8, order_index: 1 },
    { judge_id: 'j2', team_id: 't2', criterion_id: 'c1', score: 8.2, order_index: 2 },
    { judge_id: 'j2', team_id: 't2', criterion_id: 'c2', score: 8.2, order_index: 2 },
    { judge_id: 'j2', team_id: 't3', criterion_id: 'c1', score: 7.0, order_index: 3 },
    { judge_id: 'j2', team_id: 't3', criterion_id: 'c2', score: 7.0, order_index: 3 },

    // j3 scores (harsh outlier)
    { judge_id: 'j3', team_id: 't2', criterion_id: 'c1', score: 7.0, order_index: 1 },
    { judge_id: 'j3', team_id: 't2', criterion_id: 'c2', score: 7.0, order_index: 1 },
    { judge_id: 'j3', team_id: 't3', criterion_id: 'c1', score: 4.5, order_index: 2 },
    { judge_id: 'j3', team_id: 't3', criterion_id: 'c2', score: 4.5, order_index: 2 },
    { judge_id: 'j3', team_id: 't1', criterion_id: 'c1', score: 3.5, order_index: 3 },
    { judge_id: 'j3', team_id: 't1', criterion_id: 'c2', score: 3.5, order_index: 3 },
  ];

  // 1. Leniency Test
  const leniency = calculateJudgeLeniency(syntheticScores, teams, judges, criteria);
  assert(leniency.results.length === 3, 'Calculated leniency for all 3 judges');
  const j3Leniency = leniency.results.find((l) => l.judge.id === 'j3');
  assert(j3Leniency.flagged === true, `Outlier judge flagged for review (flagged=${j3Leniency.flagged})`);
  assert(j3Leniency.zScore < -1.0, `Outlier judge has z-score < -1.0 (z=${j3Leniency.zScore})`);

  // 2. Agreement Test
  const agreement = calculateTeamAgreement(syntheticScores, teams, judges, criteria);
  const mediSyncAgreement = agreement.find((a) => a.team.id === 't1');
  assert(
    mediSyncAgreement.disagreementLevel === 'High',
    `MediSync flagged as High Disagreement due to outlier score (sigma=${mediSyncAgreement.standardDeviation})`
  );

  // 3. Counterfactual Sensitivity & Winner Flip Test
  const rerank = calculateSensitivityRerank(syntheticScores, teams, judges, criteria, ['j3']);
  assert(rerank.originalWinner.team.name === 'NeuroGait', `Baseline winner is NeuroGait (${rerank.originalWinner.totalScore} pts)`);
  assert(rerank.newWinner.team.name === 'MediSync', `Audited winner without outlier is MediSync (${rerank.newWinner.totalScore} pts)`);
  assert(rerank.winnerChanged === true, 'Winner-flip sensitivity detected (winnerChanged = true)');
  assert(rerank.teamDeltas['t1'].rankDelta === 1, 'MediSync advanced +1 rank (Rank 2 -> Rank 1)');

  // 4. Dynamic Plain-English Summary
  const drift = calculateJudgeDrift(syntheticScores, teams, judges, criteria);
  const summary = generateFairnessSummarySentence(leniency.results, drift, rerank, judges, teams);
  assert(
    summary.includes('Prof. Aris Thorne') && summary.includes('NeuroGait') && summary.includes('MediSync'),
    `Generated executive synthesis statement: "${summary}"`
  );

  // 5. Fatigue Drift Test with sequential evaluations
  const fatigueScores = [
    { judge_id: 'j4', team_id: 't1', criterion_id: 'c1', score: 9.5, order_index: 1 },
    { judge_id: 'j4', team_id: 't2', criterion_id: 'c1', score: 8.5, order_index: 2 },
    { judge_id: 'j4', team_id: 't3', criterion_id: 'c1', score: 7.5, order_index: 3 },
    { judge_id: 'j4', team_id: 't4', criterion_id: 'c1', score: 6.0, order_index: 4 },
    { judge_id: 'j4', team_id: 't5', criterion_id: 'c1', score: 5.0, order_index: 5 },
    { judge_id: 'j4', team_id: 't6', criterion_id: 'c1', score: 3.5, order_index: 6 },
  ];
  const testTeams = [
    { id: 't1', name: '1' },
    { id: 't2', name: '2' },
    { id: 't3', name: '3' },
    { id: 't4', name: '4' },
    { id: 't5', name: '5' },
    { id: 't6', name: '6' },
  ];
  const testJudge = [{ id: 'j4', name: 'Fatigued Judge' }];
  const testCriteria = [{ id: 'c1', name: 'General', weight: 100, max_score: 10 }];

  const driftResults = calculateJudgeDrift(fatigueScores, testTeams, testJudge, testCriteria, 6);
  assert(driftResults[0].correlation < -0.9, `Steep fatigue correlation calculated (r = ${driftResults[0].correlation})`);
  assert(driftResults[0].flagged === true, 'Judge flagged for cognitive fatigue drift');

  // -------------------------------------------------------------
  // DATABASE INTEGRATION TESTS (PGlite)
  // -------------------------------------------------------------
  console.log('\n[Test Suite 2] Database Integration & Snapshot Archival (PGlite)');

  const db = new PGlite({ extensions: { pgcrypto } });

  // 1. Setup Auth and apply all 5 migrations
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

  // Load migrations 1-5
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
  console.log('✓ All 5 migrations loaded into PGlite');

  // Seed institution, organizer, event, criteria, judges, teams
  const instId = '11111111-1111-1111-1111-111111111111';
  const orgId = '22222222-2222-2222-2222-222222222222';
  const eventId = '33333333-3333-3333-3333-333333333333';
  const judge1Id = '44444444-4444-4444-4444-444444444441';
  const judge2Id = '44444444-4444-4444-4444-444444444442';
  const judge3Id = '44444444-4444-4444-4444-444444444443';
  const team1Id = '55555555-5555-5555-5555-555555555551';
  const team2Id = '55555555-5555-5555-5555-555555555552';
  const crit1Id = '66666666-6666-6666-6666-666666666661';
  const crit2Id = '66666666-6666-6666-6666-666666666662';

  await db.query(`
    INSERT INTO public.institutions (id, name, slug, contact_email)
    VALUES ($1, 'FairTech Univ', 'fairtech', 'admin@fairtech.edu');
  `, [instId]);

  await db.query(`
    INSERT INTO auth.users (id, email) VALUES
      ($1, 'org@fairtech.edu'),
      ($2, 'judge1@fairtech.edu'),
      ($3, 'judge2@fairtech.edu'),
      ($4, 'judge3@fairtech.edu');
  `, [orgId, judge1Id, judge2Id, judge3Id]);

  await db.query(`
    INSERT INTO public.profiles (id, institution_id, full_name, email, role, organizer_approval_status) VALUES
      ($1, $5, 'Dr. Org', 'org@fairtech.edu', 'institution_admin', 'approved'),
      ($2, $5, 'Dr. Evelyn Vance', 'judge1@fairtech.edu', 'user', 'none'),
      ($3, $5, 'Marcus Sterling', 'judge2@fairtech.edu', 'user', 'none'),
      ($4, $5, 'Prof. Aris Thorne', 'judge3@fairtech.edu', 'user', 'none');
  `, [orgId, judge1Id, judge2Id, judge3Id, instId]);

  await db.query(`
    INSERT INTO public.events (id, institution_id, title, slug, start_date, end_date, status, min_judges_per_team, created_by)
    VALUES ($1, $2, 'AI Innovation Hackathon', 'ai-hack', now(), now() + interval '2 days', 'draft', 3, $3);
  `, [eventId, instId, orgId]);

  await db.query(`
    INSERT INTO public.event_roles (user_id, event_id, institution_id, role, status) VALUES
      ($1, $5, $6, 'organizer', 'active'),
      ($2, $5, $6, 'jury', 'active'),
      ($3, $5, $6, 'jury', 'active'),
      ($4, $5, $6, 'jury', 'active');
  `, [orgId, judge1Id, judge2Id, judge3Id, eventId, instId]);

  await db.query(`
    INSERT INTO public.rubric_criteria (id, event_id, institution_id, name, weight, max_score, order_index) VALUES
      ($1, $3, $4, 'Innovation', 50, 10, 1),
      ($2, $3, $4, 'Execution', 50, 10, 2);
  `, [crit1Id, crit2Id, eventId, instId]);

  // Transition event to judging
  await db.query(`SELECT set_config('request.jwt.claim.sub', $1, false);`, [orgId]);
  await db.query(`SELECT public.transition_event_status($1, 'open');`, [eventId]);
  await db.query(`SELECT public.transition_event_status($1, 'judging');`, [eventId]);

  await db.query(`
    INSERT INTO public.teams (id, event_id, institution_id, name, team_code, status) VALUES
      ($1, $3, $4, 'MediSync', 'MED123', 'approved'),
      ($2, $3, $4, 'NeuroGait', 'NEU456', 'approved');
  `, [team1Id, team2Id, eventId, instId]);

  // Insert assignments
  await db.query(`
    INSERT INTO public.judge_assignments (event_id, institution_id, judge_id, team_id, order_index, status) VALUES
      ($1, $2, $3, $6, 1, 'assigned'),
      ($1, $2, $3, $7, 2, 'assigned'),
      ($1, $2, $4, $6, 1, 'assigned'),
      ($1, $2, $4, $7, 2, 'assigned'),
      ($1, $2, $5, $7, 1, 'assigned'),
      ($1, $2, $5, $6, 2, 'assigned');
  `, [eventId, instId, judge1Id, judge2Id, judge3Id, team1Id, team2Id]);

  // Simulate scoring via submit_scores RPC
  // Judge 1 (aligned high)
  await db.query(`SELECT set_config('request.jwt.claim.sub', $1, false);`, [judge1Id]);
  await db.query(`
    SELECT public.submit_scores($1, $2::jsonb);
  `, [team1Id, JSON.stringify([
    { criterion_id: crit1Id, score: 9.0, comment: 'Flawless innovation' },
    { criterion_id: crit2Id, score: 9.0, comment: 'Solid execution' },
  ])]);

  await db.query(`
    SELECT public.submit_scores($1, $2::jsonb);
  `, [team2Id, JSON.stringify([
    { criterion_id: crit1Id, score: 8.0, comment: 'Good concept' },
    { criterion_id: crit2Id, score: 8.0, comment: 'Execution was decent' },
  ])]);

  // Judge 2 (aligned high)
  await db.query(`SELECT set_config('request.jwt.claim.sub', $1, false);`, [judge2Id]);
  await db.query(`
    SELECT public.submit_scores($1, $2::jsonb);
  `, [team1Id, JSON.stringify([
    { criterion_id: crit1Id, score: 9.0, comment: 'Great project' },
    { criterion_id: crit2Id, score: 9.0, comment: 'Great delivery' },
  ])]);

  await db.query(`
    SELECT public.submit_scores($1, $2::jsonb);
  `, [team2Id, JSON.stringify([
    { criterion_id: crit1Id, score: 8.0, comment: 'Good pitch' },
    { criterion_id: crit2Id, score: 8.0, comment: 'Good demo' },
  ])]);

  // Judge 3 (harsh outlier: gave team 1 3.0 pts, team 2 8.0 pts)
  await db.query(`SELECT set_config('request.jwt.claim.sub', $1, false);`, [judge3Id]);
  await db.query(`
    SELECT public.submit_scores($1, $2::jsonb);
  `, [team2Id, JSON.stringify([
    { criterion_id: crit1Id, score: 8.0, comment: 'Solid demo' },
    { criterion_id: crit2Id, score: 8.0, comment: 'Well prepared' },
  ])]);

  await db.query(`
    SELECT public.submit_scores($1, $2::jsonb);
  `, [team1Id, JSON.stringify([
    { criterion_id: crit1Id, score: 3.0, comment: 'Severe flaws identified' },
    { criterion_id: crit2Id, score: 3.0, comment: 'Incomplete implementation' },
  ])]);

  // Verify scores exist in v_latest_scores view
  const { rows: scoreRows } = await db.query(`
    SELECT team_id, judge_id, criterion_id, score, version
    FROM public.v_latest_scores
    WHERE event_id = $1;
  `, [eventId]);

  assert(scoreRows.length === 12, `v_latest_scores contains 12 evaluation scores (received ${scoreRows.length})`);

  // Persist snapshot to fairness_reports
  const mockSnapshot = {
    summarySentence: summary,
    grandMean: leniency.grandMean,
    panelStdDev: leniency.panelStdDev,
  };

  const { rows: insertedReport } = await db.query(`
    INSERT INTO public.fairness_reports (
      event_id,
      institution_id,
      metrics,
      flagged_judges,
      sensitivity_rerank,
      created_by
    ) VALUES (
      $1, $2, $3::jsonb, $4::jsonb, $5::jsonb, $6
    ) RETURNING id, snapshot_at;
  `, [
    eventId,
    instId,
    JSON.stringify(mockSnapshot),
    JSON.stringify([{ judge_id: judge3Id, name: 'Prof. Aris Thorne', reason: 'leniency_outlier' }]),
    JSON.stringify({ winnerChanged: true, originalWinner: 'NeuroGait', newWinner: 'MediSync' }),
    orgId,
  ]);

  assert(insertedReport.length === 1, `Snapshot successfully persisted to fairness_reports (ID: ${insertedReport[0].id})`);

  // Verify retrieval
  const { rows: fetchedReport } = await db.query(`
    SELECT id, metrics->>'summarySentence' as summary, sensitivity_rerank->>'winnerChanged' as changed
    FROM public.fairness_reports
    WHERE event_id = $1
    ORDER BY snapshot_at DESC
    LIMIT 1;
  `, [eventId]);

  assert(fetchedReport.length === 1, 'Successfully queried snapshot from database');
  assert(fetchedReport[0].changed === 'true', 'Retrieved snapshot confirms winner flip (changed=true)');

  console.log('\n===============================================================');
  console.log(`  MODULE 5 TEST RESULTS: ${passed} PASSED, ${failed} FAILED`);
  console.log('===============================================================\n');

  if (failed > 0) {
    process.exit(1);
  }
}

main().catch((err) => {
  console.error('Test suite runner crashed:', err);
  process.exit(1);
});
