import {
  Criterion,
  Judge,
  RUBRIC_CRITERIA,
  SEED_JUDGES,
  SEED_SCORES,
  SEED_TEAMS,
  ScoreRecord,
  Team,
  getStoredScores,
} from './data';
import { LeaderboardEntry, leaderboard, teamTotal } from './scoring';

export interface JudgeLeniencyResult {
  judge: Judge;
  meanScore: number; // 0-10 scale
  meanTotal: number; // 0-100 scale
  zScore: number;
  flagged: boolean; // |z| > 1
}

export interface JudgeDriftResult {
  judge: Judge;
  scoreCount: number;
  correlation: number; // Pearson correlation between order_index and score
  flagged: boolean; // correlation < -0.5 and scoreCount >= 8
}

export interface TeamAgreementResult {
  team: Team;
  judgeTotals: Record<string, number>;
  meanTotal: number;
  standardDeviation: number;
  disagreementLevel: 'High' | 'Medium' | 'Low';
}

export interface RerankResult {
  originalLeaderboard: LeaderboardEntry[];
  newLeaderboard: LeaderboardEntry[];
  winnerChanged: boolean;
  originalWinner: LeaderboardEntry;
  newWinner: LeaderboardEntry;
  excludedJudgeIds: string[];
}

/**
 * 1. judgeLeniency(): each judge's mean score and a z-score of that mean
 * against all judges' means; flagged = |z| > 1.
 */
export function judgeLeniency(
  scores?: ScoreRecord[],
  judges: Judge[] = SEED_JUDGES,
  teams: Team[] = SEED_TEAMS,
  criteria: Criterion[] = RUBRIC_CRITERIA
): JudgeLeniencyResult[] {
  const allScores = scores || getStoredScores();

  if (judges.length === 0 || teams.length === 0) {
    return [];
  }

  // Compute mean total (out of 100) and mean score (0-10) for each judge
  const judgeStats = judges.map((judge) => {
    const jScores = allScores.filter((s) => s.judge_id === judge.id);
    const meanScore =
      jScores.length > 0
        ? jScores.reduce((acc, s) => acc + s.score, 0) / jScores.length
        : 0;

    const teamTotals = teams.map((team) =>
      teamTotal(judge.id, team.id, allScores, criteria)
    );
    const meanTotal =
      teamTotals.length > 0
        ? teamTotals.reduce((a, b) => a + b, 0) / teamTotals.length
        : 0;

    return {
      judge,
      meanScore: Number(meanScore.toFixed(2)),
      meanTotal: Number(meanTotal.toFixed(2)),
    };
  });

  // Calculate panel grand mean and standard deviation of judge means
  const means = judgeStats.map((s) => s.meanTotal);
  const grandMean = means.reduce((a, b) => a + b, 0) / (means.length || 1);
  const variance =
    means.reduce((acc, m) => acc + Math.pow(m - grandMean, 2), 0) /
    (means.length || 1);
  const stdDev = Math.sqrt(variance);

  return judgeStats.map((stat) => {
    const zScore = stdDev > 0 ? (stat.meanTotal - grandMean) / stdDev : 0;
    const roundedZ = Number(zScore.toFixed(2));
    return {
      judge: stat.judge,
      meanScore: stat.meanScore,
      meanTotal: stat.meanTotal,
      zScore: roundedZ,
      flagged: Math.abs(roundedZ) > 1,
    };
  });
}

/**
 * 2. judgeDrift(): per judge, the correlation between order_index and score;
 * flagged if correlation < -0.5 and at least 8 scores.
 */
