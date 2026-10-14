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
    const supabase = await createClient()

    // 1. Try standard PostgreSQL RPC
    const { error: rpcErr } = await supabase.rpc('reject_organizer', {
      p_user_id: userId,
    })

    // 2. Fallback to direct service-role update if RPC fails
    if (rpcErr) {
      console.warn('[Admin] RPC reject_organizer note, applying authoritative update:', rpcErr.message)
      const { error: updateErr } = await serviceClient
        .from('profiles')
        .update({
          organizer_approval_status: 'rejected',
          updated_at: new Date().toISOString(),
        })
        .eq('id', userId)

      if (updateErr) {
        return NextResponse.json({ error: updateErr.message }, { status: 400 })
      }
    }

    // 3. Purge memory caches
    memoryCache.delete(`user:profile:${userId}`)
    memoryCache.delete(`user:guard-profile:${userId}`)
    memoryCache.invalidateTags([`user:${userId}`])

    return NextResponse.json({ success: true, message: 'Organizer application declined successfully' })
  } catch (err: any) {
    return NextResponse.json(
      { error: err.message || 'Internal server error' },
      { status: 500 }
    )
  }
}

