import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { getServiceSupabase } from '@/lib/supabase/service-role'
import { requireEventOrganizer } from '@/lib/auth/guards'

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string; ticketId: string }> }
) {
  try {
    const { id: eventId, ticketId } = await params
    const auth = await requireEventOrganizer(eventId)
    if (auth.errorResponse) return auth.errorResponse
    const user = auth.caller.user

    const body = await request.json()

    const { status, resolutionNotes } = body

    if (!status || !['open', 'under_review', 'resolved'].includes(status)) {
      return NextResponse.json(
        { error: 'Invalid status. Allowed values: open, under_review, resolved' },
        { status: 400 }
      )
    }

    const supabase = await createClient()


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
