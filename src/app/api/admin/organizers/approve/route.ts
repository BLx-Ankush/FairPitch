import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { requireInstitutionAdmin } from '@/lib/auth/guards'

export async function POST(request: Request) {
  try {
    const auth = await requireInstitutionAdmin()
    if (auth.errorResponse) return auth.errorResponse

    const { userId } = await request.json()

    if (!userId) {
      return NextResponse.json({ error: 'User ID is required' }, { status: 400 })
    }

    const supabase = await createClient()

    const { error: rpcErr } = await supabase.rpc('approve_organizer', {
      p_user_id: userId,
    })

    if (rpcErr) {
      return NextResponse.json({ error: rpcErr.message }, { status: 400 })
    }

    return NextResponse.json({ success: true, message: 'Organizer approved successfully' })
  } catch (err: any) {
    return NextResponse.json(
      { error: err.message || 'Internal server error' },
      { status: 500 }
    )
  }
}
