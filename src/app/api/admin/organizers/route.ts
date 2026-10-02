import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export async function GET() {
  try {
    const supabase = await createClient()
    const {
      data: { user },
      error: userErr,
    } = await supabase.auth.getUser()

    if (userErr || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Verify caller is institution_admin or platform_owner
    const { data: profile } = await supabase
      .from('profiles')
      .select('institution_id, role')
      .eq('id', user.id)
      .single()

    if (!profile || (profile.role !== 'institution_admin' && profile.role !== 'platform_owner')) {
      return NextResponse.json(
        { error: 'Forbidden: Institution administrator access required' },
        { status: 403 }
      )
    }

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
