// src/lib/fairness/calibration.ts
// Pre-Event Judge Calibration Engine: Shifts FairPitch from post-hoc bias detection to proactive bias prevention.

export interface BenchmarkCase {
  id: string
  code: string
  title: string
  track: string
  summary: string
  problemStatement: string
  solutionArchitecture: string
  evidenceNotes: string
  expectedMedianScore: number // panel benchmark consensus
  criteriaExpected: Record<string, number>
}

export const BENCHMARK_CALIBRATION_CASES: BenchmarkCase[] = [
  {
    id: 'bench-01',
    code: 'CALIB-PROJECT-ALPHA',
    title: 'CloudMesh IoT Edge Router',
    track: 'Systems & Infrastructure',
    summary: 'Low-latency mesh routing firmware running on low-power RISC-V microcontrollers.',
    problemStatement: 'Remote emergency response units lose internet access in disaster zones.',
    solutionArchitecture: 'Decentralized gossip protocol with local SQLite buffering and auto-healing topology.',
    evidenceNotes: 'Working hardware prototype demonstrated on 4 nodes; clean C++ code in repository.',
    expectedMedianScore: 7.2,
    criteriaExpected: {
      technical: 8.0,
      originality: 7.0,
      impact: 7.5,
      presentation: 6.5,
    },
  },
  {
    id: 'bench-02',
    code: 'CALIB-PROJECT-BETA',
    title: 'NeuroVision Glaucoma Pre-Screener',
    track: 'AI & Healthcare',
    summary: 'Smartphone camera optic disc analysis for early-stage glaucoma screening without expensive fundus cameras.',
    problemStatement: 'Over 60% of rural glaucoma cases go undiagnosed until irreversible optic nerve damage occurs.',
    solutionArchitecture: 'Quantized MobileNetV3 with custom attention head trained on 12,000 anonymized fundus images.',
    evidenceNotes: '92.4% sensitivity verified against clinical ground truth; live demo tested on volunteer.',
    expectedMedianScore: 8.5,
    criteriaExpected: {
      technical: 8.8,
      originality: 9.0,
      impact: 8.7,
      presentation: 7.5,
    },
  },
  {
    id: 'bench-03',
    code: 'CALIB-PROJECT-GAMMA',
    title: 'DeFi Token Swap Dashboard',
    track: 'FinTech & Web3',
    summary: 'Next.js frontend interface for Uniswap liquidity pools with gas fee estimation.',
    problemStatement: 'DeFi users struggle with fragmented fee comparisons across multiple decentralized exchanges.',
    solutionArchitecture: 'Fork of standard Uniswap v3 interface with Infura RPC and basic React charts.',
    evidenceNotes: 'Slick visual design, but architecture is largely standard tutorial boilerplate with zero smart contract code.',
    expectedMedianScore: 5.4,
    criteriaExpected: {
      technical: 5.0,
      originality: 4.8,
      impact: 6.0,
      presentation: 7.2,
    },
  },
]

export interface JudgeCalibrationResult {
  judgeId: string
  judgeName: string
  isCalibrated: boolean
  evaluatedCount: number
  judgeMean: number
  benchmarkMean: number
  delta: number // judgeMean - benchmarkMean (positive = lenient, negative = harsh)
  zScore: number // standardized deviation from benchmark
  tendency: 'Well-Calibrated Baseline' | 'Systematic Leniency' | 'Systematic Harshness'
  reliabilityPercent: number // 0 - 100% (alignment with benchmark ranking order)
  recommendedOffset: number // suggested normalization adjustment
  statusBadgeColor: string
  evaluations: Array<{
    caseId: string
    caseCode: string
    givenScore: number
    benchmarkScore: number
    diff: number
  }>
}

/**
 * Computes baseline calibration telemetry for a judge given their evaluation scores on benchmark cases.
 */
export function evaluateJudgeCalibration(
  judgeId: string,
  judgeName: string,
  evaluations: Record<string, number> // caseId -> totalScore (out of 10 or 100)
): JudgeCalibrationResult {
  const cases = BENCHMARK_CALIBRATION_CASES
  const evaluatedKeys = Object.keys(evaluations).filter((k) => evaluations[k] !== undefined)
  const count = evaluatedKeys.length

  if (count === 0) {
    return {
      judgeId,
      judgeName,
      isCalibrated: false,
      evaluatedCount: 0,
      judgeMean: 0,
      benchmarkMean: 7.03,
      delta: 0,
      zScore: 0,
      tendency: 'Well-Calibrated Baseline',
      reliabilityPercent: 0,
      recommendedOffset: 0,
      statusBadgeColor: 'bg-slate-800 text-slate-400 border-slate-700',
      evaluations: [],
    }
  }

  let totalGiven = 0
  let totalBenchmark = 0
  const evalBreakdown: JudgeCalibrationResult['evaluations'] = []

  for (const c of cases) {
    const rawScore = evaluations[c.id]
    if (rawScore !== undefined) {
      // Normalize to 10 scale if passed as 100 scale
      const given = rawScore > 10 ? rawScore / 10 : rawScore
      const benchmark = c.expectedMedianScore
      totalGiven += given
      totalBenchmark += benchmark
      evalBreakdown.push({
        caseId: c.id,
        caseCode: c.code,
        givenScore: Number(given.toFixed(1)),
        benchmarkScore: benchmark,
        diff: Number((given - benchmark).toFixed(1)),
      })
    }
  }

  const judgeMean = Number((totalGiven / count).toFixed(2))
  const benchmarkMean = Number((totalBenchmark / count).toFixed(2))
  const delta = Number((judgeMean - benchmarkMean).toFixed(2))

  // Benchmark population standard deviation across cases ~ 1.2
  const benchmarkSigma = 1.2
  const zScore = Number((delta / benchmarkSigma).toFixed(2))

  let tendency: JudgeCalibrationResult['tendency'] = 'Well-Calibrated Baseline'
  let statusBadgeColor = 'bg-emerald-500/15 text-emerald-400 border-emerald-500/30'

  if (delta > 0.6) {
    tendency = 'Systematic Leniency'
    statusBadgeColor = 'bg-amber-500/15 text-amber-400 border-amber-500/30'
  } else if (delta < -0.6) {
    tendency = 'Systematic Harshness'
    statusBadgeColor = 'bg-red-500/15 text-red-400 border-red-500/30'
  }

  // Calculate ranking consistency (Did they score Beta > Alpha > Gamma?)
  let rankOrderScore = 100
  const beta = evaluations['bench-02']
  const alpha = evaluations['bench-01']
  const gamma = evaluations['bench-03']

  if (beta !== undefined && alpha !== undefined && beta < alpha) rankOrderScore -= 20
  if (alpha !== undefined && gamma !== undefined && alpha < gamma) rankOrderScore -= 40
  if (beta !== undefined && gamma !== undefined && beta < gamma) rankOrderScore -= 40

  const reliabilityPercent = Math.max(0, rankOrderScore)
  const recommendedOffset = Number((-delta).toFixed(1))

  return {
    judgeId,
    judgeName,
    isCalibrated: count >= 3,
    evaluatedCount: count,
    judgeMean,
    benchmarkMean,
    delta,
    zScore,
    tendency,
    reliabilityPercent,
    recommendedOffset,
    statusBadgeColor,
    evaluations: evalBreakdown,
  }
}
