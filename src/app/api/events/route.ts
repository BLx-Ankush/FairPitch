import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { getServiceSupabase } from '@/lib/supabase/service-role'

import { getAuthUser, getUserProfile } from '@/lib/auth/session'

export async function GET() {
  try {
    const user = await getAuthUser()

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const supabase = await createClient()
    const profile = await getUserProfile(user.id)

    const query = supabase
      .from('events')
      .select('*, institutions(name)')

    // Scope to institution unless platform owner
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
    const supabase = await createClient()
    const {
      data: { user },
      error: authErr,
    } = await supabase.auth.getUser()

    if (authErr || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { data: profile } = await supabase
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
    const {
      title,
      description,
      startDate,
      endDate,
      registrationDeadline,
      submissionDeadline,
      blindMode = false,
      minJudgesPerTeam = 3,
      judgingMode = 'rubric',
      institutionId = profile?.institution_id,
    } = body

    if (!title || !startDate || !endDate) {
      return NextResponse.json(
        { error: 'Event title, start date, and end date are required' },
        { status: 400 }
      )
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
    const startDateVal = body.startDate || body.start_date || new Date().toISOString()
    const endDateVal = body.endDate || body.end_date || new Date(Date.now() + 7 * 86400000).toISOString()

    const serviceClient = getServiceSupabase()

    // Build insert payload with event_code and UPI fields
    const insertPayload: any = {
      institution_id: institutionId,
      title,
      slug,
      event_code: generatedEventCode,
      description: description || null,
      start_date: new Date(startDateVal).toISOString(),
      end_date: new Date(endDateVal).toISOString(),
      registration_deadline: registrationDeadline ? new Date(registrationDeadline).toISOString() : null,
      submission_deadline: submissionDeadline ? new Date(submissionDeadline).toISOString() : null,
      status: 'open',
      blind_mode: Boolean(blindMode),
      min_judges_per_team: Number(minJudgesPerTeam) || 3,
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

    if (createErr) {
      return NextResponse.json({ error: createErr.message }, { status: 400 })
    }

    // Register caller as event admin in event_roles
    await serviceClient.from('event_roles').insert({
      user_id: user.id,
      event_id: event.id,
      institution_id: institutionId,
      role: 'organizer',
      status: 'active',
    })

    return NextResponse.json({ success: true, event })
  } catch (err: any) {
    return NextResponse.json(
      { error: err.message || 'Internal server error' },
      { status: 500 }
    )
  }
}
