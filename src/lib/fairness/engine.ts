/**
 * FairPitch Domain Mathematical Engine for Statistical Fairness & Telemetry
 * Pure TypeScript functions with zero side-effects.
 */

export interface EngineScoreRecord {
  team_id: string
  judge_id: string
  criterion_id: string
  score: number
  order_index?: number
  version?: number
}

export interface EngineCriterion {
  id: string
  name: string
  weight: number // e.g. 25 for 25%
  max_score: number // e.g. 10.0
}

export interface EngineTeam {
  id: string
  name: string
  tagline?: string
}

export interface EngineJudge {
  id: string
  name: string
  email?: string
  avatar_url?: string
}

export interface JudgeLeniencyResult {
  judge: EngineJudge
  meanTotal: number // 0-100 scale
  evalCount: number
  zScore: number
  flagged: boolean // |z| > 1.0
}

export interface JudgeDriftResult {
  judge: EngineJudge
  evalCount: number
  correlation: number // Pearson r (-1.0 to +1.0)
  flagged: boolean // r < -0.50 and evalCount >= minEvaluations
}

export interface TeamAgreementResult {
  team: EngineTeam
  judgeTotals: Record<string, number>
  meanTotal: number
  standardDeviation: number
  disagreementLevel: 'High' | 'Medium' | 'Low'
}

export interface LeaderboardRow {
  rank: number
  team: EngineTeam
  totalScore: number // 0-100
  criterionAverages: Record<string, number>
  evaluatorCount: number
}

export interface SensitivityRerankResult {
  baselineLeaderboard: LeaderboardRow[]
  simulatedLeaderboard: LeaderboardRow[]
  winnerChanged: boolean
  originalWinner: LeaderboardRow | null
  newWinner: LeaderboardRow | null
  excludedJudgeIds: string[]
  teamDeltas: Record<string, {
    rankDelta: number // positive = moved up
    scoreDelta: number
  }>
}

export interface FairnessTelemetrySnapshot {
  summarySentence: string
  grandMean: number
  panelStdDev: number
  leniency: JudgeLeniencyResult[]
  drift: JudgeDriftResult[]
  agreement: TeamAgreementResult[]
  sensitivity: SensitivityRerankResult
  highDisagreementCount: number
  flaggedJudgeCount: number
}

/**
 * 1. Calculate a judge's weighted total score (0-100) for a specific team.
 * Formula: sum((score / max_score) * weight)
 */
export function calculateJudgeTeamTotal(
  judgeId: string,
  teamId: string,
  scores: EngineScoreRecord[],
  criteria: EngineCriterion[]
): number | null {
  const teamJudgeScores = scores.filter(
    (s) => s.judge_id === judgeId && s.team_id === teamId
  )

  if (teamJudgeScores.length === 0) {
    return null
  }

  let total = 0
  for (const c of criteria) {
    const match = teamJudgeScores.find((s) => s.criterion_id === c.id)
    if (match) {
      const max = c.max_score > 0 ? c.max_score : 10
      total += (match.score / max) * c.weight
    }
  }

  return Number(total.toFixed(2))
}

/**
 * 2. Calculate the leaderboard, with optional exclusion of specific judges.
 */
export function calculateLeaderboard(
  scores: EngineScoreRecord[],
  teams: EngineTeam[],
  judges: EngineJudge[],
  criteria: EngineCriterion[],
  excludedJudgeIds: string[] = []
): LeaderboardRow[] {
  const activeJudges = judges.filter((j) => !excludedJudgeIds.includes(j.id))
  const activeJudgeIds = new Set(activeJudges.map((j) => j.id))

  const rows: LeaderboardRow[] = teams.map((team) => {
    const judgeTotals: number[] = []
    const criterionScoreSums: Record<string, number> = {}
    const criterionScoreCounts: Record<string, number> = {}

    criteria.forEach((c) => {
      criterionScoreSums[c.id] = 0
      criterionScoreCounts[c.id] = 0
    })

    for (const judge of activeJudges) {
      const tot = calculateJudgeTeamTotal(judge.id, team.id, scores, criteria)
      if (tot !== null) {
        judgeTotals.push(tot)
      }
    }

    const teamScores = scores.filter(
      (s) => s.team_id === team.id && activeJudgeIds.has(s.judge_id)
    )

    for (const s of teamScores) {
      if (criterionScoreSums[s.criterion_id] !== undefined) {
        criterionScoreSums[s.criterion_id] += s.score
        criterionScoreCounts[s.criterion_id] += 1
      }
    }

    const meanTotal =
      judgeTotals.length > 0
        ? judgeTotals.reduce((a, b) => a + b, 0) / judgeTotals.length
        : 0

    const criterionAverages: Record<string, number> = {}
    for (const c of criteria) {
      const count = criterionScoreCounts[c.id] || 0
      criterionAverages[c.id] =
        count > 0 ? Number((criterionScoreSums[c.id] / count).toFixed(2)) : 0
    }

    return {
      rank: 0,
      team,
      totalScore: Number(meanTotal.toFixed(2)),
      criterionAverages,
      evaluatorCount: judgeTotals.length,
    }
  })

  // Sort descending by total score, secondary by name
  rows.sort((a, b) => {
    if (b.totalScore !== a.totalScore) {
      return b.totalScore - a.totalScore
    }
    return a.team.name.localeCompare(b.team.name)
  })

  // Assign ranks
  rows.forEach((row, idx) => {
    row.rank = idx + 1
  })

  return rows
}

