import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { getServiceSupabase } from '@/lib/supabase/service-role'
import { requireInstitutionAdmin } from '@/lib/auth/guards'

export async function GET() {
  try {
    const auth = await requireInstitutionAdmin()
    if (auth.errorResponse) return auth.errorResponse

    const { user, profile } = auth.caller
    const institutionId = profile.institution_id

    const serviceClient = getServiceSupabase()

    // 1. Fetch institution metadata
    let institutionQuery = serviceClient.from('institutions').select('*')
    if (institutionId) {
      institutionQuery = institutionQuery.eq('id', institutionId)
    }
    const { data: instData } = await institutionQuery.limit(1).maybeSingle()

    // 2. Fetch scoped events
    let eventsQuery = serviceClient.from('events').select('*').order('created_at', { ascending: false })
    if (institutionId && profile.role !== 'platform_owner') {
      eventsQuery = eventsQuery.eq('institution_id', institutionId)
    }
    const { data: events } = await eventsQuery

    const scopedEventIds = (events || []).map((e) => e.id)

    // 3. Fetch scoped teams & registrations
    let teams: any[] = []
    if (scopedEventIds.length > 0) {
      const { data: teamList } = await serviceClient
        .from('teams')
        .select('*, submissions(*)')
        .in('event_id', scopedEventIds)
      teams = teamList || []
    }

    const totalTeams = teams.length
    const verifiedTeams = teams.filter((t) => t.payment_status === 'verified').length
    const pendingApprovals = teams.filter((t) => t.payment_status === 'pending_verification').length
    const totalCollected = teams
      .filter((t) => t.payment_status === 'verified')
      .reduce((sum, t) => sum + (Number(t.amount_paid) || 0), 0)

    // Track distribution
    const trackCounts: Record<string, number> = {}
    teams.forEach((t) => {
      const tr = t.track || 'General'
      trackCounts[tr] = (trackCounts[tr] || 0) + 1
    })
    const trackBreakdown = Object.entries(trackCounts).map(([track, count]) => ({
      track,
      teams: count,
    }))

    // 4. Judging progress per judge
    let judgesProgress: any[] = []
    if (scopedEventIds.length > 0) {
      const { data: assignments } = await serviceClient
        .from('judge_assignments')
        .select('judge_id, status, profiles:judge_id(id, full_name, email)')
        .in('event_id', scopedEventIds)

      const judgeMap: Record<string, { id: string; name: string; email: string; assignedCount: number; scoredCount: number }> = {}

      ;(assignments || []).forEach((a: any) => {
        const jId = a.judge_id
        if (!judgeMap[jId]) {
          judgeMap[jId] = {
            id: jId,
            name: a.profiles?.full_name || 'Jury Member',
            email: a.profiles?.email || '',
            assignedCount: 0,
            scoredCount: 0,
          }
        }
        judgeMap[jId].assignedCount += 1
        if (a.status === 'completed') {
          judgeMap[jId].scoredCount += 1
        }
      })

      judgesProgress = Object.values(judgeMap).map((j) => ({
        ...j,
        completionPct: j.assignedCount > 0 ? Math.round((j.scoredCount / j.assignedCount) * 100) : 0,
      }))
    }

    // 5. Approvals queue
    let pendingOrganizers: any[] = []
    let orgQuery = serviceClient
      .from('profiles')
      .select('id, full_name, email, created_at')
      .eq('organizer_approval_status', 'pending')

    if (institutionId && profile.role !== 'platform_owner') {
      orgQuery = orgQuery.eq('institution_id', institutionId)
    }
    const { data: pendingOrgs } = await orgQuery
    pendingOrganizers = (pendingOrgs || []).map((p) => ({
      id: p.id,
      fullName: p.full_name,
      email: p.email,
      appliedAt: p.created_at,
    }))

    let editRequests: any[] = []
    let reviewRequests: any[] = []
    if (scopedEventIds.length > 0) {
      const [editRes, revRes] = await Promise.all([
        serviceClient
          .from('edit_requests')
          .select('id, reason, status, created_at, teams(name), profiles:judge_id(full_name)')
          .in('event_id', scopedEventIds)
          .eq('status', 'pending'),
        serviceClient
          .from('review_requests')
          .select('id, reason, status, created_at, teams(name)')
          .in('event_id', scopedEventIds)
          .eq('status', 'open'),
      ])

      editRequests = (editRes.data || []).map((e: any) => ({
        id: e.id,
        judgeName: e.profiles?.full_name || 'Judge',
        teamName: e.teams?.name || 'Team',
        reason: e.reason,
        createdAt: e.created_at,
      }))

      reviewRequests = (revRes.data || []).map((r: any) => ({
        id: r.id,
        teamName: r.teams?.name || 'Team',
        reason: r.reason,
        status: r.status,
        createdAt: r.created_at,
      }))
    }

    // Format events with stage timelines
    const formattedEvents = (events || []).map((evt) => {
      const st = evt.status || 'draft'
      return {
        id: evt.id,
        title: evt.title,
        status: st,
        timeline: {
          draft: { date: evt.created_at?.slice(0, 10) || '2026-09-01', completed: true },
          open: { date: '2026-09-15', completed: ['registration', 'scoring', 'review', 'published'].includes(st) },
          judging: { date: '2026-10-01', completed: ['scoring', 'review', 'published'].includes(st), active: st === 'scoring' },
          review: { date: '2026-10-04', completed: ['review', 'published'].includes(st), active: st === 'review' },
          published: { date: '2026-10-05', completed: st === 'published', active: st === 'published' },
        },
        merkleRoot: evt.anchored_merkle_root || evt.merkle_root || null,
        chainVerified: Boolean(evt.anchored_merkle_root || evt.merkle_root),
        totalBlocks: evt.block_count || 0,
      }
    })

    return NextResponse.json({
      success: true,
      institution: instData || { id: institutionId, name: 'Assigned Institution' },
      events: formattedEvents,
      registrations: {
        totalTeams,
        totalParticipants: totalTeams * 4,
        pendingApprovals,
        trackBreakdown,
      },
      judgesProgress,
      approvalsQueue: {
        pendingOrganizers,
        editRequests,
        reviewRequests,
      },
      billingSummary: {
        totalCollected,
        currency: 'INR',
        verifiedCount: verifiedTeams,
        pendingCount: pendingApprovals,
        feePerTeam: 500,
      },
    })
  } catch (err: any) {
    return NextResponse.json(
      { error: err.message || 'Internal server error' },
      { status: 500 }
    )
  }
}
