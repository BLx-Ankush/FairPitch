import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import {
  computeFairnessTelemetry,
  EngineCriterion,
  EngineJudge,
  EngineScoreRecord,
  EngineTeam,
} from '@/lib/fairness/engine'

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const supabase = await createClient()

    const {
      data: { user },
      error: authErr,
    } = await supabase.auth.getUser()

    if (authErr || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // 1. Fetch event metadata
    const { data: event, error: eventErr } = await supabase
      .from('events')
      .select('id, institution_id, title, status')
      .eq('id', id)
      .single()

    if (eventErr || !event) {
      return NextResponse.json({ error: 'Event not found' }, { status: 404 })
    }

    // 2. Fetch rubric criteria
    const { data: criteriaData, error: criteriaErr } = await supabase
      .from('rubric_criteria')
      .select('id, name, weight, max_score')
      .eq('event_id', id)

    if (criteriaErr) {
      return NextResponse.json({ error: criteriaErr.message }, { status: 500 })
    }

    // 3. Fetch teams
    const { data: teamsData, error: teamsErr } = await supabase
      .from('teams')
      .select('id, name, tagline')
      .eq('event_id', id)

    if (teamsErr) {
      return NextResponse.json({ error: teamsErr.message }, { status: 500 })
    }

    // 4. Fetch judges (from assignments and event_roles)
    const { data: assignments } = await supabase
      .from('judge_assignments')
      .select('judge_id, profiles:judge_id(id, full_name, email)')
      .eq('event_id', id)

    const judgeMap = new Map<string, EngineJudge>()
    for (const a of assignments || []) {
      const p = a.profiles as any
      if (p && !judgeMap.has(p.id)) {
        judgeMap.set(p.id, {
          id: p.id,
          name: p.full_name || 'Jury Member',
          email: p.email,
        })
      }
    }

    const { data: juryRoles } = await supabase
      .from('event_roles')
      .select('user_id, profiles:user_id(id, full_name, email)')
      .eq('event_id', id)
      .eq('role', 'jury')

    for (const r of juryRoles || []) {
      const p = r.profiles as any
      if (p && !judgeMap.has(p.id)) {
        judgeMap.set(p.id, {
          id: p.id,
          name: p.full_name || 'Jury Member',
          email: p.email,
        })
      }
    }

    // 5. Fetch scores from v_latest_scores
    const { data: rawScores, error: scoreErr } = await supabase
      .from('v_latest_scores')
      .select('team_id, judge_id, criterion_id, score, order_index, version')
      .eq('event_id', id)

    if (scoreErr) {
      return NextResponse.json({ error: scoreErr.message }, { status: 500 })
    }

    const criteria: EngineCriterion[] = (criteriaData || []).map((c) => ({
      id: c.id,
      name: c.name,
      weight: Number(c.weight),
      max_score: Number(c.max_score) || 10,
    }))

    const teams: EngineTeam[] = (teamsData || []).map((t) => ({
      id: t.id,
      name: t.name,
      tagline: t.tagline,
    }))

    const judges: EngineJudge[] = Array.from(judgeMap.values())

    const scores: EngineScoreRecord[] = (rawScores || []).map((s) => ({
      team_id: s.team_id,
      judge_id: s.judge_id,
      criterion_id: s.criterion_id,
      score: Number(s.score),
      order_index: s.order_index ?? 0,
      version: s.version,
    }))

    // 6. Compute live telemetry
    const telemetry = computeFairnessTelemetry(scores, teams, judges, criteria)

    // 7. Fetch latest saved snapshot if any
    const { data: latestReport } = await supabase
      .from('fairness_reports')
      .select('*')
      .eq('event_id', id)
      .order('snapshot_at', { ascending: false })
      .limit(1)
      .maybeSingle()

    return NextResponse.json({
      success: true,
      event,
      telemetry,
      latestSnapshot: latestReport || null,
      meta: {
        scoreCount: scores.length,
        teamCount: teams.length,
        judgeCount: judges.length,
        criteriaCount: criteria.length,
      },
    })
  } catch (err: any) {
    return NextResponse.json(
      { error: err.message || 'Internal server error' },
      { status: 500 }
    )
  }
}