/**
 * 3. Judge Leniency ($Z$-score) Analysis
 * Measures how each judge's mean differs from panel grand mean.
 * Flagged if |z| > 1.0.
 */
export function calculateJudgeLeniency(
  scores: EngineScoreRecord[],
  teams: EngineTeam[],
  judges: EngineJudge[],
  criteria: EngineCriterion[]
): {
  results: JudgeLeniencyResult[]
  grandMean: number
  panelStdDev: number
} {
  if (judges.length === 0) {
    return { results: [], grandMean: 0, panelStdDev: 0 }
  }

  const judgeStats = judges.map((judge) => {
    const teamTotals: number[] = []
    for (const team of teams) {
      const tot = calculateJudgeTeamTotal(judge.id, team.id, scores, criteria)
      if (tot !== null) {
        teamTotals.push(tot)
      }
    }

    const meanTotal =
      teamTotals.length > 0
        ? teamTotals.reduce((a, b) => a + b, 0) / teamTotals.length
        : 0

    return {
      judge,
      meanTotal: Number(meanTotal.toFixed(2)),
      evalCount: teamTotals.length,
    }
  })

  // Calculate panel grand mean and std dev across judges who evaluated >= 1 team
  const activeStats = judgeStats.filter((s) => s.evalCount > 0)
  const means = activeStats.map((s) => s.meanTotal)
  const grandMean =
    means.length > 0 ? means.reduce((a, b) => a + b, 0) / means.length : 0

  const variance =
    means.length > 0
      ? means.reduce((acc, m) => acc + Math.pow(m - grandMean, 2), 0) /
        means.length
      : 0
  const panelStdDev = Math.sqrt(variance)

  const results: JudgeLeniencyResult[] = judgeStats.map((stat) => {
    let z = 0
    if (panelStdDev > 0 && stat.evalCount > 0) {
      z = (stat.meanTotal - grandMean) / panelStdDev
    }
    const roundedZ = Number(z.toFixed(2))

    return {
      judge: stat.judge,
      meanTotal: stat.meanTotal,
      evalCount: stat.evalCount,
      zScore: roundedZ,
      flagged: Math.abs(roundedZ) > 1.0 && stat.evalCount > 0 && means.length >= 2,
    }
  })

  return {
    results,
    grandMean: Number(grandMean.toFixed(2)),
    panelStdDev: Number(panelStdDev.toFixed(2)),
  }
}

/**
 * 4. Judge Fatigue Drift (Pearson Correlation r)
 * Measures correlation between sequential evaluation order_index and assigned score.
 * Flagged if r < -0.50 and evalCount >= minEvaluations.
 */
