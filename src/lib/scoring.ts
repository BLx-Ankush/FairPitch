import {
  RUBRIC_CRITERIA,
  SEED_JUDGES,
  SEED_TEAMS,
  Criterion,
  Judge,
  ScoreRecord,
  Team,
  getStoredScores,
} from './data';

export interface LeaderboardEntry {
  rank: number;
  team: Team;
  totalScore: number; // 0-100 scale (average of included judge totals)
  judgeTotals: Record<string, number>; // judgeId -> total out of 100
  criterionAverages: Record<string, number>; // criterionId -> raw score 0-10
  weightedCriterionAverages: Record<string, number>; // criterionId -> weighted points
}

export interface CriterionGapEntry {
  criterionId: string;
  criterionName: string;
  weight: number;
  teamAverage: number; // raw score out of 10
  winnerAverage: number; // raw score out of 10
  rawGap: number; // winnerAverage - teamAverage
  weightedGap: number; // (rawGap / 10) * weight
  teamWeightedScore: number; // (teamAverage / 10) * weight
  winnerWeightedScore: number; // (winnerAverage / 10) * weight
}

/**
 * Calculates a judge's total score for a team out of 100:
 * sum(score / 10 * weight)
 */
export function teamTotal(
  judgeId: string,
  teamId: string,
  scores?: ScoreRecord[],
  criteria: Criterion[] = RUBRIC_CRITERIA
): number {
  const allScores = scores || getStoredScores();
  const judgeScores = allScores.filter(
    (s) => s.judge_id === judgeId && s.team_id === teamId
  );

  let total = 0;
  for (const criterion of criteria) {
    const record = judgeScores.find((s) => s.criterion_id === criterion.id);
    const scoreVal = record ? record.score : 0;
    total += (scoreVal / 10) * criterion.weight;
  }

  return Number(total.toFixed(2));
}

/**
 * Generates the hackathon leaderboard with average total, rank,
 * and per-criterion averages, allowing exclusion of specific judges.
 */
export function leaderboard(
  excludedJudgeIds: string[] = [],
  scores?: ScoreRecord[],
  teams: Team[] = SEED_TEAMS,
  judges: Judge[] = SEED_JUDGES,
  criteria: Criterion[] = RUBRIC_CRITERIA
): LeaderboardEntry[] {
  const allScores = scores || getStoredScores();
  const activeJudges = judges.filter(
    (j) => !excludedJudgeIds.includes(j.id)
  );

  if (activeJudges.length === 0 || teams.length === 0) {
    return [];
  }

  const entries: LeaderboardEntry[] = teams.map((team) => {
    const judgeTotals: Record<string, number> = {};
    let sumTotal = 0;

    for (const judge of activeJudges) {
      const tot = teamTotal(judge.id, team.id, allScores, criteria);
      judgeTotals[judge.id] = tot;
      sumTotal += tot;
    }

    const totalScore = Number((sumTotal / activeJudges.length).toFixed(2));

    const criterionAverages: Record<string, number> = {};
    const weightedCriterionAverages: Record<string, number> = {};

    for (const criterion of criteria) {
      const relevantScores = allScores.filter(
        (s) =>
          s.team_id === team.id &&
          s.criterion_id === criterion.id &&
          activeJudges.some((j) => j.id === s.judge_id)
      );

      const rawSum = relevantScores.reduce((sum, s) => sum + s.score, 0);
      const rawAvg =
        relevantScores.length > 0
          ? Number((rawSum / relevantScores.length).toFixed(2))
          : 0;

      criterionAverages[criterion.id] = rawAvg;
      weightedCriterionAverages[criterion.id] = Number(
        ((rawAvg / 10) * criterion.weight).toFixed(2)
      );
    }

    return {
      rank: 0, // Assigned below after sorting
      team,
      totalScore,
      judgeTotals,
      criterionAverages,
      weightedCriterionAverages,
    };
  });

  // Sort descending by totalScore
  entries.sort((a, b) => b.totalScore - a.totalScore);

  // Assign ranks
  entries.forEach((entry, idx) => {
    entry.rank = idx + 1;
  });

  return entries;
}

/**
 * Calculates weighted points lost per criterion versus the winner,
 * sorted largest gap first.
 */
export function criterionGap(
  teamId: string,
  winnerId: string,
  scores?: ScoreRecord[],
  excludedJudgeIds: string[] = [],
  criteria: Criterion[] = RUBRIC_CRITERIA,
  judges: Judge[] = SEED_JUDGES
): CriterionGapEntry[] {
  const allScores = scores || getStoredScores();
  const activeJudges = judges.filter(
    (j) => !excludedJudgeIds.includes(j.id)
  );

  const gaps: CriterionGapEntry[] = criteria.map((criterion) => {
    const teamScores = allScores.filter(
      (s) =>
        s.team_id === teamId &&
        s.criterion_id === criterion.id &&
        activeJudges.some((j) => j.id === s.judge_id)
    );
    const winnerScores = allScores.filter(
      (s) =>
        s.team_id === winnerId &&
        s.criterion_id === criterion.id &&
        activeJudges.some((j) => j.id === s.judge_id)
    );

    const teamRawAvg =
      teamScores.length > 0
        ? teamScores.reduce((acc, s) => acc + s.score, 0) / teamScores.length
        : 0;
    const winnerRawAvg =
      winnerScores.length > 0
        ? winnerScores.reduce((acc, s) => acc + s.score, 0) / winnerScores.length
        : 0;

    const rawGap = Number((winnerRawAvg - teamRawAvg).toFixed(2));
    const weightedGap = Number(
      (((winnerRawAvg - teamRawAvg) / 10) * criterion.weight).toFixed(2)
    );
    const teamWeighted = Number(
      ((teamRawAvg / 10) * criterion.weight).toFixed(2)
    );
    const winnerWeighted = Number(
      ((winnerRawAvg / 10) * criterion.weight).toFixed(2)
    );

    return {
      criterionId: criterion.id,
      criterionName: criterion.name,
      weight: criterion.weight,
      teamAverage: Number(teamRawAvg.toFixed(2)),
      winnerAverage: Number(winnerRawAvg.toFixed(2)),
      rawGap,
      weightedGap,
      teamWeightedScore: teamWeighted,
      winnerWeightedScore: winnerWeighted,
    };
  });

  // Sort descending: largest loss first
  gaps.sort((a, b) => b.weightedGap - a.weightedGap);

  return gaps;
}
