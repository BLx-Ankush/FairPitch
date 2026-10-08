import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { getServiceSupabase } from '@/lib/supabase/service-role'
import { validateUtrNumber } from '@/lib/payments/upi'
import { getAuthUser } from '@/lib/auth/session'
import { demoTeams } from '@/lib/demo-store'
import { requireParticipant } from '@/lib/auth/guards'

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string; teamId: string }> }
) {
  try {
    const { id: eventId, teamId } = await params
    const auth = await requireParticipant(teamId, eventId)
    if (auth.errorResponse) return auth.errorResponse

    const user = auth.caller.user


    const body = await request.json()
    const { utr } = body

    const validation = validateUtrNumber(utr)
    if (!validation.isValid) {
      return NextResponse.json({ error: validation.error }, { status: 400 })
    }

    const cleanUtr = utr.trim().toUpperCase()

    if ((user as any)?.isDemo) {
      const demoTeam = demoTeams.find((t) => t.id === teamId)
      if (demoTeam) {
        demoTeam.utr_number = cleanUtr
        demoTeam.payment_status = 'pending_verification'
        return NextResponse.json({
          success: true,
          message: 'Payment reference submitted successfully for organizer verification',
          team: demoTeam,
        })
      }
    }

    const supabase = await createClient()
    const serviceClient = getServiceSupabase()

    // 1. Fetch team & verify user is team member/lead
    const { data: team, error: teamErr } = await serviceClient
      .from('teams')
      .select('*, team_members(user_id, role)')
      .eq('id', teamId)
      .eq('event_id', eventId)
      .single()

    if (teamErr || !team) {
      return NextResponse.json({ error: 'Team not found' }, { status: 404 })
    }

    const isMember = (team.team_members || []).some((m: any) => m.user_id === user.id)
    if (!isMember) {
      return NextResponse.json(
        { error: 'Forbidden: Only team members can submit payment reference' },
        { status: 403 }
      )
    }

    // 2. Check for duplicate UTR used across another team in this event
    const { data: existingUtr } = await serviceClient
      .from('teams')
      .select('id, name')
      .eq('event_id', eventId)
      .eq('utr_number', cleanUtr)
      .neq('id', teamId)
      .maybeSingle()

    if (existingUtr) {
      return NextResponse.json(
        { error: `This UTR has already been submitted for team "${existingUtr.name}". Please verify your transaction receipt.` },
        { status: 409 }
      )
    }

    // 3. Fetch event UPI configuration
    const { data: event } = await serviceClient
      .from('events')
      .select('registration_fee, auto_verify_upi')
      .eq('id', eventId)
      .single()

    const regFee = Number(event?.registration_fee) || 0
    const nowIso = new Date().toISOString()
    const isAutoVerify = Boolean(event?.auto_verify_upi)

    // 4. Update team payment status
    const updatePayload: any = {
      utr_number: cleanUtr,
      amount_paid: regFee,
      payment_submitted_at: nowIso,
      updated_at: nowIso,
    }

    if (isAutoVerify) {
      updatePayload.payment_status = 'verified'
      updatePayload.status = 'approved'
      updatePayload.payment_verified_at = nowIso
      updatePayload.join_code = team.team_code
    } else {
      updatePayload.payment_status = 'pending_verification'
    }

    const { data: updatedTeam, error: updateErr } = await serviceClient
      .from('teams')
      .update(updatePayload)
      .eq('id', teamId)
      .select()
      .single()

    if (updateErr) {
      return NextResponse.json({ error: updateErr.message }, { status: 500 })
    }

    return NextResponse.json({
      success: true,
      message: isAutoVerify
        ? 'Payment auto-verified! Your event join code is now unlocked.'
        : 'Payment UTR submitted successfully! Awaiting organizer verification.',
      team: updatedTeam,
      isVerified: isAutoVerify,
      joinCode: isAutoVerify ? updatedTeam.join_code : null,
    })
  } catch (err: any) {
    return NextResponse.json(
      { error: err.message || 'Internal server error' },
      { status: 500 }
    )
  }
}
