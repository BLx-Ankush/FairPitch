export const GEMINI_MODEL = 'gemini-2.5-flash';

export const AUTOPSY_SYSTEM_INSTRUCTION = `You are FairPitch's Lead Judging Auditor and Hackathon Loss Diagnostic Analyst.
Your task is to conduct an in-depth, auditable, and constructive post-pitch autopsy that explains precisely WHY marks were deducted across each judging rubric/criterion.

CRITICAL REQUIREMENTS:
1. EXPLAIN IN DETAIL WHY MARKS WERE CUT FOR EACH CRITERION:
   Do NOT simply state point gaps or numbers. For each rubric criterion where the team lost points:
   - Identify the primary reasons and root causes behind the score deductions.
   - Reference and quote specific judge feedback comments and their individual scores (e.g., "Dr. Evelyn Vance (6.5/10) observed: '...'").
   - Dissect the exact technical gaps, unaddressed risks, architectural shortcuts, or pitch weaknesses flagged by the panel.
   - Contrast this with what the benchmark winning team demonstrated to score higher.
   - Provide a targeted, criterion-specific tactical recommendation to prevent deductions in that category.
2. COVER ALL RUBRIC DEFICITS:
   Analyze all criteria with negative point gaps, ordered from largest weighted point deficit to smallest.
3. CONCLUDE WITH EXACTLY 3 CONCRETE, HIGH-LEVERAGE FIXES:
   Provide 3 actionable, numbered engineering/product improvements tailored directly to overcoming the judges' main criticisms.
4. FORMATTING:
   Use clean, highly readable Markdown with structured subheadings, bullet points, bold key terms, and numbered fix recommendations.`;

export interface WeightedGapInput {
  criterionId: string;
  criterionName: string;
  weight: number;
  teamAverage: number;
  winnerAverage: number;
  rawGap: number;
  weightedGap: number;
}

export interface JudgeCommentInput {
  judgeName: string;
  criterionName: string;
  score: number;
  comment: string;
}

export interface AutopsyRequestPayload {
  teamId: string;
  teamName: string;
  teamTagline?: string;
  teamTrack?: string;
  winnerName: string;
  winnerTagline?: string;
  winnerTrack?: string;
  teamCriterionAverages: Record<string, number>;
  winnerCriterionAverages: Record<string, number>;
  weightedPointGaps: WeightedGapInput[];
  judgeComments: JudgeCommentInput[];
  winnerJudgeComments?: JudgeCommentInput[];
  forceRefresh?: boolean;
}

// In-memory cache per team (versioned to avoid stale formats)
const CACHE_VERSION_PREFIX = 'v3_';
const autopsyMemoryCache = new Map<string, string>();

/**
 * Detailed deterministic fallback autopsy when GEMINI_API_KEY is not configured
 * or network request fails. Diagnoses why marks were cut for every rubric.
 */
