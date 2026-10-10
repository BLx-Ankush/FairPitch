import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { getServiceSupabase } from '@/lib/supabase/service-role'
import { memoryCache } from '@/lib/cache/memory-cache'

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const cacheKey = `event:details:${id}`

    const cached = memoryCache.get<any>(cacheKey)
    if (cached) {
      return NextResponse.json(cached)
    }

    const supabase = await createClient()

    const { data: event, error: eventErr } = await supabase
      .from('events')
      .select('*, institutions(name, slug)')
      .eq('id', id)
      .single()

    if (eventErr || !event) {
      return NextResponse.json({ error: 'Event not found' }, { status: 404 })
    }

    // Query rubric criteria
    const { data: criteria } = await supabase
      .from('rubric_criteria')
      .select('*')
      .eq('event_id', id)
      .order('order_index', { ascending: true })

    // Query teams count
    const { count: teamCount } = await supabase
      .from('teams')
      .select('*', { count: 'exact', head: true })
      .eq('event_id', id)

    // Calculate total weight sum
    const totalWeight = (criteria || []).reduce((acc: number, c: any) => acc + Number(c.weight), 0)

    const responsePayload = {
      success: true,
      event: {
        ...event,
        criteria: criteria || [],
        teamCount: teamCount || 0,
        totalWeight,
        isRubricValid: totalWeight === 100,
        isRubricFrozen: ['judging', 'review', 'published'].includes(event.status),
      },
    }

    memoryCache.set(cacheKey, responsePayload, 60, ['events', `event:${id}`])

    return NextResponse.json(responsePayload)
  } catch (err: any) {
    return NextResponse.json(
      { error: err.message || 'Internal server error' },
      { status: 500 }
    )
  }
}


export async function PATCH(
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

    const body = await request.json()
    const {
      title,
      description,
      startDate,
      endDate,
      registrationDeadline,
      submissionDeadline,
      blindMode,
      minJudgesPerTeam,
    } = body

    const updates: Record<string, any> = {
      updated_at: new Date().toISOString(),
    }

    if (title !== undefined) updates.title = title
    if (description !== undefined) updates.description = description
    if (startDate !== undefined) updates.start_date = new Date(startDate).toISOString()
    if (endDate !== undefined) updates.end_date = new Date(endDate).toISOString()
    if (registrationDeadline !== undefined) updates.registration_deadline = registrationDeadline ? new Date(registrationDeadline).toISOString() : null
    if (submissionDeadline !== undefined) updates.submission_deadline = submissionDeadline ? new Date(submissionDeadline).toISOString() : null
    if (blindMode !== undefined) updates.blind_mode = Boolean(blindMode)
    if (minJudgesPerTeam !== undefined) updates.min_judges_per_team = Number(minJudgesPerTeam)

    const serviceClient = getServiceSupabase()
    const { data: updatedEvent, error: updateErr } = await serviceClient
      .from('events')
      .update(updates)
      .eq('id', id)
      .select()
      .single()

    if (updateErr) {
      return NextResponse.json({ error: updateErr.message }, { status: 400 })
    }

    memoryCache.invalidateTag(`event:${id}`)

    return NextResponse.json({ success: true, event: updatedEvent })
  } catch (err: any) {
    return NextResponse.json(
      { error: err.message || 'Internal server error' },
      { status: 500 }
    )
  }
}
