import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { getServiceSupabase } from '@/lib/supabase/service-role'

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string; requestId: string }> }
) {
  try {
    const { requestId } = await params
    const supabase = await createClient()

    const {
      data: { user },
      error: authErr,
    } = await supabase.auth.getUser()

    if (authErr || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const serviceClient = getServiceSupabase()

    // 1. Update status to approved
    await serviceClient
      .from('edit_requests')
      .update({
        status: 'approved',
        reviewed_by: user.id,
        reviewed_at: new Date().toISOString(),
      })
      .eq('id', requestId)

    // 2. Call apply_approved_score_edit RPC
    const { error: rpcErr } = await supabase.rpc('apply_approved_score_edit', {
      p_edit_request_id: requestId,
    })

    if (rpcErr) {
      return NextResponse.json({ error: rpcErr.message }, { status: 400 })
    }

    return NextResponse.json({
      success: true,
      message: 'Score edit approved and version incremented append-only',
    })
  } catch (err: any) {
    return NextResponse.json(
      { error: err.message || 'Internal server error' },
      { status: 500 }
    )
  }
}
