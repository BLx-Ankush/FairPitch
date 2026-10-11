import { NextResponse } from 'next/server'
import { getServiceSupabase } from '@/lib/supabase/service-role'
import { getAuthUser, getUserProfile } from '@/lib/auth/session'

export async function GET() {
  try {
    const user = await getAuthUser()

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const serviceClient = getServiceSupabase()
    const profile = await getUserProfile(user.id)

    const query = serviceClient
      .from('events')
      .select('*, institutions(name)')

    // Scope to institution unless platform owner or user without institution
    if (profile?.role !== 'platform_owner' && profile?.institution_id) {
      query.eq('institution_id', profile.institution_id)
    }

    const { data: events, error: listErr } = await query.order('created_at', { ascending: false })

    if (listErr) {
      return NextResponse.json({ error: listErr.message }, { status: 500 })
    }

    return NextResponse.json({ success: true, events: events || [] })
  } catch (err: any) {
    return NextResponse.json(
      { error: err.message || 'Internal server error' },
      { status: 500 }
    )
  }
}

export async function POST(request: Request) {
  try {
    const user = await getAuthUser()

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const serviceClient = getServiceSupabase()
    const { data: profile } = await serviceClient
      .from('profiles')
      .select('institution_id, role, organizer_approval_status')
      .eq('id', user.id)
      .single()

    const isAuthorized =
      profile?.role === 'institution_admin' ||
      profile?.role === 'platform_owner' ||
      (profile?.role === 'user' && profile?.organizer_approval_status === 'approved')

    if (!isAuthorized) {
      return NextResponse.json(
        { error: 'Forbidden: Only approved organizers or institution administrators can create events' },
        { status: 403 }
      )
    }

    const body = await request.json()
    const title = (body.title || '').trim()
    const description = body.description || null
    const startDateVal = body.startDate || body.start_date || new Date().toISOString()
    const endDateVal =
      body.endDate ||
      body.end_date ||
      new Date(new Date(startDateVal).getTime() + 7 * 86400000).toISOString()
    const registrationDeadline = body.registrationDeadline || body.registration_deadline || null
    const submissionDeadline = body.submissionDeadline || body.submission_deadline || null
    const blindMode = body.blindMode ?? body.blind_mode ?? false
    const minJudgesPerTeam = Number(body.minJudgesPerTeam ?? body.min_judges_per_team) || 3
    const judgingMode = body.judgingMode || body.judging_mode || 'rubric'

    if (!title) {
      return NextResponse.json(
        { error: 'Event title is required' },
        { status: 400 }
      )
    }

    let institutionId = body.institutionId || body.institution_id || profile?.institution_id

    // Fallback: auto-resolve to default/first institution if not explicitly assigned
    if (!institutionId) {
      const { data: defaultInst } = await serviceClient
        .from('institutions')
        .select('id')
        .order('created_at', { ascending: true })
        .limit(1)
        .single()

      if (defaultInst) {
        institutionId = defaultInst.id
        await serviceClient
          .from('profiles')
          .update({ institution_id: defaultInst.id })
          .eq('id', user.id)
      }
    }

    if (!institutionId) {
      return NextResponse.json(
        { error: 'An institution ID is required to create an event' },
        { status: 400 }
      )
    }

    // Generate unique slug
    const baseSlug = title
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-|-$/g, '')
    const slug = `${baseSlug}-${Math.floor(1000 + Math.random() * 9000)}`

    const rawCode = body.event_code || body.eventCode
    const generatedEventCode = (
      rawCode ||
      `${title.substring(0, 4).toUpperCase().replace(/[^A-Z0-9]/g, 'EV')}-${Math.floor(1000 + Math.random() * 9000)}`
    )
      .toUpperCase()
      .trim()

    const regFee = Number(body.registration_fee ?? body.registrationFee) || 0
    const upiIdVal = body.upi_id || body.upiId || null
    const upiNameVal = body.upi_name || body.upiName || null

    // Build insert payload with event_code and UPI fields
    const insertPayload: any = {
      institution_id: institutionId,
      title,
      slug,
      event_code: generatedEventCode,
      description,
      start_date: new Date(startDateVal).toISOString(),
      end_date: new Date(endDateVal).toISOString(),
      registration_deadline: registrationDeadline ? new Date(registrationDeadline).toISOString() : null,
      submission_deadline: submissionDeadline ? new Date(submissionDeadline).toISOString() : null,
      status: 'open',
      blind_mode: Boolean(blindMode),
      min_judges_per_team: minJudgesPerTeam,
      judging_mode: judgingMode,
      registration_fee: regFee,
      upi_id: upiIdVal,
      upi_name: upiNameVal,
      created_by: user.id,
    }

    let { data: event, error: createErr } = await serviceClient
      .from('events')
      .insert(insertPayload)
      .select()
      .single()

    // Fallback if event_code column does not yet exist in remote database schema
    if (createErr && createErr.message?.includes('event_code')) {
      delete insertPayload.event_code
      const retryRes = await serviceClient
        .from('events')
        .insert(insertPayload)
        .select()
        .single()
      event = retryRes.data
      createErr = retryRes.error
    }

    if (createErr || !event) {
      return NextResponse.json({ error: createErr?.message || 'Failed to create event' }, { status: 400 })
    }

    // Attach event_code to returned event object
    const enrichedEvent = {
      ...event,
      event_code: event.event_code || generatedEventCode,
    }

    // Register caller as event organizer in event_roles
    await serviceClient.from('event_roles').upsert(
      {
        user_id: user.id,
        event_id: event.id,
        institution_id: institutionId,
        role: 'organizer',
        status: 'active',
      },
      { onConflict: 'event_id,user_id,role' }
    )

    return NextResponse.json({ success: true, event: enrichedEvent })
  } catch (err: any) {
    return NextResponse.json(
      { error: err.message || 'Internal server error' },
      { status: 500 }
    )
  }
}
