import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { requireInstitutionAdmin } from '@/lib/auth/guards'

export async function GET() {
  try {
    const auth = await requireInstitutionAdmin()
    if (auth.errorResponse) return auth.errorResponse

    const { user, profile } = auth.caller

    const supabase = await createClient()

    // List organizers within caller's institution
    const query = supabase
      .from('profiles')
      .select('id, full_name, email, organizer_approval_status, created_at')
      .neq('organizer_approval_status', 'none')

    if (profile.role !== 'platform_owner') {
      query.eq('institution_id', profile.institution_id)
    }

    const { data: organizers, error: listErr } = await query.order('created_at', { ascending: false })

    if (listErr) {
      return NextResponse.json({ error: listErr.message }, { status: 500 })
    }

    return NextResponse.json({ success: true, organizers })
  } catch (err: any) {
    return NextResponse.json(
      { error: err.message || 'Internal server error' },
      { status: 500 }
    )
  }
}
