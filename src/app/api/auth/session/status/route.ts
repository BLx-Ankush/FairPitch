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
      return NextResponse.json({ error: 'Unauthorized', authenticated: false }, { status: 401 })
    }

    const { data: profile } = await supabase
      .from('profiles')
      .select('id, full_name, role, organizer_approval_status, institution_id')
      .eq('id', user.id)
      .single()

    return NextResponse.json({
      authenticated: true,
      user: { id: user.id, email: user.email },
      profile,
      role: profile?.role || 'user',
      organizerStatus: profile?.organizer_approval_status || 'none',
      institutionId: profile?.institution_id || null,
    })
  } catch (err: any) {
    return NextResponse.json(
      { error: err.message || 'Internal server error' },
      { status: 500 }
    )
  }
}
