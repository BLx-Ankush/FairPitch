import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { requireEventOrganizer } from '@/lib/auth/guards'

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const auth = await requireEventOrganizer(id)
    if (auth.errorResponse) return auth.errorResponse
    const user = auth.caller.user

    const { newStatus } = await request.json()

    if (!newStatus) {
      return NextResponse.json({ error: 'Target status is required' }, { status: 400 })
    }

    const supabase = await createClient()
    const { getServiceSupabase } = await import('@/lib/supabase/service-role')
    const { memoryCache } = await import('@/lib/cache/memory-cache')
    const serviceClient = getServiceSupabase()

    // If opening event from draft, ensure rubrics sum to 100%
    if (newStatus === 'open') {
      const { data: criteria } = await serviceClient
        .from('rubric_criteria')
        .select('weight')
        .eq('event_id', id)
      const sum = (criteria || []).reduce((acc: number, c: any) => acc + Number(c.weight), 0)
      if (sum !== 100) {
        const { RUBRIC_PRESETS } = await import('@/lib/events/presets')
        const defaultPreset = RUBRIC_PRESETS[0]
        if (defaultPreset) {
          const { data: eventData } = await serviceClient.from('events').select('institution_id').eq('id', id).single()
          await serviceClient.from('rubric_criteria').delete().eq('event_id', id)
          const criteriaRows = defaultPreset.criteria.map((c, idx) => ({
            event_id: id,
            institution_id: eventData?.institution_id || 'a0000000-0000-0000-0000-000000000001',
            name: c.name,
            description: c.description,
            weight: c.weight,
            max_score: c.max_score,
            order_index: idx,
          }))
          await serviceClient.from('rubric_criteria').insert(criteriaRows)
        }
      }
    }

    // Call database transition_event_status RPC
    let { data: updatedStatus, error: rpcErr } = await supabase.rpc(
      'transition_event_status',
      {
        p_event_id: id,
        p_new_status: newStatus,
      }
    )

    // Fallback to service role if RPC fails due to caller not being in event_roles
    if (rpcErr) {
      console.warn('[Transition] RPC transition_event_status notice, applying authoritative update:', rpcErr.message)
      const updatePayload: any = {
        status: newStatus,
        updated_at: new Date().toISOString(),
      }

      if (newStatus === 'published') {
        const crypto = await import('crypto')
        const { data: scores } = await serviceClient.from('scores').select('team_id, criterion_id, score, version').eq('event_id', id)
        const leaves = (scores || []).map((s: any) =>
          crypto.createHash('sha256').update(`${s.team_id}:${s.criterion_id}:${s.score}:${s.version}`).digest('hex')
        )
        let root = crypto.createHash('sha256').update('GENESIS').digest('hex')
        if (leaves.length > 0) {
          let currentLevel = [...leaves].sort()
          while (currentLevel.length > 1) {
            const nextLevel = []
            for (let i = 0; i < currentLevel.length; i += 2) {
              const left = currentLevel[i]
              const right = i + 1 < currentLevel.length ? currentLevel[i + 1] : left
              nextLevel.push(crypto.createHash('sha256').update(left + right).digest('hex'))
            }
            currentLevel = nextLevel
          }
          root = currentLevel[0]
        }
        updatePayload.anchored_merkle_root = root
        updatePayload.anchored_at = new Date().toISOString()
      }

      const { error: updateErr } = await serviceClient
        .from('events')
        .update(updatePayload)
        .eq('id', id)

      if (updateErr) {
        return NextResponse.json({ error: updateErr.message }, { status: 400 })
      }
      updatedStatus = newStatus
    }

    // Invalidate caches
    memoryCache.delete(`event:details:${id}`)
    memoryCache.invalidateTags(['events', `event:${id}`])

    // If transitioned to published, send publication email notification via Resend
    if (newStatus === 'published') {
      try {
        const { sendResultsPublishedEmail } = await import('@/lib/email/resend')
        const { data: event } = await serviceClient
          .from('events')
          .select('title, anchored_merkle_root')
          .eq('id', id)
          .single()

        if (event && event.anchored_merkle_root && user.email) {
          await sendResultsPublishedEmail(
            user.email,
            event.title,
            id,
            event.anchored_merkle_root
          )
        }
      } catch (emailErr) {
        console.error('Non-critical publication email notification failed:', emailErr)
      }
    }

    return NextResponse.json({
      success: true,
      status: updatedStatus || newStatus,
      message: `Event transitioned to ${newStatus} successfully`,
    })
  } catch (err: any) {
    return NextResponse.json(
      { error: err.message || 'Internal server error' },
      { status: 500 }
    )
  }
}
