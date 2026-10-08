import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { requireEventOrganizer } from '@/lib/auth/guards'

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: eventId } = await params
    const auth = await requireEventOrganizer(eventId)
    if (auth.errorResponse) return auth.errorResponse

    const supabase = await createClient()


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
