import { NextResponse } from 'next/server'
import { getServiceSupabase } from '@/lib/supabase/service-role'
import {
  computeMerkleRoot,
  verifyChainBlocks,
  JudgeChainVerification,
} from '@/lib/crypto/merkle'

export async function GET(
  request: Request,
  { params }: { params: Promise<{ eventId: string }> }
) {
  try {
    const { eventId } = await params
    const serviceClient = getServiceSupabase()

    // 1. Fetch event metadata
    const { data: event, error: eventErr } = await serviceClient
      .from('events')
      .select('id, title, slug, status, anchored_merkle_root, anchored_at')
      .eq('id', eventId)
      .single()

    if (eventErr || !event) {
      return NextResponse.json({ error: 'Event not found' }, { status: 404 })
    }

    // 2. Fetch all audit log blocks for this event
    const { data: blocks, error: blockErr } = await serviceClient
      .from('audit_log')
      .select(
        'block_index, prev_hash, current_hash, payload, action, created_at, judge_id, profiles:judge_id(full_name)'
      )
      .eq('event_id', eventId)
      .order('block_index', { ascending: true })

    if (blockErr) {
      return NextResponse.json({ error: blockErr.message }, { status: 500 })
    }

    const allBlocks = blocks || []

    // Group blocks by judge_id (and event-level chain where judge_id is null)
    const judgeBlocksMap = new Map<string, any[]>()
    const eventBlocks: any[] = []
    const judgeNameMap = new Map<string, string>()

    for (const b of allBlocks) {
      if (b.judge_id) {
        if (!judgeBlocksMap.has(b.judge_id)) {
          judgeBlocksMap.set(b.judge_id, [])
        }
        judgeBlocksMap.get(b.judge_id)!.push(b)

        const p = b.profiles as any
        if (p?.full_name) {
          judgeNameMap.set(b.judge_id, p.full_name)
        }
      } else {
        eventBlocks.push(b)
      }
    }

    // Verify each judge chain
    const judgeChains: JudgeChainVerification[] = []
    const chainHeads: string[] = []

    for (const [judgeId, jBlocks] of judgeBlocksMap.entries()) {
      const v = verifyChainBlocks(jBlocks)
      judgeChains.push({
        judgeId,
        judgeName: judgeNameMap.get(judgeId) || 'Jury Evaluator',
        isValid: v.isValid,
        totalBlocks: jBlocks.length,
        chainHeadHash: v.headHash,
        errorReason: v.errorReason,
      })
      if (v.headHash && v.headHash !== 'GENESIS') {
        chainHeads.push(v.headHash)
      }
    }

    // Verify event-level chain
    const eventChainVerification = verifyChainBlocks(eventBlocks)
    if (eventChainVerification.headHash && eventChainVerification.headHash !== 'GENESIS') {
      chainHeads.push(eventChainVerification.headHash)
    }

    // Recompute binary Merkle root with odd-leaf rule
    const computedMerkleRoot = computeMerkleRoot(chainHeads, eventId)
    const isMerkleRootValid =
      Boolean(event.anchored_merkle_root) &&
      event.anchored_merkle_root === computedMerkleRoot

    const areJudgeChainsValid =
      judgeChains.length > 0
        ? judgeChains.every((c) => c.isValid)
        : true

    const overallIntegrity =
      isMerkleRootValid && areJudgeChainsValid && eventChainVerification.isValid

    return NextResponse.json({
      success: true,
      event,
      verification: {
        overallIntegrity,
        isMerkleRootValid,
        areJudgeChainsValid,
        eventChainValid: eventChainVerification.isValid,
        anchoredMerkleRoot: event.anchored_merkle_root,
        computedMerkleRoot,
        totalAuditBlocks: allBlocks.length,
        judgeChains,
        chainHeadCount: chainHeads.length,
        verifiedAt: new Date().toISOString(),
      },
    })
  } catch (err: any) {
    return NextResponse.json(
      { error: err.message || 'Internal server error' },
      { status: 500 }
    )
  }
}
