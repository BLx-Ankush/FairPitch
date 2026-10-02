import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: eventId } = await params
    const supabase = await createClient()

    const {
      data: { user },
      error: authErr,
    } = await supabase.auth.getUser()

    if (authErr || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Verify organizer permission
    const { data: orgRole } = await supabase
      .from('event_roles')
      .select('role')
      .eq('event_id', eventId)
      .eq('user_id', user.id)
      .in('role', ['admin', 'organizer'])
      .maybeSingle()

    if (!orgRole) {
      return NextResponse.json(
        { error: 'Forbidden: Organizer access required' },
        { status: 403 }
      )
    }

    const { data: tickets, error: ticketErr } = await supabase
      .from('review_requests')
      .select(
        '*, teams(id, name, team_code), submitter:participant_id(id, full_name, email), resolver:resolved_by(id, full_name)'
      )
      .eq('event_id', eventId)
      .order('created_at', { ascending: false })

    if (ticketErr) {
      return NextResponse.json({ error: ticketErr.message }, { status: 500 })
    }

    return NextResponse.json({ success: true, tickets: tickets || [] })
  } catch (err: any) {
    return NextResponse.json(
      { error: err.message || 'Internal server error' },
      { status: 500 }
    )
  }
}
