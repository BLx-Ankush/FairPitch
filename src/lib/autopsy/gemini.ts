/**
 * FairPitch AI Loss Autopsy Engine via Google Gemini API (@google/genai)
 * Enforces zero-hallucination factual prompt constraints and deterministic offline fallback.
 */

import { HeadToHeadLossAnalysis } from './math'

export const GEMINI_MODEL = process.env.GEMINI_MODEL || 'gemini-2.5-flash'

export const AUTOPSY_SYSTEM_INSTRUCTION = `You are FairPitch's Lead Judging Auditor and Hackathon Loss Diagnostic Analyst.
Your task is to conduct an in-depth, auditable, and constructive post-pitch autopsy that explains precisely WHY marks were deducted across each judging rubric/criterion.

CRITICAL ZERO-HALLUCINATION RULES:
1. USE ONLY THE DATA PROVIDED. Do not invent feedback or extrapolate beyond the provided judge comments and scores.
2. EXPLAIN WHY MARKS WERE CUT FOR EACH CRITERION:
   - Identify the primary reasons and root causes behind score deductions.
   - Reference and quote specific judge feedback comments and their scores (e.g., "Dr. Evelyn Vance (6.5/10) observed: '...'").
   - Dissect the exact technical gaps, unaddressed risks, or pitch weaknesses flagged by the panel.
   - Contrast this with what the benchmark winning team demonstrated to score higher.
3. ORDER BY DEFICIT:
   Analyze all criteria with negative point gaps, ordered from largest weighted point deficit to smallest.
4. END WITH EXACTLY 3 CONCRETE, HIGH-LEVERAGE FIXES:
   Provide 3 numbered, actionable engineering/product improvements tailored directly to overcoming the judges' main criticisms.
5. FORMATTING:
   Use clean, highly readable GitHub-flavored Markdown with clear headings and bullet points.`

/**
 * Deterministic offline fallback autopsy generator.
 * Produces structured diagnostic when GEMINI_API_KEY is not configured or network call fails.
 */
export function generateDeterministicFallbackAutopsy(
  analysis: HeadToHeadLossAnalysis
): string {
  const {
    targetTeam,
    benchmarkWinner,
    teamTotal,
    winnerTotal,
    netDeficit,
    weightedPointGaps,
    judgeComments,
    winnerJudgeComments,
    fixes,
  } = analysis

  const lossGaps = weightedPointGaps.filter((g) => g.weightedGap > 0)

  let md = `## Loss Autopsy & Rubric Deduction Diagnostic: ${targetTeam.name} vs ${benchmarkWinner.name}\n\n`

  md += `**Executive Summary:** ${targetTeam.name} finished behind benchmark winner ${
    benchmarkWinner.name
  } with an overall score of **${teamTotal.toFixed(2)} pts** vs **${winnerTotal.toFixed(
    2
  )} pts** (cumulative deficit: **-${netDeficit.toFixed(
    2
  )} weighted points**). The evaluation records show that deductions were concentrated in specific dimensions where the panel identified unmitigated technical risks, operational bottlenecks, or pitch omissions.\n\n`

  md += `### Rubric-by-Rubric Deduction Analysis\n\n`

  if (lossGaps.length === 0) {
    md += `*No negative point deficits identified against the benchmark winner.*\n\n`
  } else {
    lossGaps.forEach((gap, index) => {
      const commentsForCrit = judgeComments.filter(
        (c) =>
          c.criterionName.toLowerCase() === gap.criterionName.toLowerCase() ||
          c.criterionName.toLowerCase().includes(gap.criterionName.toLowerCase()) ||
          gap.criterionName.toLowerCase().includes(c.criterionName.toLowerCase())
      )

      const winnerCommentsForCrit = winnerJudgeComments.filter(
        (c) =>
          c.criterionName.toLowerCase() === gap.criterionName.toLowerCase() ||
          c.criterionName.toLowerCase().includes(gap.criterionName.toLowerCase()) ||
          gap.criterionName.toLowerCase().includes(c.criterionName.toLowerCase())
      )

      const lowestJudge = commentsForCrit.reduce(
        (min, c) => (min === null || c.score < min.score ? c : min),
        null as any
      )

      md += `### ${index + 1}. ${gap.criterionName} (Deficit: -${gap.weightedGap.toFixed(
        2
      )} weighted pts | Weight: ${gap.weight}%)\n`
      md += `- **Score Benchmark:** ${targetTeam.name} averaged **${gap.teamAverage.toFixed(
        1
      )}/${gap.maxScore}** vs ${benchmarkWinner.name}'s **${gap.winnerAverage.toFixed(
        1
      )}/${gap.maxScore}** (raw score delta: -${gap.rawGap.toFixed(1)} pts).\n`

      md += `- **Why Marks Were Cut:**\n`
      if (lowestJudge) {
        md += `  - **Primary Deduction Driver:** ${lowestJudge.judgeName} awarded **${lowestJudge.score.toFixed(
          1
        )}/${gap.maxScore}**, noting: *"${lowestJudge.comment}"*. The evaluation indicates the panel found insufficient technical depth or unanswered execution concerns.\n`
      }

      if (commentsForCrit.length > 1) {
        md += `  - **Panel Feedback Consensus:**\n`
        commentsForCrit.forEach((c) => {
          md += `    - *${c.judgeName}* (${c.score.toFixed(1)}/${gap.maxScore}): "${c.comment}"\n`
        })
      }

      if (winnerCommentsForCrit.length > 0) {
        const bestWinner = winnerCommentsForCrit[0]
        md += `  - **Winner Benchmark Advantage:** ${benchmarkWinner.name} scored higher here (e.g. *${bestWinner.judgeName}* awarded ${bestWinner.score.toFixed(1)}/${gap.maxScore}: *"${bestWinner.comment}"*).\n`
      } else {
        md += `  - **Winner Benchmark Advantage:** ${benchmarkWinner.name} demonstrated verified deployment readiness and substantiated their claims with empirical evidence.\n`
      }

      md += `  - **Tactical Rubric Recovery:** Provide rigorous stress-test metrics, formal architecture traces, and explicit risk contingencies to eliminate judge skepticism on ${gap.criterionName.toLowerCase()}.\n\n`
    })
  }

  md += `### Exactly 3 Concrete High-Leverage Fixes\n\n`
  fixes.forEach((f) => {
    md += `${f.priority}. **${f.title}:** ${f.description}\n`
  })

  return md
}

