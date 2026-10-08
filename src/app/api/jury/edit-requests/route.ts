import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { getServiceSupabase } from '@/lib/supabase/service-role'
import { requireJury } from '@/lib/auth/guards'

export async function POST(request: Request) {
  try {
    const auth = await requireJury()
    if (auth.errorResponse) return auth.errorResponse

    const { user } = auth.caller
    const supabase = await createClient()


    const { teamId, reason, requestedChanges } = await request.json()

    if (!teamId || !reason || !requestedChanges || !Array.isArray(requestedChanges)) {
      return NextResponse.json(
        { error: 'teamId, justification reason, and requestedChanges array are required' },
        { status: 400 }
      )
    }

    const { data: team } = await supabase
      .from('teams')
      .select('event_id, institution_id')
      .eq('id', teamId)
      .single()

    if (!team) {
      return NextResponse.json({ error: 'Team not found' }, { status: 404 })
    }

    const serviceClient = getServiceSupabase()
    const { data: editReq, error: insertErr } = await serviceClient
      .from('edit_requests')
      .insert({
        event_id: team.event_id,
        institution_id: team.institution_id,
        judge_id: user.id,
        team_id: teamId,
        reason: String(reason).trim(),
        status: 'pending',
        requested_changes: requestedChanges,
      })
      .select()
      .single()

    if (insertErr) {
      return NextResponse.json({ error: insertErr.message }, { status: 400 })
    }

    return NextResponse.json({
      success: true,
      message: 'Score edit request submitted for organizer review',
      editRequest: editReq,
    })
  } catch (err: any) {
    return NextResponse.json(
      { error: err.message || 'Internal server error' },
      { status: 500 }
    )
  }
}