export function generateFallbackAutopsy(payload: AutopsyRequestPayload): string {
  const {
    teamName,
    teamTagline,
    winnerName,
    winnerTagline,
    weightedPointGaps,
    judgeComments,
    winnerJudgeComments = [],
  } = payload;

  // Filter criteria where team lost points, sorted largest deficit first
  const lossGaps = [...weightedPointGaps]
    .filter((g) => g.weightedGap > 0)
    .sort((a, b) => b.weightedGap - a.weightedGap);

  const totalWeightedLoss = lossGaps
    .reduce((sum, g) => sum + g.weightedGap, 0)
    .toFixed(2);

  let md = `## Loss Autopsy & Rubric Deduction Diagnostic: ${teamName} vs ${winnerName}\n\n`;

  md += `**Executive Summary:** ${teamName}${
    teamTagline ? ` (*"${teamTagline}"*)` : ''
  } finished behind benchmark winner ${winnerName}${
    winnerTagline ? ` (*"${winnerTagline}"*)` : ''
  } with a cumulative deficit of **${totalWeightedLoss} weighted points** across judging criteria. Rather than an aggregate deficit, marks were systematically deducted due to specific architectural shortcuts, unmitigated operational risks, and pitch positioning flagged during judging.\n\n`;

  md += `### Rubric-by-Rubric Deduction Analysis\n\n`;

  lossGaps.forEach((gap, index) => {
    const commentsForCrit = judgeComments.filter(
      (c) =>
        c.criterionName.toLowerCase() === gap.criterionName.toLowerCase() ||
        c.criterionName.toLowerCase().includes(gap.criterionName.toLowerCase()) ||
        gap.criterionName.toLowerCase().includes(c.criterionName.toLowerCase())
    );

    const winnerCommentsForCrit = winnerJudgeComments.filter(
      (c) =>
        c.criterionName.toLowerCase() === gap.criterionName.toLowerCase() ||
        c.criterionName.toLowerCase().includes(gap.criterionName.toLowerCase()) ||
        gap.criterionName.toLowerCase().includes(c.criterionName.toLowerCase())
    );

    // Identify lowest scoring judge to highlight primary penalty driver
    const lowestJudge = commentsForCrit.reduce(
      (min, c) => (min === null || c.score < min.score ? c : min),
      null as JudgeCommentInput | null
    );

    md += `### ${index + 1}. ${gap.criterionName} (Deficit: -${gap.weightedGap.toFixed(2)} weighted pts | Weight: ${gap.weight}%)\n`;
    md += `- **Score Benchmark:** ${teamName} averaged **${gap.teamAverage.toFixed(1)}/10** vs ${winnerName}'s **${gap.winnerAverage.toFixed(1)}/10** (raw score delta: -${gap.rawGap.toFixed(1)} pts).\n`;
    
    // Detailed deduction rationale
    md += `- **Why Marks Were Cut:**\n`;
    if (lowestJudge) {
      md += `  - **Primary Deduction Driver:** ${lowestJudge.judgeName} awarded only **${lowestJudge.score.toFixed(1)}/10**, critiquing: *"${lowestJudge.comment}"*. This indicates the panel felt the implementation lacked sufficient technical differentiation or failed to address critical operational bottlenecks.\n`;
    }
    
    if (commentsForCrit.length > 1) {
      md += `  - **Panel Feedback Consensus:**\n`;
      commentsForCrit.forEach((c) => {
        md += `    - *${c.judgeName}* (${c.score.toFixed(1)}/10): "${c.comment}"\n`;
      });
    }

    // Benchmark comparison
    if (winnerCommentsForCrit.length > 0) {
      const bestWinnerComment = winnerCommentsForCrit[0];
      md += `  - **Winner Benchmark Advantage:** ${winnerName} secured high marks here (e.g., *${bestWinnerComment.judgeName}* scored ${bestWinnerComment.score.toFixed(1)}/10 noting: *"${bestWinnerComment.comment}"*).\n`;
    } else {
      md += `  - **Winner Benchmark Advantage:** ${winnerName} demonstrated greater technical depth and validated deployment readiness, leaving no unanswered skepticism.\n`;
    }

    // Rubric-specific recommendation
    md += `  - **Rubric Recovery Strategy:** Provide rigorous empirical data, stress-testing telemetry, and explicit risk-contingency protocols to eliminate judge skepticism on ${gap.criterionName.toLowerCase()}.\n\n`;
  });

  md += `### Exactly 3 Concrete High-Leverage Fixes\n\n`;

  if (lossGaps.length >= 1) {
    const g1 = lossGaps[0];
    const critComments = judgeComments.filter((c) =>
      c.criterionName.toLowerCase().includes(g1.criterionName.toLowerCase())
    );
    const keyCritique = critComments[0]?.comment || 'core architectural depth';
    md += `1. **Overhaul ${g1.criterionName} Architecture (Deficit: -${g1.weightedGap.toFixed(2)} pts):** Directly resolve the primary critique (*"${keyCritique}"*) by introducing proprietary algorithmic intelligence or automated distributed processing to transcend standard CRUD patterns.\n`;
  } else {
    md += `1. **Deepen Core Algorithmic Architecture:** Replace off-the-shelf components with customized predictive models or distributed consensus logic.\n`;
  }

  if (lossGaps.length >= 2) {
    const g2 = lossGaps[1];
    const critComments = judgeComments.filter((c) =>
      c.criterionName.toLowerCase().includes(g2.criterionName.toLowerCase())
    );
    const keyCritique = critComments[0]?.comment || 'operational sustainability';
    md += `2. **De-risk ${g2.criterionName} & Feasibility (Deficit: -${g2.weightedGap.toFixed(2)} pts):** Address judge concerns around *"${keyCritique}"* by presenting a formalized operational framework with verified unit economics and failure-mode mitigation.\n`;
  } else {
    md += `2. **Formalize Operational & Compliance Safeguards:** Provide comprehensive risk matrices and verifiable third-party certification roadmaps.\n`;
  }

  if (lossGaps.length >= 3) {
    const g3 = lossGaps[2];
    md += `3. **Evidence-Based Pitch Demonstration for ${g3.criterionName} (Deficit: -${g3.weightedGap.toFixed(2)} pts):** Replace subjective claims with quantitative benchmark telemetry and live system traces during judge Q&A.\n`;
  } else {
    md += `3. **Quantify Proof-of-Concept Metrics:** Back all pitch claims with real-time hardware telemetry or high-throughput load benchmark results.\n`;
  }

  return md;
}

/**
 * Executes the Loss Autopsy analysis.
 * Uses Google Gemini API with system instructions if GEMINI_API_KEY is present.
 * Uses in-memory cache per team, falls back to comprehensive rule-based diagnostic on error or missing key.
 */
