import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export async function POST(request: Request) {
  try {
    const supabase = await createClient()
    const {
      data: { user },
      error: authErr,
    } = await supabase.auth.getUser()

    if (authErr || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await request.json()
    const { teamId, scores } = body

    if (!teamId || !scores || !Array.isArray(scores)) {
      return NextResponse.json(
        { error: 'teamId and an array of criterion scores are required' },
        { status: 400 }
      )
    }

    // Format array for submit_scores RPC
    const criterionPayload = scores.map((s: any) => ({
      criterion_id: s.criterionId || s.criterion_id,
      score: Number(s.score),
      comment: String(s.comment || '').trim(),
    }))

    // Call submit_scores RPC
    const { data: scoreIds, error: rpcErr } = await supabase.rpc('submit_scores', {
      p_team_id: teamId,
      p_criterion_scores: criterionPayload,
    })

    if (rpcErr) {
      return NextResponse.json(
        { error: rpcErr.message },
        { status: 400 }
      )
    }

    return NextResponse.json({
      success: true,
      message: 'Evaluation committed to append-only audit ledger',
      scoreIds,
    })
  } catch (err: any) {
    return NextResponse.json(
      { error: err.message || 'Internal server error' },
      { status: 500 }
    )
  }
}