export function calculateJudgeDrift(
  scores: EngineScoreRecord[],
  teams: EngineTeam[],
  judges: EngineJudge[],
  criteria: EngineCriterion[],
  minEvaluations = 6
): JudgeDriftResult[] {
  return judges.map((judge) => {
    // Collect (order_index, teamTotal) for this judge
    const evaluations: { orderIndex: number; total: number }[] = []

    for (const team of teams) {
      const matchScores = scores.filter(
        (s) => s.judge_id === judge.id && s.team_id === team.id
      )
      if (matchScores.length > 0) {
        const orderIndex = matchScores[0].order_index ?? 0
        const total = calculateJudgeTeamTotal(judge.id, team.id, scores, criteria)
        if (total !== null) {
          evaluations.push({ orderIndex, total })
        }
      }
    }

    evaluations.sort((a, b) => a.orderIndex - b.orderIndex)
    const n = evaluations.length

    if (n < 2) {
      return {
        judge,
        evalCount: n,
        correlation: 0,
        flagged: false,
      }
    }

    const x = evaluations.map((e) => e.orderIndex)
    const y = evaluations.map((e) => e.total)

    const xMean = x.reduce((a, b) => a + b, 0) / n
    const yMean = y.reduce((a, b) => a + b, 0) / n

    let numerator = 0
    let xSumSq = 0
    let ySumSq = 0

    for (let i = 0; i < n; i++) {
      const dx = x[i] - xMean
      const dy = y[i] - yMean
      numerator += dx * dy
      xSumSq += dx * dx
      ySumSq += dy * dy
    }

    const denominator = Math.sqrt(xSumSq * ySumSq)
    const r = denominator > 0 ? numerator / denominator : 0
    const roundedR = Number(r.toFixed(2))

    return {
      judge,
      evalCount: n,
      correlation: roundedR,
      flagged: roundedR < -0.50 && n >= minEvaluations,
    }
  })
}

/**
 * 5. Inter-Judge Agreement Dispersion
 * Standard deviation of judge scores assigned to each team.
 * Tiers: High (>= 12.0), Medium (6.0 - 12.0), Low (< 6.0).
 */
export function calculateTeamAgreement(
  scores: EngineScoreRecord[],
  teams: EngineTeam[],
  judges: EngineJudge[],
  criteria: EngineCriterion[]
): TeamAgreementResult[] {
  return teams.map((team) => {
    const judgeTotals: Record<string, number> = {}
    const totals: number[] = []

    for (const judge of judges) {
      const tot = calculateJudgeTeamTotal(judge.id, team.id, scores, criteria)
      if (tot !== null) {
        judgeTotals[judge.id] = tot
        totals.push(tot)
      }
    }

    if (totals.length < 2) {
      const mean = totals.length === 1 ? totals[0] : 0
      return {
        team,
        judgeTotals,
        meanTotal: Number(mean.toFixed(2)),
        standardDeviation: 0,
        disagreementLevel: 'Low',
      }
    }

    const mean = totals.reduce((a, b) => a + b, 0) / totals.length
    const variance =
      totals.reduce((sum, val) => sum + Math.pow(val - mean, 2), 0) / totals.length
    const standardDeviation = Number(Math.sqrt(variance).toFixed(2))

    let disagreementLevel: 'High' | 'Medium' | 'Low' = 'Low'
    if (standardDeviation >= 12.0) {
      disagreementLevel = 'High'
    } else if (standardDeviation >= 6.0) {
      disagreementLevel = 'Medium'
    } else {
      disagreementLevel = 'Low'
    }

    return {
      team,
      judgeTotals,
      meanTotal: Number(mean.toFixed(2)),
      standardDeviation,
      disagreementLevel,
    }
  })
}

/**
 * 6. Counterfactual Sensitivity Reranking (Winner-Flip Simulator)
 */
export function calculateSensitivityRerank(
  scores: EngineScoreRecord[],
  teams: EngineTeam[],
  judges: EngineJudge[],
  criteria: EngineCriterion[],
  excludedJudgeIds: string[] = []
): SensitivityRerankResult {
  const baselineLeaderboard = calculateLeaderboard(scores, teams, judges, criteria, [])
  const simulatedLeaderboard = calculateLeaderboard(
    scores,
    teams,
    judges,
    criteria,
    excludedJudgeIds
  )

  const originalWinner = baselineLeaderboard[0] || null
  const newWinner = simulatedLeaderboard[0] || null

  const winnerChanged =
    Boolean(originalWinner && newWinner) &&
    originalWinner.team.id !== newWinner.team.id

  const baselineMap = new Map<string, LeaderboardRow>()
  baselineLeaderboard.forEach((r) => baselineMap.set(r.team.id, r))

  const teamDeltas: Record<string, { rankDelta: number; scoreDelta: number }> = {}

  simulatedLeaderboard.forEach((simRow) => {
    const baseRow = baselineMap.get(simRow.team.id)
    if (baseRow) {
      teamDeltas[simRow.team.id] = {
        rankDelta: baseRow.rank - simRow.rank, // e.g. base 2, sim 1 => +1 (moved up)
        scoreDelta: Number((simRow.totalScore - baseRow.totalScore).toFixed(2)),
      }
    }
  })

  return {
    baselineLeaderboard,
    simulatedLeaderboard,
    winnerChanged,
    originalWinner,
    newWinner,
    excludedJudgeIds,
    teamDeltas,
  }
}