export async function generateAutopsy(
  payload: AutopsyRequestPayload
): Promise<{ text: string; source: 'gemini' | 'cache' | 'fallback' }> {
  const cacheKey = `${CACHE_VERSION_PREFIX}${payload.teamId}`;

  // Check memory cache first (unless forceRefresh is requested)
  if (!payload.forceRefresh && autopsyMemoryCache.has(cacheKey)) {
    return {
      text: autopsyMemoryCache.get(cacheKey)!,
      source: 'cache',
    };
  }

  const apiKey = process.env.GEMINI_API_KEY;

  if (!apiKey || apiKey.trim() === '') {
    const fallbackText = generateFallbackAutopsy(payload);
    autopsyMemoryCache.set(cacheKey, fallbackText);
    return {
      text: fallbackText,
      source: 'fallback',
    };
  }

  try {
    const { GoogleGenAI } = await import('@google/genai');
    const ai = new GoogleGenAI({ apiKey });

    const prompt = `
Conduct a thorough, highly detailed Loss Autopsy explaining why "${payload.teamName}" (${payload.teamTagline || payload.teamTrack || 'Participant'}) lost to "${payload.winnerName}" (${payload.winnerTagline || payload.winnerTrack || 'Benchmark Winner'}).

The student wants to understand EXACTLY WHY MARKS WERE CUT in each rubric criterion, referencing specific judge feedback, score deficits, and what the winner did better.

============================================================
EVALUATION DATA
============================================================

1. CRITERION WEIGHTED LOSS MARGINS (Sorted from largest deficit to smallest):
${JSON.stringify(payload.weightedPointGaps, null, 2)}

2. AVERAGE SCORES (out of 10):
- ${payload.teamName}: ${JSON.stringify(payload.teamCriterionAverages, null, 2)}
- ${payload.winnerName} (Winner): ${JSON.stringify(payload.winnerCriterionAverages, null, 2)}

3. QUALITATIVE JUDGE FEEDBACK & SCORES FOR ${payload.teamName}:
${payload.judgeComments
  .map(
    (c) =>
      `- [${c.criterionName}] ${c.judgeName} scored ${c.score}/10: "${c.comment}"`
  )
  .join('\n')}

${
  payload.winnerJudgeComments && payload.winnerJudgeComments.length > 0
    ? `
4. BENCHMARK WINNER JUDGE FEEDBACK (${payload.winnerName}):
${payload.winnerJudgeComments
  .map(
    (c) =>
      `- [${c.criterionName}] ${c.judgeName} scored ${c.score}/10: "${c.comment}"`
  )
  .join('\n')}
`
    : ''
}

============================================================
OUTPUT STRUCTURE REQUIREMENTS
============================================================

Format your response in GitHub-flavored Markdown following this exact structure:

## Loss Autopsy & Rubric Deduction Diagnostic: ${payload.teamName} vs ${payload.winnerName}

Provide an executive overview summarizing the total weighted point gap, the overall narrative of the judging panel, and the primary reason the project fell behind the benchmark winner.

### Rubric-by-Rubric Deduction Analysis

For EVERY criterion where ${payload.teamName} lost points (ordered from largest weighted deficit to smallest):
### [Number]. [Criterion Name] (Deficit: -[X.XX] weighted pts | Weight: [W]%)
- **Score Benchmark:** ${payload.teamName} averaged **[TeamAvg]/10** vs ${payload.winnerName}'s **[WinnerAvg]/10** (raw score delta: -[RawGap] pts).
- **Why Marks Were Cut:** Provide a deep, insightful qualitative breakdown of the exact weaknesses, unaddressed questions, or omissions that led judges to reduce marks.
- **Judge Feedback & Criticisms:** Cite each judge's specific comments and score for this criterion, explaining what each judge found lacking or concerning.
- **Winner Advantage:** Explain what ${payload.winnerName} did to score higher in this category.
- **Tactical Rubric Fix:** A concrete recommendation to eliminate deductions in this rubric next time.

### Exactly 3 Concrete High-Leverage Fixes
1. **[Fix 1 Title]:** [Detailed actionable engineering or product fix targeting the #1 loss criterion]
2. **[Fix 2 Title]:** [Detailed actionable engineering or operational fix targeting the #2 loss criterion]
3. **[Fix 3 Title]:** [Detailed actionable pitch/evidence fix targeting the #3 loss criterion]
`;

    const response = await ai.models.generateContent({
      model: GEMINI_MODEL,
      contents: prompt,
      config: {
        systemInstruction: AUTOPSY_SYSTEM_INSTRUCTION,
        temperature: 0.3,
      },
    });

    const outputText = response.text || generateFallbackAutopsy(payload);
    autopsyMemoryCache.set(cacheKey, outputText);

    return {
      text: outputText,
      source: 'gemini',
    };
  } catch (error) {
    console.error('Gemini API call failed, falling back to rule-based diagnostic:', error);
    const fallback = generateFallbackAutopsy(payload);
    autopsyMemoryCache.set(cacheKey, fallback);
    return {
      text: fallback,
      source: 'fallback',
    };
  }
}

export function clearAutopsyCache(): void {
  autopsyMemoryCache.clear();
}
