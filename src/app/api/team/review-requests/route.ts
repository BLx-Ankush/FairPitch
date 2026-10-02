import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export async function POST(request: Request) {
  try {
    const body = await request.json()
    const { eventId, teamId, reason } = body

    if (!eventId || !teamId || !reason || reason.trim().length === 0) {
      return NextResponse.json(
        { error: 'Event ID, Team ID, and detailed dispute rationale are required' },
        { status: 400 }
      )
    }

    const supabase = await createClient()

    const {
      data: { user },
      error: authErr,
    } = await supabase.auth.getUser()

    if (authErr || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // 1. Verify user is a member of this team
    const { data: member } = await supabase
      .from('team_members')
      .select('id, institution_id')
      .eq('team_id', teamId)
      .eq('user_id', user.id)
      .maybeSingle()

    if (!member) {
      return NextResponse.json(
        { error: 'Forbidden: You are not a member of this team' },
        { status: 403 }
      )
    }

    // 2. Insert into review_requests (uses RLS check: participant_id = auth.uid() and is_team_member)
    const { data: ticket, error: insertErr } = await supabase
      .from('review_requests')
      .insert({
        event_id: eventId,
        institution_id: member.institution_id,
        team_id: teamId,
        participant_id: user.id,
        reason: reason.trim(),
        status: 'open',
      })
      .select()
      .single()

    if (insertErr) {
      return NextResponse.json({ error: insertErr.message }, { status: 500 })
    }

    return NextResponse.json({
      success: true,
      message: 'Review inquiry submitted successfully. Organizers have been notified.',
      ticket,
    })
  } catch (err: any) {
    return NextResponse.json(
      { error: err.message || 'Internal server error' },
      { status: 500 }
    )
  }
}

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url)
    const teamId = searchParams.get('teamId')

    const supabase = await createClient()
    const {
      data: { user },
      error: authErr,
    } = await supabase.auth.getUser()

    if (authErr || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    let query = supabase
      .from('review_requests')
      .select('*, events(title), teams(name)')
      .order('created_at', { ascending: false })

    if (teamId) {
      query = query.eq('team_id', teamId)
    }

    const { data: tickets, error } = await query

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json({ success: true, tickets: tickets || [] })
  } catch (err: any) {
    return NextResponse.json(
      { error: err.message || 'Internal server error' },
      { status: 500 }
    )
  }
}
