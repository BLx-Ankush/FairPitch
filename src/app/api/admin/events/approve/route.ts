import { NextResponse } from 'next/server'
import { getServiceSupabase } from '@/lib/supabase/service-role'
import { requireInstitutionAdmin } from '@/lib/auth/guards'
import { memoryCache } from '@/lib/cache/memory-cache'
import { RUBRIC_PRESETS } from '@/lib/events/presets'

export async function POST(request: Request) {
  try {
    const auth = await requireInstitutionAdmin()
    if (auth.errorResponse) return auth.errorResponse

    const { eventId } = await request.json()

    if (!eventId) {
      return NextResponse.json({ error: 'Event ID is required' }, { status: 400 })
    }

    const serviceClient = getServiceSupabase()
    const { profile } = auth.caller

    // Fetch the target event
    const { data: event, error: fetchErr } = await serviceClient
      .from('events')
      .select('id, title, status, institution_id')
      .eq('id', eventId)
      .single()

    if (fetchErr || !event) {
      return NextResponse.json({ error: 'Event not found' }, { status: 404 })
    }

    // Tenant boundary check: Institution Admin can only approve events within their institution
    if (profile.role !== 'platform_owner' && profile.institution_id && event.institution_id !== profile.institution_id) {
      return NextResponse.json(
        { error: 'Forbidden: You cannot approve events from another institution' },
        { status: 403 }
      )
    }

    // Ensure rubric criteria sum to 100% so mathematical scoring invariants hold
    const { data: criteria } = await serviceClient
      .from('rubric_criteria')
      .select('weight')
      .eq('event_id', eventId)

    const totalWeight = (criteria || []).reduce((acc: number, c: any) => acc + Number(c.weight), 0)

    if (totalWeight !== 100) {
      // Pre-populate with standard balanced rubric preset
      const preset = RUBRIC_PRESETS[0]
      if (preset) {
        await serviceClient.from('rubric_criteria').delete().eq('event_id', eventId)
        const criteriaRows = preset.criteria.map((c, idx) => ({
          event_id: eventId,
          institution_id: event.institution_id,
          name: c.name,
          description: c.description,
          weight: c.weight,
          max_score: c.max_score,
          order_index: idx,
        }))
        await serviceClient.from('rubric_criteria').insert(criteriaRows)
      }
    }

    // Transition event to open (Live)
    const { data: updatedEvent, error: updateErr } = await serviceClient
      .from('events')
      .update({
        status: 'open',
        updated_at: new Date().toISOString(),
      })
      .eq('id', eventId)
      .select()
      .single()

    if (updateErr) {
      return NextResponse.json({ error: updateErr.message }, { status: 500 })
    }

    // Invalidate caches
    memoryCache.delete(`event:details:${eventId}`)
    memoryCache.invalidateTags(['events', `event:${eventId}`])

    return NextResponse.json({
      success: true,
      message: `Event "${event.title}" has been approved and is now LIVE for registrations!`,
      event: updatedEvent,
    })
  } catch (err: any) {
    return NextResponse.json(
      { error: err.message || 'Internal server error' },
      { status: 500 }
    )
  }
}
