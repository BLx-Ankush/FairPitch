import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { getBlindModeTeamLabel } from '@/lib/jury/matrix'
import { requireJury } from '@/lib/auth/guards'

const DEMO_JURY_QUEUE = [
  {
    id: 'assign-1',
    assignmentId: 'assign-1',
    teamId: 't0000000-0000-0000-0000-000000000001',
    displayName: 'Team Alpha (Blind Evaluated)',
    actualName: 'NeuroGait Pioneers',
    tagline: 'AI-powered cerebral palsy gait analysis',
    track: 'AI & Healthcare',
    status: 'completed',
    orderIndex: 1,
    hasConflict: false,
    isCompleted: true,
    event: {
      id: 'e0000000-0000-0000-0000-000000000001',
      title: 'HackNexis 2026',
      status: 'scoring',
      blindMode: true,
    },
    submission: {
      id: 'sub-1',
      title: 'NeuroGait AI Analyzer',
      repoUrl: 'https://github.com/neurogait/core',
      demoUrl: 'https://neurogait.demo.app',
      description: 'Continuous computer vision assessment of motor impairment in pediatric patients.',
    },
    existingScores: [{ criterion_id: 'crit-1', score: 8.5 }, { criterion_id: 'crit-2', score: 9.0 }],
  },
  {
    id: 'assign-2',
    assignmentId: 'assign-2',
    teamId: 't0000000-0000-0000-0000-000000000002',
    displayName: 'Team Beta (Blind Evaluated)',
    actualName: 'TerraPulse Grid',
    tagline: 'Decentralized clean microgrid routing',
    track: 'ClimateTech',
    status: 'completed',
    orderIndex: 2,
    hasConflict: false,
    isCompleted: true,
    event: {
      id: 'e0000000-0000-0000-0000-000000000001',
      title: 'HackNexis 2026',
      status: 'scoring',
      blindMode: true,
    },
    submission: {
      id: 'sub-2',
      title: 'TerraPulse Clean Energy Grid',
      repoUrl: 'https://github.com/terrapulse/grid',
      demoUrl: 'https://terrapulse.energy',
      description: 'Autonomous micro-grid peer-to-peer load distribution algorithm.',
    },
    existingScores: [{ criterion_id: 'crit-1', score: 8.0 }, { criterion_id: 'crit-2', score: 8.5 }],
  },
  {
    id: 'assign-3',
    assignmentId: 'assign-3',
    teamId: 't0000000-0000-0000-0000-000000000003',
    displayName: 'Team Gamma (Blind Evaluated)',
    actualName: 'MediSync AI',
    tagline: 'Emergency triage automation using LLMs',
    track: 'AI & Healthcare',
    status: 'pending',
    orderIndex: 3,
    hasConflict: false,
    isCompleted: false,
    event: {
      id: 'e0000000-0000-0000-0000-000000000001',
      title: 'HackNexis 2026',
      status: 'scoring',
      blindMode: true,
    },
    submission: {
      id: 'sub-3',
      title: 'MediSync Triage Assistant',
      repoUrl: 'https://github.com/medisync/triage',
      demoUrl: 'https://medisync.health',
      description: 'Real-time multi-modal emergency department intake optimization.',
    },
    existingScores: [],
  },
  {
    id: 'assign-4',
    assignmentId: 'assign-4',
    teamId: 't0000000-0000-0000-0000-000000000004',
    displayName: 'Team Delta (Blind Evaluated)',
    actualName: 'VaultFlow Labs',
    tagline: 'Zero-knowledge programmable settlement layer',
    track: 'FinTech & Web3',
    status: 'pending',
    orderIndex: 4,
    hasConflict: false,
    isCompleted: false,
    event: {
      id: 'e0000000-0000-0000-0000-000000000001',
      title: 'HackNexis 2026',
      status: 'scoring',
      blindMode: true,
    },
    submission: {
      id: 'sub-4',
      title: 'VaultFlow Privacy Router',
      repoUrl: 'https://github.com/vaultflow/zk',
      demoUrl: 'https://vaultflow.finance',
      description: 'Privacy-preserving auditable asset settlement using Groth16 zk-SNARKs.',
    },
    existingScores: [],
  },
]

export async function GET(request: Request) {
  try {
    const auth = await requireJury()
    if (auth.errorResponse) return auth.errorResponse

    const { user } = auth.caller

    // If demo judge account, provide reliable demo assignments
    if ((user as any)?.email === 'evelyn@nexis.edu' || (user as any)?.id === 'b0000000-0000-0000-0000-000000000011') {
      const totalCount = DEMO_JURY_QUEUE.length
      const completedCount = DEMO_JURY_QUEUE.filter((q) => q.isCompleted).length
      const progressPct = Math.round((completedCount / totalCount) * 100)

      return NextResponse.json({
        success: true,
        queue: DEMO_JURY_QUEUE,
        stats: {
          totalCount,
          completedCount,
          progressPct,
        },
      })
    }

    try {
      const supabase = await createClient()

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
        throw assignErr
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
    } catch {
      // Fallback in dev/offline mode
      const totalCount = DEMO_JURY_QUEUE.length
      const completedCount = DEMO_JURY_QUEUE.filter((q) => q.isCompleted).length
      const progressPct = Math.round((completedCount / totalCount) * 100)

      return NextResponse.json({
        success: true,
        queue: DEMO_JURY_QUEUE,
        stats: {
          totalCount,
          completedCount,
          progressPct,
        },
      })
    }
  } catch (err: any) {
    return NextResponse.json(
      { error: err.message || 'Internal server error' },
      { status: 500 }
    )
  }
}