export function judgeDrift(
  scores?: ScoreRecord[],
  judges: Judge[] = SEED_JUDGES
): JudgeDriftResult[] {
  const allScores = scores || getStoredScores();

  return judges.map((judge) => {
    const jScores = allScores
      .filter((s) => s.judge_id === judge.id)
      .sort((a, b) => a.order_index - b.order_index);

    const n = jScores.length;
    if (n < 2) {
      return {
        judge,
        scoreCount: n,
        correlation: 0,
        flagged: false,
      };
    }

    const x = jScores.map((s) => s.order_index);
    const y = jScores.map((s) => s.score);

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
      scoreCount: n,
      correlation: roundedR,
      flagged: roundedR < -0.5 && n >= 8,
    };
  });
}

/**
 * 3. teamAgreement(): per team, the standard deviation of judge totals,
 * labeled High / Medium / Low disagreement.
 */
export function teamAgreement(
  scores?: ScoreRecord[],
  teams: Team[] = SEED_TEAMS,
  judges: Judge[] = SEED_JUDGES,
  criteria: Criterion[] = RUBRIC_CRITERIA
): TeamAgreementResult[] {
  const allScores = scores || getStoredScores();

  if (teams.length === 0 || judges.length === 0) {
    return [];
  }

  return teams.map((team) => {
    const judgeTotals: Record<string, number> = {};
    const totals: number[] = [];

    for (const judge of judges) {
      const tot = teamTotal(judge.id, team.id, allScores, criteria);
      judgeTotals[judge.id] = tot;
      totals.push(tot);
    }

    const mean = totals.reduce((a, b) => a + b, 0) / (totals.length || 1);
    const variance =
      totals.reduce((sum, val) => sum + Math.pow(val - mean, 2), 0) /
      (totals.length || 1);
    const standardDeviation = Number(Math.sqrt(variance).toFixed(2));

    let disagreementLevel: 'High' | 'Medium' | 'Low' = 'Low';
    if (standardDeviation >= 12) {
      disagreementLevel = 'High';
    } else if (standardDeviation >= 6) {
      disagreementLevel = 'Medium';
    } else {
      disagreementLevel = 'Low';
    }

    return {
      team,
      judgeTotals,
      meanTotal: Number(mean.toFixed(2)),
      standardDeviation,
      disagreementLevel,
    };
  });
}

/**
 * 4. rerankWithout(flaggedJudgeIds): returns original leaderboard, new leaderboard,
 * and whether the winner changed.
 */
export function rerankWithout(
  flaggedJudgeIds: string[],
  scores?: ScoreRecord[],
  teams: Team[] = SEED_TEAMS,
  judges: Judge[] = SEED_JUDGES,
  criteria: Criterion[] = RUBRIC_CRITERIA
): RerankResult {
  const allScores = scores || getStoredScores();
  const originalLeaderboard = leaderboard([], allScores, teams, judges, criteria);
  const newLeaderboard = leaderboard(flaggedJudgeIds, allScores, teams, judges, criteria);

  const originalWinner = originalLeaderboard[0];
  const newWinner = newLeaderboard[0];
  const winnerChanged =
    Boolean(originalWinner && newWinner) &&
    originalWinner.team.id !== newWinner.team.id;

  return {
    originalLeaderboard,
    newLeaderboard,
    winnerChanged,
    originalWinner,
    newWinner,
    excludedJudgeIds: flaggedJudgeIds,
  };
}

/**
 * 5. fairnessSummary(): one plain-English sentence dynamically explaining
 * whether a judge significantly deviated and whether excluding them changes the winner.
 */
