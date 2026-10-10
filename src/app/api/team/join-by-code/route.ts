import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { getServiceSupabase } from '@/lib/supabase/service-role'
import { getAuthUser } from '@/lib/auth/session'
import { demoTeams } from '@/lib/demo-store'

export async function POST(request: Request) {
  try {
    const user = await getAuthUser()

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await request.json()
    const { teamCode } = body

    if (!teamCode || !teamCode.trim()) {
      return NextResponse.json(
        { error: 'Team join code is required' },
        { status: 400 }
      )
    }

    const cleanCode = teamCode.trim().toUpperCase()

    // 1. Check Demo Teams if demo mode
    if ((user as any)?.isDemo) {
      const targetDemoTeam = demoTeams.find(
        (t) =>
          t.team_code?.toUpperCase() === cleanCode ||
          (t as any).join_code?.toUpperCase() === cleanCode
      )

      if (!targetDemoTeam) {
        return NextResponse.json(
          { error: 'Squad code not found. Please verify the code with your team lead.' },
          { status: 404 }
        )
      }

      // Check if already in squad
      const alreadyMember = targetDemoTeam.members.some((m) => m.id === user.id)
      if (!alreadyMember) {
        targetDemoTeam.members.push({
          id: user.id,
          name: (user as any).user_metadata?.full_name || 'Participant Member',
          email: user.email || 'member@nexis.edu',
          role: 'member',
          joined_at: new Date().toISOString(),
        })
      }

      return NextResponse.json({ success: true, team: targetDemoTeam })
    }

    // 2. Query Supabase Teams
    const serviceClient = getServiceSupabase()

    // Search across teams matching team_code or join_code
    const { data: teams, error: findErr } = await serviceClient
      .from('teams')
      .select('*, events(id, title, institution_id, registration_fee)')
      .or(`team_code.eq.${cleanCode},join_code.eq.${cleanCode}`)
      .limit(1)

    if (findErr || !teams || teams.length === 0) {
      return NextResponse.json(
        { error: 'Invalid squad join code. Please ask your team captain for the exact code (e.g. TEAM-XXXX).' },
        { status: 404 }
      )
    }

    const targetTeam = teams[0]

    // Verify payment status (must be verified or waived)
    if (
      targetTeam.payment_status !== 'verified' &&
      targetTeam.payment_status !== 'waived'
    ) {
      return NextResponse.json(
        {
          error:
            'Squad registration payment is still pending verification. The squad will unlock once the organizer confirms payment.',
        },
        { status: 403 }
      )
    }

    // Check if user is already enrolled in any team for this hackathon
    const { data: existingMembership } = await serviceClient
      .from('team_members')
      .select('team_id, role')
      .eq('event_id', targetTeam.event_id)
      .eq('user_id', user.id)
      .maybeSingle()

    if (existingMembership) {
      if (existingMembership.team_id === targetTeam.id) {
        return NextResponse.json({ success: true, team: targetTeam })
      }
      return NextResponse.json(
        { error: 'You are already registered with another team in this hackathon.' },
        { status: 400 }
      )
    }

    // Add member to squad
    const { error: joinErr } = await serviceClient.from('team_members').insert({
      team_id: targetTeam.id,
      event_id: targetTeam.event_id,
      institution_id: targetTeam.institution_id,
      user_id: user.id,
      role: 'member',
    })

    if (joinErr) {
      return NextResponse.json({ error: joinErr.message }, { status: 400 })
    }

    // Upsert participant role in event_roles
    await serviceClient.from('event_roles').upsert({
      user_id: user.id,
      event_id: targetTeam.event_id,
      institution_id: targetTeam.institution_id,
      role: 'participant',
      status: 'active',
    })

    return NextResponse.json({ success: true, team: targetTeam })
  } catch (err: any) {
    return NextResponse.json(
      { error: err.message || 'Failed to join team' },
      { status: 500 }
    )
  }
}
