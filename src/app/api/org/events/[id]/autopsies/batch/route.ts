import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { getServiceSupabase } from '@/lib/supabase/service-role'
import { computeHeadToHeadAnalysis } from '@/lib/autopsy/math'
import { generateAutopsy } from '@/lib/autopsy/gemini'
import { calculateLeaderboard } from '@/lib/fairness/engine'

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: eventId } = await params
    const supabase = await createClient()

    const {
      data: { user },
      error: authErr,
    } = await supabase.auth.getUser()

    if (authErr || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

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

    const { data: event } = await supabase
      .from('events')
      .select('id, institution_id, title')
      .eq('id', eventId)
      .single()

    if (!event) {
      return NextResponse.json({ error: 'Event not found' }, { status: 404 })
    }

    const [criteriaRes, teamsRes, judgesRes, scoresRes] = await Promise.all([
      supabase
        .from('rubric_criteria')
        .select('id, name, weight, max_score')
        .eq('event_id', eventId),
      supabase.from('teams').select('id, name, tagline').eq('event_id', eventId),
      supabase
        .from('judge_assignments')
        .select('judge_id, profiles:judge_id(id, full_name)')
        .eq('event_id', eventId),
      supabase
        .from('v_latest_scores')
        .select('team_id, judge_id, criterion_id, score, comment, version')
        .eq('event_id', eventId),
    ])

    const criteria = (criteriaRes.data || []).map((c) => ({
      id: c.id,
      name: c.name,
      weight: Number(c.weight),
      max_score: Number(c.max_score) || 10,
    }))

    const teams = (teamsRes.data || []).map((t) => ({
      id: t.id,
      name: t.name,
      tagline: t.tagline,
    }))

    const judgeMap = new Map<string, { id: string; name: string }>()
    for (const a of judgesRes.data || []) {
      const p = a.profiles as any
      if (p && !judgeMap.has(p.id)) {
        judgeMap.set(p.id, { id: p.id, name: p.full_name || 'Panel Evaluator' })
      }
    }
    const judges = Array.from(judgeMap.values())

    const scores = (scoresRes.data || []).map((s) => ({
      team_id: s.team_id,
      judge_id: s.judge_id,
      criterion_id: s.criterion_id,
      score: Number(s.score),
      comment: s.comment,
      version: s.version,
    }))

    const leaderboard = calculateLeaderboard(scores, teams, judges as any, criteria)
    if (leaderboard.length < 2) {
      return NextResponse.json(
        { error: 'At least 2 evaluated teams required to benchmark autopsies' },
        { status: 400 }
      )
    }

    const winner = leaderboard[0].team
    const nonWinningTeams = leaderboard.slice(1).map((r) => r.team)

    const serviceClient = getServiceSupabase()
    const generatedAutopsies: any[] = []

    for (const targetTeam of nonWinningTeams) {
      const analysis = computeHeadToHeadAnalysis(
        targetTeam,
        winner,
        scores,
        criteria,
        judges
      )
      const genResult = await generateAutopsy(analysis)

      const { data: saved } = await serviceClient
        .from('autopsies')
        .upsert(
          {
            event_id: eventId,
            institution_id: event.institution_id,
            team_id: targetTeam.id,
            model_name: genResult.modelName,
            loss_gap_data: {
              teamTotal: analysis.teamTotal,
              winnerTotal: analysis.winnerTotal,
              netDeficit: analysis.netDeficit,
              weightedPointGaps: analysis.weightedPointGaps,
              teamCriterionAverages: analysis.teamCriterionAverages,
              winnerCriterionAverages: analysis.winnerCriterionAverages,
            },
            issues: genResult.issues,
            fixes: genResult.fixes,
            raw_markdown: genResult.rawMarkdown,
            verification_status: genResult.verificationStatus,
          },
          { onConflict: 'event_id,team_id' }
        )
        .select()
        .single()

      if (saved) {
        generatedAutopsies.push(saved)
      }
    }

    return NextResponse.json({
      success: true,
      message: `Batch generated ${generatedAutopsies.length} loss autopsies`,
      count: generatedAutopsies.length,
    })
  } catch (err: any) {
    return NextResponse.json(
      { error: err.message || 'Internal server error' },
      { status: 500 }
    )
  }
}
