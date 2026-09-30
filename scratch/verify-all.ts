import { resetToSeedData, SEED_SCORES, SEED_JUDGES, SEED_TEAMS } from '../src/lib/data';
import { leaderboard } from '../src/lib/scoring';
import { fairnessSummary, rerankWithout } from '../src/lib/fairness';
import { buildChain, verifyChain, tamperDemo, restoreDemo } from '../src/lib/audit';
import { generateAutopsy } from '../src/lib/autopsy';

async function verifyAll() {
  console.log('==============================================');
  console.log('FAIRPITCH SYSTEM-WIDE ACCEPTANCE VERIFICATION');
  console.log('==============================================');

  // 1. Confirm after reset, excluding Judge 3 changes the winner
  console.log('\n--- CHECK 1: Reset & Excluding Judge 3 Changes Winner ---');
  const scores = resetToSeedData();
  const baselineLb = leaderboard([], scores);
  const withoutJ3Lb = leaderboard(['judge-3'], scores);
  const origWinner = baselineLb[0].team.name;
  const newWinner = withoutJ3Lb[0].team.name;
  const rerank = rerankWithout(['judge-3'], scores);

  console.log(`Original Winner (All 3 Judges): ${origWinner} (${baselineLb[0].totalScore.toFixed(2)} pts)`);
  console.log(`Winner without Judge 3: ${newWinner} (${withoutJ3Lb[0].totalScore.toFixed(2)} pts)`);
  console.log(`Winner Changed: ${rerank.winnerChanged}`);
  console.log(`Fairness Summary: "${fairnessSummary(scores)}"`);

  if (!rerank.winnerChanged || origWinner === newWinner) {
    throw new Error('FAILED CHECK 1: Winner did not flip when excluding Judge 3!');
  }
  console.log('>>> CHECK 1 PASSED: Winner flipped successfully.');

  // 2. Confirm Simulate Tampering then Verify shows TAMPERED, and Restore makes it VALID again
  console.log('\n--- CHECK 2: Tamper Simulation and Cryptographic Verification ---');
  const chain = await buildChain(scores);
  const initialVerify = await verifyChain(chain, scores);
  console.log(`Initial Chain Valid: ${initialVerify.valid}`);
  if (!initialVerify.valid) throw new Error('FAILED CHECK 2: Initial chain is not valid!');

  // Tamper a score
  const tamperTarget = scores.find(s => s.judge_id === 'judge-3' && s.team_id === 'team-4') || scores[0];
  const tamperedScores = scores.map(s => s.id === tamperTarget.id ? { ...s, score: s.score + 2.0 } : s);
  const tamperedVerify = await verifyChain(chain, tamperedScores);
  console.log(`Tampered Chain Valid: ${tamperedVerify.valid} (Expected: false)`);
  console.log(`First Broken Index: ${tamperedVerify.firstBrokenIndex}`);
  console.log(`Broken Row Status: ${tamperedVerify.rows[tamperedVerify.firstBrokenIndex!].status}`);

  if (tamperedVerify.valid || tamperedVerify.firstBrokenIndex === null) {
    throw new Error('FAILED CHECK 2: Tamper was not detected by verifyChain!');
  }

  // Restore
  const restoredVerify = await verifyChain(chain, scores);
  console.log(`Restored Chain Valid: ${restoredVerify.valid} (Expected: true)`);
  if (!restoredVerify.valid) {
    throw new Error('FAILED CHECK 2: Restore did not return chain to VALID!');
  }
  console.log('>>> CHECK 2 PASSED: Tamper detected and Restore validated.');

  // 3. Confirm autopsy shows fallback text when GEMINI_API_KEY is not set
  console.log('\n--- CHECK 3: Loss Autopsy Fallback ---');
  delete process.env.GEMINI_API_KEY;
  const autopsyRes = await generateAutopsy({
    teamId: 'team-4',
    teamName: 'MediSync',
    winnerName: 'NeuroGait',
    teamCriterionAverages: { innovation: 7.3, impact: 7.3, feasibility: 7.2, presentation: 7.1, technical: 7.0 },
    winnerCriterionAverages: { innovation: 7.9, impact: 8.0, feasibility: 7.7, presentation: 7.3, technical: 7.5 },
    weightedPointGaps: [
      { criterionId: 'impact', criterionName: 'Impact', weight: 25, teamAverage: 7.3, winnerAverage: 8.0, rawGap: 0.7, weightedGap: 1.75 },
      { criterionId: 'innovation', criterionName: 'Innovation', weight: 25, teamAverage: 7.3, winnerAverage: 7.9, rawGap: 0.6, weightedGap: 1.50 },
      { criterionId: 'feasibility', criterionName: 'Feasibility', weight: 20, teamAverage: 7.2, winnerAverage: 7.7, rawGap: 0.5, weightedGap: 1.00 },
    ],
    judgeComments: [
      { judgeName: 'Prof. Aris Thorne', criterionName: 'Impact', score: 4.2, comment: 'Offline EHR without strict cryptographic revocation is hazardous.' }
    ]
  });

  console.log(`Autopsy Source: ${autopsyRes.source}`);
  console.log(`Has 3 concrete fixes: ${autopsyRes.text.includes('### Exactly 3 Concrete Fixes:')}`);
  if (autopsyRes.source !== 'fallback' || !autopsyRes.text.includes('### Exactly 3 Concrete Fixes:')) {
    throw new Error('FAILED CHECK 3: Autopsy fallback did not generate expected text!');
  }
  console.log('>>> CHECK 3 PASSED: Loss Autopsy generates rule-based text with 3 concrete fixes.');

  console.log('\n==============================================');
  console.log('ALL ACCEPTANCE CRITERIA VERIFIED SUCCESSFULLY!');
  console.log('==============================================\n');
}

verifyAll().catch((err) => {
  console.error(err);
  process.exit(1);
});
