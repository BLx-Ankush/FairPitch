import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { getServiceSupabase } from '@/lib/supabase/service-role'
import { getAuthUser } from '@/lib/auth/session'
import { demoTeams } from '@/lib/demo-store'

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string; teamId: string }> }
) {
  try {
    const { id: eventId, teamId } = await params
    const user = await getAuthUser()

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await request.json()
    const { action = 'approve', note } = body

    if ((user as any)?.isDemo) {
      const demoTeam = demoTeams.find((t) => t.id === teamId)
      if (demoTeam) {
        if (action === 'approve') {
          demoTeam.payment_status = 'verified'
          demoTeam.status = 'approved'
          demoTeam.join_code = demoTeam.team_code
          demoTeam.amount_paid = 500
        } else {
          demoTeam.payment_status = 'unpaid'
          demoTeam.utr_number = null
        }
        return NextResponse.json({
          success: true,
          action: action === 'approve' ? 'approved' : 'rejected',
          team: demoTeam,
        })
      }
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

    // Fetch team
    const { data: team, error: teamErr } = await serviceClient
      .from('teams')
      .select('id, name, team_code, join_code, payment_status, utr_number, amount_paid')
      .eq('id', teamId)
      .eq('event_id', eventId)
      .single()

    if (teamErr || !team) {
      return NextResponse.json({ error: 'Team not found' }, { status: 404 })
    }

    const nowIso = new Date().toISOString()

    if (action === 'approve') {
      const assignedJoinCode = team.join_code || team.team_code

      const { data: updatedTeam, error: updateErr } = await serviceClient
        .from('teams')
        .update({
          payment_status: 'verified',
          status: 'approved',
          join_code: assignedJoinCode,
          payment_verified_at: nowIso,
          verified_by: user.id,
          updated_at: nowIso,
        })
        .eq('id', teamId)
        .select()
        .single()

      if (updateErr) {
        return NextResponse.json({ error: updateErr.message }, { status: 500 })
      }

      return NextResponse.json({
        success: true,
        message: `Payment verified for team "${team.name}"! Join code ${assignedJoinCode} is now active.`,
        team: updatedTeam,
      })
    } else if (action === 'reject') {
      const { data: updatedTeam, error: updateErr } = await serviceClient
        .from('teams')
        .update({
          payment_status: 'unpaid',
          utr_number: null,
          updated_at: nowIso,
        })
        .eq('id', teamId)
        .select()
        .single()

      if (updateErr) {
        return NextResponse.json({ error: updateErr.message }, { status: 500 })
      }

      return NextResponse.json({
        success: true,
        message: `Payment rejected for team "${team.name}". Team status reset to unpaid.`,
        team: updatedTeam,
      })
    }

    return NextResponse.json({ error: 'Invalid action. Expected "approve" or "reject".' }, { status: 400 })
  } catch (err: any) {
    return NextResponse.json(
      { error: err.message || 'Internal server error' },
      { status: 500 }
    )
  }
}
