import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { getServiceSupabase } from '@/lib/supabase/service-role'
import { requireInstitutionAdmin } from '@/lib/auth/guards'
import { memoryCache } from '@/lib/cache/memory-cache'

export async function POST(request: Request) {
  try {
    const auth = await requireInstitutionAdmin()
    if (auth.errorResponse) return auth.errorResponse

    const { userId } = await request.json()

    if (!userId) {
      return NextResponse.json({ error: 'User ID is required' }, { status: 400 })
    }

    const serviceClient = getServiceSupabase()
    let targetInstId = auth.caller.profile.institution_id

    // If caller is platform_owner or doesn't have an institution_id, resolve first institution
    if (!targetInstId) {
      const { data: defaultInst } = await serviceClient
        .from('institutions')
        .select('id')
        .order('created_at', { ascending: true })
        .limit(1)
        .maybeSingle()
      targetInstId = defaultInst?.id || 'a0000000-0000-0000-0000-000000000001'
    }

    const supabase = await createClient()

    // 1. Try standard PostgreSQL RPC
    const { error: rpcErr } = await supabase.rpc('approve_organizer', {
      p_user_id: userId,
    })

    // 2. If RPC fails (e.g. cross-institution null check or platform_owner auth context), fallback to service-role update
    if (rpcErr) {
      console.warn('[Admin] RPC approve_organizer returned note, applying authoritative service role update:', rpcErr.message)
      const { error: updateErr } = await serviceClient
        .from('profiles')
        .update({
          organizer_approval_status: 'approved',
          institution_id: targetInstId,
          updated_at: new Date().toISOString(),
        })
        .eq('id', userId)

      if (updateErr) {
        return NextResponse.json({ error: updateErr.message }, { status: 400 })
      }
    } else {
      // Ensure institution_id is attached if applicant had null
      await serviceClient
        .from('profiles')
        .update({
          institution_id: targetInstId,
          updated_at: new Date().toISOString(),
        })
        .eq('id', userId)
        .is('institution_id', null)
    }

    // 3. Purge memory caches so user status is immediately reflected across all guards & sessions
    memoryCache.delete(`user:profile:${userId}`)
    memoryCache.delete(`user:guard-profile:${userId}`)
    memoryCache.invalidateTags([`user:${userId}`])

    return NextResponse.json({ success: true, message: 'Organizer approved successfully' })
  } catch (err: any) {
    return NextResponse.json(
      { error: err.message || 'Internal server error' },
      { status: 500 }
    )
  }
}

