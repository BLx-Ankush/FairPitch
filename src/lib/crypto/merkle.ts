/**
 * FairPitch Cryptographic Merkle Root & Dual-Layer Verification Engine
 * Implements the exact binary Merkle tree algorithm with the Odd-Leaf duplication rule.
 */

import { createHash } from 'crypto'

export function sha256(data: string): string {
  return createHash('sha256').update(data).digest('hex')
}

/**
 * Builds binary Merkle tree from leaf hashes using the Odd-Leaf duplication rule.
 * Matches Postgres RPC public.compute_event_merkle_root.
 */
export function computeMerkleRoot(leaves: string[], eventId?: string): string {
  if (!leaves || leaves.length === 0) {
    return sha256(eventId ? `GENESIS_ROOT:${eventId}` : 'GENESIS_ROOT')
  }

  // Sort leaves lexicographically as specified in database procedure
  let currentLevel = [...leaves].sort((a, b) => a.localeCompare(b))

  while (currentLevel.length > 1) {
    const nextLevel: string[] = []
    let len = currentLevel.length

    // Odd-leaf rule: duplicate last leaf if odd count
    if (len % 2 === 1) {
      currentLevel.push(currentLevel[len - 1])
      len += 1
    }

    for (let i = 0; i < len; i += 2) {
      const left = currentLevel[i]
      const right = currentLevel[i + 1]
      const combined = sha256(left + right)
      nextLevel.push(combined)
    }

    currentLevel = nextLevel
  }

  return currentLevel[0]
}

export interface AuditBlock {
  block_index: number
  prev_hash: string
  current_hash: string
  payload: any
  action: string
  created_at: string
}

export interface JudgeChainVerification {
  judgeId: string
  judgeName?: string
  isValid: boolean
  totalBlocks: number
  chainHeadHash: string
  errorReason?: string
}

export interface DualLayerVerificationResult {
  eventId: string
  anchoredMerkleRoot: string | null
  computedMerkleRoot: string
  isMerkleRootValid: boolean
  areJudgeChainsValid: boolean
  overallIntegrity: boolean
  judgeChains: JudgeChainVerification[]
  eventChainValid: boolean
  totalAuditBlocks: number
  verifiedAt: string
}

/**
 * Verifies a single sequential hash chain (judge chain or event-level chain).
 */
export function verifyChainBlocks(blocks: AuditBlock[]): {
  isValid: boolean
  brokenBlockIndex: number | null
  errorReason?: string
  headHash: string
} {
  if (blocks.length === 0) {
    return { isValid: true, brokenBlockIndex: null, headHash: 'GENESIS' }
  }

  const sorted = [...blocks].sort((a, b) => a.block_index - b.block_index)
  let expectedPrev = 'GENESIS'

  for (let i = 0; i < sorted.length; i++) {
    const b = sorted[i]

    if (b.block_index !== i) {
      return {
        isValid: false,
        brokenBlockIndex: b.block_index,
        errorReason: `Block index sequence gap at index ${b.block_index}`,
        headHash: b.current_hash,
      }
    }

    if (b.prev_hash !== expectedPrev) {
      return {
        isValid: false,
        brokenBlockIndex: b.block_index,
        errorReason: `Broken previous hash pointer at block ${b.block_index}`,
        headHash: b.current_hash,
      }
    }

    expectedPrev = b.current_hash
  }

  return {
    isValid: true,
    brokenBlockIndex: null,
    headHash: sorted[sorted.length - 1].current_hash,
  }
}