/**
 * 7. Plain-English Fairness Summary Sentence
 */
export function generateFairnessSummarySentence(
  leniency: JudgeLeniencyResult[],
  drift: JudgeDriftResult[],
  sensitivity: SensitivityRerankResult,
  judges: EngineJudge[],
  teams: EngineTeam[]
): string {
  if (judges.length < 2) {
    return 'Insufficient judge count for comparative statistical panel telemetry.'
  }

  // Find most severe outlier: leniency first, then drift
  const leniencyOutlier = [...leniency]
    .filter((l) => l.flagged)
    .sort((a, b) => Math.abs(b.zScore) - Math.abs(a.zScore))[0]

  const driftOutlier = [...drift]
    .filter((d) => d.flagged)
    .sort((a, b) => a.correlation - b.correlation)[0]

  const primaryOutlier = leniencyOutlier || (driftOutlier ? {
    judge: driftOutlier.judge,
    meanTotal: 0,
    zScore: 0,
    flagged: true,
    evalCount: driftOutlier.evalCount
  } : null)

  if (!primaryOutlier) {
    return 'All judges scored within normal distribution bounds; panel consistency is strong across all criteria.'
  }

  const judge = primaryOutlier.judge
  const otherJudges = leniency.filter((l) => l.judge.id !== judge.id && l.evalCount > 0)
  const otherMean =
    otherJudges.length > 0
      ? otherJudges.reduce((acc, j) => acc + j.meanTotal, 0) / otherJudges.length
      : 0

  const judgeMean = leniency.find((l) => l.judge.id === judge.id)?.meanTotal ?? 0
  const diff = otherMean - judgeMean
  const isLower = diff > 0
  const absDiff = Math.abs(diff).toFixed(1)

  const origWinName = sensitivity.originalWinner?.team.name
  const newWinName = sensitivity.newWinner?.team.name

  if (sensitivity.winnerChanged && origWinName && newWinName) {
    return `${judge.name} scores ${absDiff} points ${
      isLower ? 'lower' : 'higher'
    } than the panel. Excluding ${judge.name} changes the winner from ${origWinName} to ${newWinName}.`
  }

  if (origWinName) {
    return `${judge.name} scores ${absDiff} points ${
      isLower ? 'lower' : 'higher'
    } than the panel, but excluding them does not alter the winning team (${origWinName}).`
  }

  return `${judge.name} scores ${absDiff} points ${
    isLower ? 'lower' : 'higher'
  } than the panel.`
}

/**
 * 8. Comprehensive Telemetry Aggregator
 */
export function computeFairnessTelemetry(
  scores: EngineScoreRecord[],
  teams: EngineTeam[],
  judges: EngineJudge[],
  criteria: EngineCriterion[]
): FairnessTelemetrySnapshot {
  const { results: leniency, grandMean, panelStdDev } = calculateJudgeLeniency(
    scores,
    teams,
    judges,
    criteria
  )

  const drift = calculateJudgeDrift(scores, teams, judges, criteria)
  const agreement = calculateTeamAgreement(scores, teams, judges, criteria)

  const flaggedJudgeIds = leniency
    .filter((l) => l.flagged)
    .map((l) => l.judge.id)

  const sensitivity = calculateSensitivityRerank(
    scores,
    teams,
    judges,
    criteria,
    flaggedJudgeIds
  )

  const summarySentence = generateFairnessSummarySentence(
    leniency,
    drift,
    sensitivity,
    judges,
    teams
  )

  const highDisagreementCount = agreement.filter(
    (a) => a.disagreementLevel === 'High'
  ).length

  return {
    summarySentence,
    grandMean,
    panelStdDev,
    leniency,
    drift,
    agreement,
    sensitivity,
    highDisagreementCount,
    flaggedJudgeCount: flaggedJudgeIds.length,
  }
}
