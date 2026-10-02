import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { getServiceSupabase } from '@/lib/supabase/service-role'
import { computeHeadToHeadAnalysis } from '@/lib/autopsy/math'
import { generateAutopsy } from '@/lib/autopsy/gemini'
import { calculateLeaderboard } from '@/lib/fairness/engine'

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string; teamId: string }> }
) {
  try {
    const { id: eventId, teamId } = await params
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
      .eq('id', eventId)
      .single()

    if (eventErr || !event) {
      return NextResponse.json({ error: 'Event not found' }, { status: 404 })
    }

    // 2. Check permissions: Organizer can always view; Participant can only view if published
    const { data: orgRole } = await supabase
      .from('event_roles')
      .select('role')
      .eq('event_id', eventId)
      .eq('user_id', user.id)
      .in('role', ['admin', 'organizer'])
      .maybeSingle()

    const isOrganizer = Boolean(orgRole)

    if (!isOrganizer) {
      // Must be team member
      const { data: member } = await supabase
        .from('team_members')
        .select('id')
        .eq('team_id', teamId)
        .eq('user_id', user.id)
        .maybeSingle()

      if (!member) {
        return NextResponse.json(
          { error: 'Forbidden: You are not a member of this team' },
          { status: 403 }
        )
      }

      if (event.status !== 'published') {
        return NextResponse.json(
          {
            error:
              'Loss Autopsies are sealed and will be unlocked once event results are published.',
            eventStatus: event.status,
          },
          { status: 403 }
        )
      }
    }

    // 3. Check if autopsy already exists in database
    const { data: existingAutopsy } = await supabase
      .from('autopsies')
      .select('*')
      .eq('event_id', eventId)
      .eq('team_id', teamId)
      .maybeSingle()

    if (existingAutopsy) {
      return NextResponse.json({
        success: true,
        autopsy: existingAutopsy,
        source: 'database',
      })
    }

    // 4. If not exists, generate it
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

    // Determine 1st-place benchmark winner using fairness engine leaderboard
    const leaderboard = calculateLeaderboard(scores, teams, judges as any, criteria)
    const winner = leaderboard[0]?.team
    const targetTeam = teams.find((t) => t.id === teamId)

    if (!targetTeam) {
      return NextResponse.json({ error: 'Team not found' }, { status: 404 })
    }

    if (!winner) {
      return NextResponse.json(
        { error: 'Cannot generate autopsy: No evaluated scores in event' },
        { status: 400 }
      )
    }

    // Run math deficit analysis
    const analysis = computeHeadToHeadAnalysis(
      targetTeam,
      winner,
      scores,
      criteria,
      judges
    )

    // Run Gemini generation (with deterministic fallback)
    const genResult = await generateAutopsy(analysis)

    // Store in public.autopsies table via service-role
    const serviceClient = getServiceSupabase()
    const { data: savedAutopsy, error: insertErr } = await serviceClient
      .from('autopsies')
      .upsert(
        {
          event_id: eventId,
          institution_id: event.institution_id,
          team_id: teamId,
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

    if (insertErr) {
      return NextResponse.json({ error: insertErr.message }, { status: 500 })
    }

    return NextResponse.json({
      success: true,
      autopsy: savedAutopsy,
      source: 'generated',
    })
  } catch (err: any) {
    return NextResponse.json(
      { error: err.message || 'Internal server error' },
      { status: 500 }
    )
  }
}
