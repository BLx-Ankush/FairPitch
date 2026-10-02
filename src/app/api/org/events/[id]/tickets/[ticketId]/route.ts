import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { getServiceSupabase } from '@/lib/supabase/service-role'

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string; ticketId: string }> }
) {
  try {
    const { id: eventId, ticketId } = await params
    const body = await request.json()
    const { status, resolutionNotes } = body

    if (!status || !['open', 'under_review', 'resolved'].includes(status)) {
      return NextResponse.json(
        { error: 'Invalid status. Allowed values: open, under_review, resolved' },
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

    const serviceClient = getServiceSupabase()

    const updatePayload: any = {
      status,
      resolution_notes: resolutionNotes !== undefined ? resolutionNotes : null,
      updated_at: new Date().toISOString(),
    }

    if (status === 'resolved') {
      updatePayload.resolved_by = user.id
      updatePayload.resolved_at = new Date().toISOString()
    }

    const { data: updatedTicket, error: updateErr } = await serviceClient
      .from('review_requests')
      .update(updatePayload)
      .eq('id', ticketId)
      .eq('event_id', eventId)
      .select()
      .single()

    if (updateErr) {
      return NextResponse.json({ error: updateErr.message }, { status: 500 })
    }

    return NextResponse.json({
      success: true,
      message: `Dispute ticket marked as ${status}`,
      ticket: updatedTicket,
    })
  } catch (err: any) {
    return NextResponse.json(
      { error: err.message || 'Internal server error' },
      { status: 500 }
    )
  }
}