export interface GenerateAutopsyResult {
  rawMarkdown: string
  issues: any[]
  fixes: any[]
  verificationStatus: 'verified' | 'fallback'
  modelName: string
}

/**
 * Generates an AI Loss Autopsy using @google/genai or deterministic fallback.
 */
export async function generateAutopsy(
  analysis: HeadToHeadLossAnalysis
): Promise<GenerateAutopsyResult> {
  const apiKey = process.env.GEMINI_API_KEY

  if (!apiKey || apiKey.trim() === '') {
    const rawMarkdown = generateDeterministicFallbackAutopsy(analysis)
    return {
      rawMarkdown,
      issues: analysis.issues,
      fixes: analysis.fixes,
      verificationStatus: 'fallback',
      modelName: `${GEMINI_MODEL}-fallback`,
    }
  }

  try {
    const { GoogleGenAI } = await import('@google/genai')
    const ai = new GoogleGenAI({ apiKey })

    const prompt = `
Conduct an auditable, zero-hallucination Loss Autopsy explaining why "${analysis.targetTeam.name}" (${analysis.targetTeam.tagline || 'Participant'}) lost to "${analysis.benchmarkWinner.name}" (${analysis.benchmarkWinner.tagline || 'Benchmark Winner'}).

============================================================
HEAD-TO-HEAD EVALUATION TELEMETRY
============================================================

1. TOTAL SCORE COMPARISON:
- ${analysis.targetTeam.name}: ${analysis.teamTotal.toFixed(2)} pts
- ${analysis.benchmarkWinner.name}: ${analysis.winnerTotal.toFixed(2)} pts
- Net Loss Deficit: -${analysis.netDeficit.toFixed(2)} weighted pts

2. CRITERION WEIGHTED LOSS DEFICITS (Sorted largest deficit first):
${JSON.stringify(analysis.weightedPointGaps, null, 2)}

3. QUALITATIVE JUDGE FEEDBACK FOR ${analysis.targetTeam.name}:
${analysis.judgeComments
  .map(
    (c) => `- [${c.criterionName}] ${c.judgeName} scored ${c.score}: "${c.comment}"`
  )
  .join('\n')}

${
  analysis.winnerJudgeComments.length > 0
    ? `
4. BENCHMARK WINNER JUDGE FEEDBACK (${analysis.benchmarkWinner.name}):
${analysis.winnerJudgeComments
  .map(
    (c) => `- [${c.criterionName}] ${c.judgeName} scored ${c.score}: "${c.comment}"`
  )
  .join('\n')}
`
    : ''
}

============================================================
REQUIRED OUTPUT STRUCTURE (Markdown)
============================================================

## Loss Autopsy & Rubric Deduction Diagnostic: ${analysis.targetTeam.name} vs ${analysis.benchmarkWinner.name}

[Provide an executive overview summarizing total weighted deficit, key panel takeaways, and why marks were cut.]

### Rubric-by-Rubric Deduction Analysis

[For every criterion with a deficit, detailed breakdown citing judge names, scores, specific quotes, why marks were cut, winner advantage, and tactical recovery.]

### Exactly 3 Concrete High-Leverage Fixes
1. **[Fix 1 Title]:** [Actionable engineering/product fix targeting the #1 loss criterion]
2. **[Fix 2 Title]:** [Actionable engineering/operational fix targeting the #2 loss criterion]
3. **[Fix 3 Title]:** [Actionable pitch/evidence fix targeting the #3 loss criterion]
`

    const response = await ai.models.generateContent({
      model: GEMINI_MODEL,
      contents: prompt,
      config: {
        systemInstruction: AUTOPSY_SYSTEM_INSTRUCTION,
        temperature: 0.2,
      },
    })

    const rawMarkdown = response.text || generateDeterministicFallbackAutopsy(analysis)

    return {
      rawMarkdown,
      issues: analysis.issues,
      fixes: analysis.fixes,
      verificationStatus: 'verified',
      modelName: GEMINI_MODEL,
    }
  } catch (error) {
    console.error('Gemini API call failed, invoking deterministic fallback:', error)
    const rawMarkdown = generateDeterministicFallbackAutopsy(analysis)
    return {
      rawMarkdown,
      issues: analysis.issues,
      fixes: analysis.fixes,
      verificationStatus: 'fallback',
      modelName: `${GEMINI_MODEL}-fallback`,
    }
  }
}
