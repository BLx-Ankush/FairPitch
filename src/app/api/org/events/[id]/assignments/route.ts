import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { getServiceSupabase } from '@/lib/supabase/service-role'
import { generateBalancedAssignments } from '@/lib/jury/matrix'

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const supabase = await createClient()

    const { data: assignments, error } = await supabase
      .from('judge_assignments')
      .select('*, teams(id, name, team_code), profiles:judge_id(id, full_name, email)')
      .eq('event_id', id)
      .order('order_index', { ascending: true })

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json({ success: true, assignments: assignments || [] })
  } catch (err: any) {
    return NextResponse.json(
      { error: err.message || 'Internal server error' },
      { status: 500 }
    )
  }
}

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const supabase = await createClient()
    const {
      data: { user },
      error: authErr,
    } = await supabase.auth.getUser()

    if (authErr || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { data: event } = await supabase
      .from('events')
      .select('institution_id, status, min_judges_per_team')
      .eq('id', id)
      .single()

    if (!event) {
      return NextResponse.json({ error: 'Event not found' }, { status: 404 })
    }

    // 1. Fetch active judges
    const { data: juryRoles } = await supabase
      .from('event_roles')
      .select('user_id')
      .eq('event_id', id)
      .eq('role', 'jury')
      .eq('status', 'active')

    const judgeIds = (juryRoles || []).map((j: any) => j.user_id)

    // 2. Fetch approved teams
    const { data: teams } = await supabase
      .from('teams')
      .select('id')
      .eq('event_id', id)
      .eq('status', 'approved')

    const teamIds = (teams || []).map((t: any) => t.id)

    if (judgeIds.length === 0) {
      return NextResponse.json(
        { error: 'Cannot generate assignments: No active jury evaluators found for this event' },
        { status: 400 }
      )
    }

    if (teamIds.length === 0) {
      return NextResponse.json(
        { error: 'Cannot generate assignments: No approved teams found for this event' },
        { status: 400 }
      )
    }

    // 3. Generate balanced matrix with randomized order index
    const assignmentRows = generateBalancedAssignments({
      eventId: id,
      institutionId: event.institution_id,
      judgeIds,
      teamIds,
      minJudgesPerTeam: event.min_judges_per_team || 3,
    })

    const serviceClient = getServiceSupabase()

    // 4. Upsert assignments
    const { data: inserted, error: insertErr } = await serviceClient
      .from('judge_assignments')
      .upsert(assignmentRows, { onConflict: 'event_id,judge_id,team_id' })
      .select()

    if (insertErr) {
      return NextResponse.json({ error: insertErr.message }, { status: 400 })
    }

    return NextResponse.json({
      success: true,
      message: `Generated ${inserted?.length || 0} balanced judge assignments with drift randomization`,
      assignments: inserted,
    })
  } catch (err: any) {
    return NextResponse.json(
      { error: err.message || 'Internal server error' },
      { status: 500 }
    )
  }
}
