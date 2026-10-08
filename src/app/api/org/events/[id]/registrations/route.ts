import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { getServiceSupabase } from '@/lib/supabase/service-role'
import { getAuthUser } from '@/lib/auth/session'
import { demoTeams, DEMO_EVENTS } from '@/lib/demo-store'
import { requireEventOrganizer } from '@/lib/auth/guards'

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: eventId } = await params
    const auth = await requireEventOrganizer(eventId)
    if (auth.errorResponse) return auth.errorResponse

    const user = auth.caller.user


    if ((user as any)?.isDemo) {
      const demoEvent = DEMO_EVENTS.find((e) => e.id === eventId) || DEMO_EVENTS[0]
      const totalCollected = demoTeams
        .filter((t) => t.payment_status === 'verified')
        .reduce((sum, t) => sum + (t.amount_paid || 500), 0)
      const pendingCount = demoTeams.filter((t) => t.payment_status === 'pending_verification').length

      return NextResponse.json({
        success: true,
        event: demoEvent,
        teams: demoTeams,
        stats: {
          totalTeams: demoTeams.length,
          verifiedTeams: demoTeams.filter((t) => t.payment_status === 'verified').length,
          pendingVerificationTeams: pendingCount,
          unpaidTeams: demoTeams.filter((t) => t.payment_status === 'unpaid').length,
          totalCollected,
        },
      })
    }

    const supabase = await createClient()

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
        { error: 'Forbidden: Organizer permissions required' },
        { status: 403 }
      )
    }

    const serviceClient = getServiceSupabase()

    // 1. Fetch event metadata (including registration fee and UPI settings)
    const { data: event } = await serviceClient
      .from('events')
      .select('id, title, registration_fee, upi_id, upi_name, upi_qr_url, auto_verify_upi')
      .eq('id', eventId)
      .single()

    // 2. Fetch all teams for this event with member info
    const { data: teams, error: teamsErr } = await serviceClient
      .from('teams')
      .select(`
        id,
        name,
        team_code,
        join_code,
        tagline,
        track,
        status,
        payment_status,
        utr_number,
        amount_paid,
        payment_submitted_at,
        payment_verified_at,
        created_at,
        created_by,
        team_members(
          id,
          role,
          user_id,
          profiles:user_id(full_name, email)
        )
      `)
      .eq('event_id', eventId)
      .order('created_at', { ascending: false })

    if (teamsErr) {
      return NextResponse.json({ error: teamsErr.message }, { status: 500 })
    }

    const allTeams = teams || []

    // 3. Compute registration payment stats
    const totalTeams = allTeams.length
    const verifiedTeams = allTeams.filter(
      (t: any) => t.payment_status === 'verified' || t.payment_status === 'waived'
    ).length
    const pendingVerificationTeams = allTeams.filter(
      (t: any) => t.payment_status === 'pending_verification'
    ).length
    const unpaidTeams = allTeams.filter((t: any) => t.payment_status === 'unpaid').length

    const totalCollectedAmount = allTeams
      .filter((t: any) => t.payment_status === 'verified')
      .reduce((sum: number, t: any) => sum + (Number(t.amount_paid) || 0), 0)

    return NextResponse.json({
      success: true,
      event,
      teams: allTeams,
      stats: {
        totalTeams,
        verifiedTeams,
        pendingVerificationTeams,
        unpaidTeams,
        totalCollectedAmount,
        registrationFee: Number(event?.registration_fee) || 0,
        hasUpiConfigured: Boolean(event?.upi_id && event?.upi_name),
      },
    })
  } catch (err: any) {
    return NextResponse.json(
      { error: err.message || 'Internal server error' },
      { status: 500 }
    )
  }
}
