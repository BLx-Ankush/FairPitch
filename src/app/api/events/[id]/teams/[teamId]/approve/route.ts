import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { getServiceSupabase } from '@/lib/supabase/service-role'
import { requireEventOrganizer } from '@/lib/auth/guards'

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string; teamId: string }> }
) {
  try {
    const { id, teamId } = await params
    const auth = await requireEventOrganizer(id)
    if (auth.errorResponse) return auth.errorResponse

    const { status } = await request.json()

    if (!status || !['approved', 'rejected', 'pending'].includes(status)) {
      return NextResponse.json({ error: 'Valid status is required (approved, rejected, pending)' }, { status: 400 })
    }


    const serviceClient = getServiceSupabase()
    const { data: updated, error: updateErr } = await serviceClient
      .from('teams')
      .update({ status, updated_at: new Date().toISOString() })
      .eq('id', teamId)
      .eq('event_id', id)
      .select()
      .single()

    if (updateErr) {
      return NextResponse.json({ error: updateErr.message }, { status: 400 })
    }

    return NextResponse.json({ success: true, team: updated })
  } catch (err: any) {
    return NextResponse.json(
      { error: err.message || 'Internal server error' },
      { status: 500 }
    )
  }
}
