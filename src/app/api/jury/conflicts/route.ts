import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { getServiceSupabase } from '@/lib/supabase/service-role'

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

    const { teamId, reason } = await request.json()

    if (!teamId || !reason) {
      return NextResponse.json(
        { error: 'teamId and a detailed reason are required to declare a conflict' },
        { status: 400 }
      )
    }

    // Look up team to obtain event_id and institution_id
    const { data: team, error: teamErr } = await supabase
      .from('teams')
      .select('event_id, institution_id')
      .eq('id', teamId)
      .single()

    if (teamErr || !team) {
      return NextResponse.json({ error: 'Team not found' }, { status: 404 })
    }

    const serviceClient = getServiceSupabase()

    // 1. Insert conflict (fires trg_audit_conflict_declaration trigger)
    const { data: conflict, error: conflictErr } = await serviceClient
      .from('conflicts')
      .insert({
        event_id: team.event_id,
        institution_id: team.institution_id,
        judge_id: user.id,
        team_id: teamId,
        declared_by: user.id,
        reason: String(reason).trim(),
      })
      .select()
      .single()

    if (conflictErr) {
      return NextResponse.json({ error: conflictErr.message }, { status: 400 })
    }

    // 2. Mark assignment as excused
    await serviceClient
      .from('judge_assignments')
      .update({ status: 'excused' })
      .eq('event_id', team.event_id)
      .eq('judge_id', user.id)
      .eq('team_id', teamId)

    return NextResponse.json({
      success: true,
      message: 'Conflict of interest declared. Assignment marked as excused.',
      conflict,
    })
  } catch (err: any) {
    return NextResponse.json(
      { error: err.message || 'Internal server error' },
      { status: 500 }
    )
  }
}
