import { buildChain, verifyChain, sha256 } from '../src/lib/audit';
import { SEED_SCORES } from '../src/lib/data';

async function testAudit() {
  console.log('Building audit chain from seed scores...');
  const chain = await buildChain(SEED_SCORES);
  console.log(`Chain created with ${chain.length} entries.`);
  console.log(`Genesis hash: ${chain[0].hash.substring(0, 16)}...`);
  console.log(`Last hash: ${chain[chain.length - 1].hash.substring(0, 16)}...`);

  const initialVerification = await verifyChain(chain, SEED_SCORES);
  console.log('Initial verification valid:', initialVerification.valid);
  console.log('First broken index:', initialVerification.firstBrokenIndex);

  // Test tampering: modify a score in currentScores copy
  const tamperedScores = SEED_SCORES.map((s, idx) =>
    idx === 10 ? { ...s, score: s.score + 2 } : s
  );
  const tamperedVerification = await verifyChain(chain, tamperedScores);
  console.log('Tampered verification valid:', tamperedVerification.valid);
  console.log('First broken index on tamper:', tamperedVerification.firstBrokenIndex);
  console.log('Tamper status of row 10:', tamperedVerification.rows[10].status);
  console.log('Discrepancy:', tamperedVerification.rows[10].discrepancy);

  console.log('Audit test finished successfully.');
}

testAudit().catch(console.error);
