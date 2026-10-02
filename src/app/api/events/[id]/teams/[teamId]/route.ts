import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string; teamId: string }> }
) {
  try {
    const { id, teamId } = await params
    const supabase = await createClient()

    const { data: team, error: teamErr } = await supabase
      .from('teams')
      .select('*, submissions(*)')
      .eq('id', teamId)
      .eq('event_id', id)
      .single()

    if (teamErr || !team) {
      return NextResponse.json({ error: 'Team not found' }, { status: 404 })
    }

    const { data: members, error: membersErr } = await supabase
      .from('team_members')
      .select('id, role, joined_at, profiles(full_name, email)')
      .eq('team_id', teamId)
      .order('joined_at', { ascending: true })

    if (membersErr) {
      return NextResponse.json({ error: membersErr.message }, { status: 500 })
    }

    return NextResponse.json({
      success: true,
      team: {
        ...team,
        members: (members || []).map((m: any) => ({
          id: m.id,
          role: m.role,
          joinedAt: m.joined_at,
          fullName: m.profiles?.full_name,
          email: m.profiles?.email,
        })),
        submission: team.submissions?.[0] || null,
      },
    })
  } catch (err: any) {
    return NextResponse.json(
      { error: err.message || 'Internal server error' },
      { status: 500 }
    )
  }
}