export function fairnessSummary(
  scores?: ScoreRecord[],
  judges: Judge[] = SEED_JUDGES,
  teams: Team[] = SEED_TEAMS,
  criteria: Criterion[] = RUBRIC_CRITERIA
): string {
  const allScores = scores || getStoredScores();
  const leniency = judgeLeniency(allScores, judges, teams, criteria);
  const drift = judgeDrift(allScores, judges);

  if (judges.length < 2) {
    return 'Insufficient judge count for comparative statistical panel telemetry.';
  }

  // Priority to leniency flagged judges, then drift
  const flaggedJudgeResult =
    leniency.find((l) => l.flagged) ||
    drift.find((d) => d.flagged);

  if (!flaggedJudgeResult) {
    return 'All judges scored within normal distribution bounds; panel consistency is strong across all criteria.';
  }

  const flaggedJudgeId = flaggedJudgeResult.judge.id;
  const flaggedJudge = flaggedJudgeResult.judge;

  // Compute other judges' mean total
  const otherJudges = judges.filter((j) => j.id !== flaggedJudgeId);
  const otherTotals = otherJudges.flatMap((j) =>
    teams.map((t) => teamTotal(j.id, t.id, allScores, criteria))
  );
  const otherMeanTotal =
    otherTotals.reduce((a, b) => a + b, 0) / (otherTotals.length || 1);

  const flaggedTotals = teams.map((t) =>
    teamTotal(flaggedJudgeId, t.id, allScores, criteria)
  );
  const flaggedMeanTotal =
    flaggedTotals.reduce((a, b) => a + b, 0) / (flaggedTotals.length || 1);

  const pointDifference = otherMeanTotal - flaggedMeanTotal;
  const isLower = pointDifference > 0;
  const absDiff = Math.abs(pointDifference).toFixed(1);

  const rerank = rerankWithout([flaggedJudgeId], allScores, teams, judges, criteria);

  if (!rerank.originalWinner || !rerank.newWinner) {
    return `${flaggedJudge.name} scores ${absDiff} points ${isLower ? 'lower' : 'higher'} than the panel.`;
  }

  if (rerank.winnerChanged) {
    return `${flaggedJudge.name} scores ${absDiff} points ${
      isLower ? 'lower' : 'higher'
    } than the panel. Excluding ${flaggedJudge.name} changes the winner from ${
      rerank.originalWinner.team.name
    } to ${rerank.newWinner.team.name}.`;
  }

  return `${flaggedJudge.name} scores ${absDiff} points ${
    isLower ? 'lower' : 'higher'
  } than the panel, but excluding them does not alter the winning team (${
    rerank.originalWinner.team.name
  }).`;
}

// Small self-test at the bottom confirming winner flip
export function runFairnessTest() {
  const allScores = SEED_SCORES;
  const leniency = judgeLeniency(allScores);
  const drift = judgeDrift(allScores);
  const agreement = teamAgreement(allScores);
  const flaggedJudgeIds = leniency
    .filter((l) => l.flagged)
    .map((l) => l.judge.id);
  const rerank = rerankWithout(flaggedJudgeIds, allScores);
  const summary = fairnessSummary(allScores);

  console.log('=== FAIRNESS MODULE SELF-TEST ===');
  console.log('Leniency Results:', leniency.map((l) => `${l.judge.name}: z=${l.zScore}, flagged=${l.flagged}`));
  console.log('Drift Results:', drift.map((d) => `${d.judge.name}: r=${d.correlation}, flagged=${d.flagged}`));
  console.log('High Disagreement Teams:', agreement.filter((a) => a.disagreementLevel === 'High').map((a) => `${a.team.name} (sd=${a.standardDeviation})`));
  console.log('Original Winner:', rerank.originalWinner?.team.name, `(${rerank.originalWinner?.totalScore} pts)`);
  console.log('New Winner (Excluding Flagged):', rerank.newWinner?.team.name, `(${rerank.newWinner?.totalScore} pts)`);
  console.log('WINNER FLIP CONFIRMED:', rerank.winnerChanged);
  console.log('Fairness Summary Sentence:', summary);
  console.log('=================================');

  return {
    winnerChanged: rerank.winnerChanged,
    originalWinner: rerank.originalWinner?.team.name,
    newWinner: rerank.newWinner?.team.name,
    summary,
  };
}

// Execute test on file load when running in Node
if (typeof process !== 'undefined' && process.env.NODE_ENV !== 'test') {
  try {
    runFairnessTest();
  } catch {
    // Suppress in edge
  }
}
