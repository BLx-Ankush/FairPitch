import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { getAuthUser } from '@/lib/auth/session'

export async function GET() {
  try {
    const user = await getAuthUser()

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const supabase = await createClient()

    // Find user's team membership
    const { data: membership, error: memErr } = await supabase
      .from('team_members')
      .select('*, teams(*, events(title, status, submission_deadline, registration_fee, upi_id, upi_name)), profiles(full_name, email)')
      .eq('user_id', user.id)
      .limit(1)
      .maybeSingle()

    if (memErr) {
      return NextResponse.json({ error: memErr.message }, { status: 500 })
    }

    if (!membership || !membership.teams) {
      return NextResponse.json({ success: true, team: null })
    }

    const teamId = membership.team_id

    // Fetch team members
    const { data: members } = await supabase
      .from('team_members')
      .select('id, role, joined_at, profiles(full_name, email)')
      .eq('team_id', teamId)
      .order('joined_at', { ascending: true })

    // Fetch submission
    const { data: submission } = await supabase
      .from('submissions')
      .select('*')
      .eq('team_id', teamId)
      .maybeSingle()

    return NextResponse.json({
      success: true,
      team: {
        ...membership.teams,
        userRole: membership.role,
        members: (members || []).map((m: any) => ({
          id: m.id,
          role: m.role,
          joinedAt: m.joined_at,
          fullName: m.profiles?.full_name,
          email: m.profiles?.email,
        })),
        submission: submission || null,
      },
    })
  } catch (err: any) {
    return NextResponse.json(
      { error: err.message || 'Internal server error' },
      { status: 500 }
    )
  }
}
