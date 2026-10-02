import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { getBlindModeTeamLabel } from '@/lib/jury/matrix'

export async function GET(request: Request) {
  try {
    const supabase = await createClient()
    const {
      data: { user },
      error: authErr,
    } = await supabase.auth.getUser()

    if (authErr || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    const eventIdParam = searchParams.get('eventId')

    // Find judge assignments for user
    let query = supabase
      .from('judge_assignments')
      .select('*, teams(*, submissions(*)), events(id, title, status, blind_mode)')
      .eq('judge_id', user.id)

    if (eventIdParam) {
      query = query.eq('event_id', eventIdParam)
    }

    const { data: assignments, error: assignErr } = await query.order('order_index', { ascending: true })

    if (assignErr) {
      return NextResponse.json({ error: assignErr.message }, { status: 500 })
    }

    // Query conflicts declared by this judge
    const { data: conflicts } = await supabase
      .from('conflicts')
      .select('team_id')
      .eq('judge_id', user.id)

    const conflictedTeamIds = new Set((conflicts || []).map((c: any) => c.team_id))

    // Query existing latest scores from v_latest_scores view
    const teamIds = (assignments || []).map((a: any) => a.team_id)
    let scoresMap: Record<string, any[]> = {}

    if (teamIds.length > 0) {
      const { data: existingScores } = await supabase
        .from('v_latest_scores')
        .select('*')
        .eq('judge_id', user.id)
        .in('team_id', teamIds)

      if (existingScores) {
        existingScores.forEach((s: any) => {
          if (!scoresMap[s.team_id]) scoresMap[s.team_id] = []
          scoresMap[s.team_id].push(s)
        })
      }
    }

    // Format queue items with blind mode masking
    const queue = (assignments || []).map((a: any, idx: number) => {
      const isBlind = Boolean(a.events?.blind_mode)
      const maskedName = isBlind ? getBlindModeTeamLabel(idx) : a.teams?.name

      return {
        id: a.id,
        assignmentId: a.id,
        teamId: a.team_id,
        displayName: maskedName,
        actualName: isBlind ? undefined : a.teams?.name,
        tagline: isBlind ? null : a.teams?.tagline,
        track: a.teams?.track,
        status: a.status,
        orderIndex: a.order_index,
        hasConflict: conflictedTeamIds.has(a.team_id),
        isCompleted: a.status === 'completed',
        event: {
          id: a.events?.id,
          title: a.events?.title,
          status: a.events?.status,
          blindMode: isBlind,
        },
        submission: a.teams?.submissions?.[0] || null,
        existingScores: scoresMap[a.team_id] || [],
      }
    })

    const totalCount = queue.length
    const completedCount = queue.filter((q) => q.isCompleted).length
    const progressPct = totalCount > 0 ? Math.round((completedCount / totalCount) * 100) : 0

    return NextResponse.json({
      success: true,
      queue,
      stats: {
        totalCount,
        completedCount,
        progressPct,
      },
    })
  } catch (err: any) {
    return NextResponse.json(
      { error: err.message || 'Internal server error' },
      { status: 500 }
    )
  }
}
