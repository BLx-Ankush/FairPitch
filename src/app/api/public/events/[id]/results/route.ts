import { NextResponse } from 'next/server'
import { getServiceSupabase } from '@/lib/supabase/service-role'
import { calculateLeaderboard } from '@/lib/fairness/engine'
import { memoryCache, publicCacheHeaders } from '@/lib/cache/memory-cache'

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: eventId } = await params
    const cacheKey = `event:results:${eventId}`

    const cachedResults = memoryCache.get<any>(cacheKey)
    if (cachedResults) {
      return NextResponse.json(cachedResults, {
        headers: publicCacheHeaders(300, 600),
      })
    }

    const serviceClient = getServiceSupabase()


    // 1. Fetch event metadata
    const { data: event, error: eventErr } = await serviceClient
      .from('events')
      .select('id, title, slug, status, anchored_merkle_root, anchored_at')
      .eq('id', eventId)
      .single()

    if (eventErr || !event) {
      return NextResponse.json({ error: 'Event not found' }, { status: 404 })
    }

    if (event.status !== 'published') {
      return NextResponse.json(
        {
          error: 'Official leaderboard has not been published yet.',
          status: event.status,
        },
        { status: 403 }
      )
    }

    // 2. Fetch criteria, teams, and scores from v_latest_scores
    const [criteriaRes, teamsRes, scoresRes] = await Promise.all([
      serviceClient
        .from('rubric_criteria')
        .select('id, name, weight, max_score')
        .eq('event_id', eventId),
      serviceClient.from('teams').select('id, name, tagline').eq('event_id', eventId),
      serviceClient
        .from('v_latest_scores')
        .select('team_id, judge_id, criterion_id, score, version')
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

    const scores = (scoresRes.data || []).map((s) => ({
      team_id: s.team_id,
      judge_id: s.judge_id,
      criterion_id: s.criterion_id,
      score: Number(s.score),
      version: s.version,
    }))

    // Calculate official leaderboard
    const leaderboard = calculateLeaderboard(scores, teams, [], criteria)

    const responsePayload = {
      success: true,
      event,
      leaderboard,
      criteria,
      podium: leaderboard.slice(0, 3),
    }

    memoryCache.set(cacheKey, responsePayload, 300, ['events', `event:${eventId}`])

    return NextResponse.json(responsePayload, {
      headers: publicCacheHeaders(300, 600),
    })
  } catch (err: any) {
    return NextResponse.json(
      { error: err.message || 'Internal server error' },
      { status: 500 }
    )
  }
}
