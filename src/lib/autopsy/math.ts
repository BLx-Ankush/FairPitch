/**
 * FairPitch Head-to-Head Criterion Deficit & Mathematical Loss Attribution Engine
 */

export interface AutopsyCriterion {
  id: string
  name: string
  weight: number
  max_score: number
}

export interface AutopsyTeam {
  id: string
  name: string
  tagline?: string
  track?: string
}

export interface AutopsyScoreRecord {
  team_id: string
  judge_id: string
  criterion_id: string
  score: number
  comment?: string
  version?: number
}

export interface AutopsyJudge {
  id: string
  name: string
}

export interface WeightedDeficit {
  criterionId: string
  criterionName: string
  weight: number
  maxScore: number
  teamAverage: number
  winnerAverage: number
  rawGap: number
  weightedGap: number
}

export interface AutopsyJudgeComment {
  judgeName: string
  criterionName: string
  score: number
  comment: string
}

export interface HeadToHeadLossAnalysis {
  targetTeam: AutopsyTeam
  benchmarkWinner: AutopsyTeam
  teamTotal: number
  winnerTotal: number
  netDeficit: number
  weightedPointGaps: WeightedDeficit[]
  teamCriterionAverages: Record<string, number>
  winnerCriterionAverages: Record<string, number>
  judgeComments: AutopsyJudgeComment[]
  winnerJudgeComments: AutopsyJudgeComment[]
  primaryDeficitCriterion: WeightedDeficit | null
  issues: {
    criterionName: string
    weightedGap: number
    summary: string
  }[]
  fixes: {
    priority: number
    title: string
    description: string
  }[]
}

/**
 * Computes head-to-head criterion deficits and rank-ordered gap attribution
 * between a participant team and the benchmark 1st-place winner.
 */
export function computeHeadToHeadAnalysis(
  targetTeam: AutopsyTeam,
  benchmarkWinner: AutopsyTeam,
  scores: AutopsyScoreRecord[],
  criteria: AutopsyCriterion[],
  judges: AutopsyJudge[]
): HeadToHeadLossAnalysis {
  const judgeMap = new Map<string, string>()
  judges.forEach((j) => judgeMap.set(j.id, j.name))

  const targetScores = scores.filter((s) => s.team_id === targetTeam.id)
  const winnerScores = scores.filter((s) => s.team_id === benchmarkWinner.id)

  const teamCriterionAverages: Record<string, number> = {}
  const winnerCriterionAverages: Record<string, number> = {}
  const weightedPointGaps: WeightedDeficit[] = []

  let teamTotal = 0
  let winnerTotal = 0

  for (const c of criteria) {
    const maxScore = c.max_score > 0 ? c.max_score : 10

    // Target team scores for this criterion
    const tScores = targetScores.filter((s) => s.criterion_id === c.id)
    const tAvg =
      tScores.length > 0
        ? tScores.reduce((sum, s) => sum + s.score, 0) / tScores.length
        : 0
    teamCriterionAverages[c.id] = Number(tAvg.toFixed(2))
    teamTotal += (tAvg / maxScore) * c.weight

    // Winner team scores for this criterion
    const wScores = winnerScores.filter((s) => s.criterion_id === c.id)
    const wAvg =
      wScores.length > 0
        ? wScores.reduce((sum, s) => sum + s.score, 0) / wScores.length
        : 0
    winnerCriterionAverages[c.id] = Number(wAvg.toFixed(2))
    winnerTotal += (wAvg / maxScore) * c.weight

    const rawGap = Number((wAvg - tAvg).toFixed(2))
    const weightedGap = Number(((rawGap / maxScore) * c.weight).toFixed(2))

    weightedPointGaps.push({
      criterionId: c.id,
      criterionName: c.name,
      weight: c.weight,
      maxScore,
      teamAverage: Number(tAvg.toFixed(2)),
      winnerAverage: Number(wAvg.toFixed(2)),
      rawGap,
      weightedGap,
    })
  }

  // Sort criteria from largest weighted deficit to smallest
  weightedPointGaps.sort((a, b) => b.weightedGap - a.weightedGap)

  // Map qualitative comments
  const criteriaNameMap = new Map<string, string>()
  criteria.forEach((c) => criteriaNameMap.set(c.id, c.name))

  const judgeComments: AutopsyJudgeComment[] = targetScores
    .filter((s) => s.comment && s.comment.trim().length > 0)
    .map((s) => ({
      judgeName: judgeMap.get(s.judge_id) || 'Panel Evaluator',
      criterionName: criteriaNameMap.get(s.criterion_id) || 'Criterion',
      score: s.score,
      comment: s.comment!.trim(),
    }))

  const winnerJudgeComments: AutopsyJudgeComment[] = winnerScores
    .filter((s) => s.comment && s.comment.trim().length > 0)
    .map((s) => ({
      judgeName: judgeMap.get(s.judge_id) || 'Panel Evaluator',
      criterionName: criteriaNameMap.get(s.criterion_id) || 'Criterion',
      score: s.score,
      comment: s.comment!.trim(),
    }))

  // Extract top issues (criteria where team lost points)
  const lossCriteria = weightedPointGaps.filter((g) => g.weightedGap > 0)
  const primaryDeficitCriterion = lossCriteria[0] || null

  const issues = lossCriteria.slice(0, 3).map((g) => {
    const relatedComments = judgeComments.filter(
      (c) => c.criterionName.toLowerCase() === g.criterionName.toLowerCase()
    )
    const critiqueQuote = relatedComments[0]
      ? `Judge noted: "${relatedComments[0].comment}"`
      : `Scored ${g.rawGap} points behind benchmark.`

    return {
      criterionName: g.criterionName,
      weightedGap: g.weightedGap,
      summary: `Deficit of ${g.weightedGap} weighted points (${g.teamAverage}/${g.maxScore} vs ${g.winnerAverage}/${g.maxScore}). ${critiqueQuote}`,
    }
  })

  // Extract exactly 3 concrete fixes
  const fixes = [
    {
      priority: 1,
      title: lossCriteria[0]
        ? `Remediate ${lossCriteria[0].criterionName} Deficit (-${lossCriteria[0].weightedGap} pts)`
        : 'Deepen Core Architecture',
      description: lossCriteria[0]
        ? `Directly address panel critique on ${lossCriteria[0].criterionName.toLowerCase()} by replacing surface-level mockups with verified algorithmic implementation and benchmark performance data.`
        : 'Replace boilerplate components with proprietary algorithmic logic.',
    },
    {
      priority: 2,
      title: lossCriteria[1]
        ? `Strengthen ${lossCriteria[1].criterionName} Validation (-${lossCriteria[1].weightedGap} pts)`
        : 'Validate Feasibility & Unit Economics',
      description: lossCriteria[1]
        ? `Provide formal edge-case failure mitigation and concrete deployment evidence to eliminate judge skepticism on ${lossCriteria[1].criterionName.toLowerCase()}.`
        : 'Formalize failure recovery mechanisms and verify operational scalability.',
    },
    {
      priority: 3,
      title: lossCriteria[2]
        ? `Quantify Proof-of-Concept for ${lossCriteria[2].criterionName} (-${lossCriteria[2].weightedGap} pts)`
        : 'Live Telemetry Demonstration',
      description: lossCriteria[2]
        ? `Replace subjective claims with real-time hardware telemetry and end-to-end trace logs during presentation.`
        : 'Demonstrate live verifiable metrics rather than static slideshow claims.',
    },
  ]

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
    primaryDeficitCriterion,
    issues,
    fixes,
  }
}
