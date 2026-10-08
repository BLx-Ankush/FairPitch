import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { requireEventOrganizer } from '@/lib/auth/guards'
import {
  calculateSensitivityRerank,
  EngineCriterion,
  EngineJudge,
  EngineScoreRecord,
  EngineTeam,
} from '@/lib/fairness/engine'

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const auth = await requireEventOrganizer(id)
    if (auth.errorResponse) return auth.errorResponse

    const body = await request.json()
    const { excludedJudgeIds = [] } = body

    const supabase = await createClient()


    // 1. Fetch criteria, teams, judges, scores
    const [criteriaRes, teamsRes, assignmentsRes, rolesRes, scoresRes] =
      await Promise.all([
        supabase
          .from('rubric_criteria')
          .select('id, name, weight, max_score')
          .eq('event_id', id),
        supabase.from('teams').select('id, name, tagline').eq('event_id', id),
        supabase
          .from('judge_assignments')
          .select('judge_id, profiles:judge_id(id, full_name, email)')
          .eq('event_id', id),
        supabase
          .from('event_roles')
          .select('user_id, profiles:user_id(id, full_name, email)')
          .eq('event_id', id)
          .eq('role', 'jury'),
        supabase
          .from('v_latest_scores')
          .select('team_id, judge_id, criterion_id, score, order_index, version')
          .eq('event_id', id),
      ])

    const criteria: EngineCriterion[] = (criteriaRes.data || []).map((c) => ({
      id: c.id,
      name: c.name,
      weight: Number(c.weight),
      max_score: Number(c.max_score) || 10,
    }))

    const teams: EngineTeam[] = (teamsRes.data || []).map((t) => ({
      id: t.id,
      name: t.name,
      tagline: t.tagline,
    }))

    const judgeMap = new Map<string, EngineJudge>()
    for (const a of assignmentsRes.data || []) {
      const p = a.profiles as any
      if (p && !judgeMap.has(p.id)) {
        judgeMap.set(p.id, {
          id: p.id,
          name: p.full_name || 'Jury Member',
          email: p.email,
        })
      }
    }
    for (const r of rolesRes.data || []) {
      const p = r.profiles as any
      if (p && !judgeMap.has(p.id)) {
        judgeMap.set(p.id, {
          id: p.id,
          name: p.full_name || 'Jury Member',
          email: p.email,
        })
      }
    }
    const judges: EngineJudge[] = Array.from(judgeMap.values())

    const scores: EngineScoreRecord[] = (scoresRes.data || []).map((s) => ({
      team_id: s.team_id,
      judge_id: s.judge_id,
      criterion_id: s.criterion_id,
      score: Number(s.score),
      order_index: s.order_index ?? 0,
      version: s.version,
    }))

    // 2. Run simulation
    const simulation = calculateSensitivityRerank(
      scores,
      teams,
      judges,
      criteria,
      excludedJudgeIds
    )

    return NextResponse.json({
      success: true,
      simulation,
    })
  } catch (err: any) {
    return NextResponse.json(
      { error: err.message || 'Internal server error' },
      { status: 500 }
    )
  }
}
