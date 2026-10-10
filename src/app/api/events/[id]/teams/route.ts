import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { getServiceSupabase } from '@/lib/supabase/service-role'

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const supabase = await createClient()

    const { data: teams, error: teamsErr } = await supabase
      .from('teams')
      .select('*, submissions(id, title, repo_url, demo_url, submitted_at)')
      .eq('event_id', id)
      .order('created_at', { ascending: false })

    if (teamsErr) {
      return NextResponse.json({ error: teamsErr.message }, { status: 500 })
    }

    // Get member counts per team
    const teamIds = (teams || []).map((t: any) => t.id)
    let memberCounts: Record<string, number> = {}

    if (teamIds.length > 0) {
      const { data: members } = await supabase
        .from('team_members')
        .select('team_id')
        .in('team_id', teamIds)

      if (members) {
        members.forEach((m: any) => {
          memberCounts[m.team_id] = (memberCounts[m.team_id] || 0) + 1
        })
      }
    }

    const enrichedTeams = (teams || []).map((team: any) => ({
      ...team,
      memberCount: memberCounts[team.id] || 0,
      submission: team.submissions?.[0] || null,
    }))

    return NextResponse.json({ success: true, teams: enrichedTeams })
  } catch (err: any) {
    return NextResponse.json(
      { error: err.message || 'Internal server error' },
      { status: 500 }
    )
  }
}

import { getAuthUser } from '@/lib/auth/session'

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const user = await getAuthUser()

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await request.json()
    const { action = 'create', name, tagline, track, teamCode } = body

    const supabase = await createClient()
    const serviceClient = getServiceSupabase()

    const { data: event } = await supabase
      .from('events')
      .select('institution_id, status, registration_fee, upi_id, upi_name')
      .eq('id', id)
      .single()

    if (!event) {
      return NextResponse.json({ error: 'Event not found' }, { status: 404 })
    }

    if (action === 'create') {
      if (!name) {
        return NextResponse.json({ error: 'Team name is required' }, { status: 400 })
      }

      const regFee = Number(event.registration_fee) || 0
      const isFree = regFee === 0

      // Generate a unique 4-character team code (e.g. TEAM-A7K2)
      const randomSuffix = Math.random().toString(36).substring(2, 6).toUpperCase()
      const generatedCode = `TEAM-${randomSuffix}`

      // Create team
      const { data: newTeam, error: teamErr } = await serviceClient
        .from('teams')
        .insert({
          event_id: id,
          institution_id: event.institution_id,
          name,
          team_code: generatedCode,
          join_code: isFree ? generatedCode : null,
          tagline: tagline || null,
          track: track || null,
          status: isFree ? 'approved' : 'pending',
          payment_status: isFree ? 'verified' : 'unpaid',
          amount_paid: 0,
          created_by: user.id,
        })
        .select()
        .single()

      if (teamErr) {
        return NextResponse.json({ error: teamErr.message }, { status: 400 })
      }

      // Add user as team lead (triggers mutual exclusion checks)
      const { error: memberErr } = await serviceClient
        .from('team_members')
        .insert({
          team_id: newTeam.id,
          event_id: id,
          institution_id: event.institution_id,
          user_id: user.id,
          role: 'lead',
        })

      if (memberErr) {
        // Rollback team on error (e.g. jury conflict)
        await serviceClient.from('teams').delete().eq('id', newTeam.id)
        return NextResponse.json({ error: memberErr.message }, { status: 400 })
      }

      // Ensure participant role is in event_roles
      await serviceClient.from('event_roles').upsert({
        user_id: user.id,
        event_id: id,
        institution_id: event.institution_id,
        role: 'participant',
        status: 'active',
      })

      // Generate Dynamic UPI QR code if paid event and UPI is configured
      let upiQr = null
      if (!isFree && event.upi_id) {
        try {
          const { generateDynamicUpiQr, generateTransactionRef } = await import(
            '@/lib/payments/upi'
          )
          const txnRef = generateTransactionRef(id, newTeam.name)
          upiQr = await generateDynamicUpiQr({
            vpa: event.upi_id,
            payeeName: event.upi_name || 'Event Organizer',
            amount: regFee,
            transactionRef: txnRef,
            transactionNote: `Reg Fee: ${newTeam.name}`,
          })
        } catch (qrErr) {
          console.error('Failed to generate dynamic UPI QR:', qrErr)
        }
      }

      return NextResponse.json({
        success: true,
        team: newTeam,
        requiresPayment: !isFree,
        registrationFee: regFee,
        upiQr,
      })
    }

    if (action === 'join') {
      if (!teamCode) {
        return NextResponse.json({ error: 'Team code is required to join' }, { status: 400 })
      }

      const { data: targetTeam, error: findErr } = await serviceClient
        .from('teams')
        .select('*')
        .eq('event_id', id)
        .eq('team_code', teamCode.trim().toUpperCase())
        .single()

      if (findErr || !targetTeam) {
        return NextResponse.json(
          { error: 'Invalid team code for this event' },
          { status: 404 }
        )
      }

      // Check payment status: block joining if payment is not verified
      if (
        targetTeam.payment_status !== 'verified' &&
        targetTeam.payment_status !== 'waived'
      ) {
        return NextResponse.json(
          {
            error:
              'Team registration payment is pending verification. The join code will be activated once the organizer confirms payment.',
          },
          { status: 403 }
        )
      }

      // Add user as member (checks mutual exclusion)
      const { error: joinErr } = await serviceClient
        .from('team_members')
        .insert({
          team_id: targetTeam.id,
          event_id: id,
          institution_id: event.institution_id,
          user_id: user.id,
          role: 'member',
        })

      if (joinErr) {
        return NextResponse.json({ error: joinErr.message }, { status: 400 })
      }

      await serviceClient.from('event_roles').upsert({
        user_id: user.id,
        event_id: id,
        institution_id: event.institution_id,
        role: 'participant',
        status: 'active',
      })

      return NextResponse.json({ success: true, team: targetTeam })
    }

    return NextResponse.json({ error: 'Invalid action' }, { status: 400 })
  } catch (err: any) {
    return NextResponse.json(
      { error: err.message || 'Internal server error' },
      { status: 500 }
    )
  }
}
