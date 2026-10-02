import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { getServiceSupabase } from '@/lib/supabase/service-role'
import {
  computeFairnessTelemetry,
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

    // 2. Fetch rubric criteria, teams, judges, scores
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

    // 3. Compute telemetry snapshot
    const telemetry = computeFairnessTelemetry(scores, teams, judges, criteria)

    const flaggedJudgesData = telemetry.leniency
      .filter((l) => l.flagged)
      .map((l) => ({
        judge_id: l.judge.id,
        name: l.judge.name,
        z_score: l.zScore,
        mean_total: l.meanTotal,
        reason: 'leniency_outlier',
      }))

    telemetry.drift
      .filter((d) => d.flagged)
      .forEach((d) => {
        if (!flaggedJudgesData.find((f) => f.judge_id === d.judge.id)) {
          flaggedJudgesData.push({
            judge_id: d.judge.id,
            name: d.judge.name,
            z_score: 0,
            mean_total: 0,
            reason: 'fatigue_drift',
          })
        }
      })

    const metricsData = {
      summarySentence: telemetry.summarySentence,
      grandMean: telemetry.grandMean,
      panelStdDev: telemetry.panelStdDev,
      highDisagreementCount: telemetry.highDisagreementCount,
      flaggedJudgeCount: telemetry.flaggedJudgeCount,
      leniency: telemetry.leniency,
      drift: telemetry.drift,
      agreement: telemetry.agreement,
    }

    const sensitivityData = {
      winnerChanged: telemetry.sensitivity.winnerChanged,
      originalWinner: telemetry.sensitivity.originalWinner,
      newWinner: telemetry.sensitivity.newWinner,
      excludedJudgeIds: telemetry.sensitivity.excludedJudgeIds,
      baselineLeaderboard: telemetry.sensitivity.baselineLeaderboard,
      simulatedLeaderboard: telemetry.sensitivity.simulatedLeaderboard,
      teamDeltas: telemetry.sensitivity.teamDeltas,
    }

    // 4. Insert into fairness_reports using service role to enforce institutional isolation
    const serviceClient = getServiceSupabase()

    const { data: newReport, error: insertErr } = await serviceClient
      .from('fairness_reports')
      .insert({
        event_id: id,
        institution_id: event.institution_id,
        metrics: metricsData,
        flagged_judges: flaggedJudgesData,
        sensitivity_rerank: sensitivityData,
        created_by: user.id,
      })
      .select()
      .single()

    if (insertErr) {
      return NextResponse.json({ error: insertErr.message }, { status: 500 })
    }

    return NextResponse.json({
      success: true,
      message: 'Fairness snapshot computed and archived successfully',
      report: newReport,
    })
  } catch (err: any) {
    return NextResponse.json(
      { error: err.message || 'Internal server error' },
      { status: 500 }
    )
  }
}
