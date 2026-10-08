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
      // Check for signed dev/demo user cookie (strictly guarded by environment & signature)
      const { cookies } = await import('next/headers')
      const { DEMO_COOKIE_NAME, verifyDemoCookie } = await import('@/lib/auth/demo-cookie')
      const cookieStore = await cookies()
      const demoCookie = cookieStore.get(DEMO_COOKIE_NAME)?.value
      const demoUser = await verifyDemoCookie(demoCookie)
      if (demoUser) {
        return NextResponse.json({
          authenticated: true,
          user: { id: demoUser.id, email: demoUser.email },
          profile: {
            id: demoUser.id,
            full_name: demoUser.full_name,
            role: demoUser.role,
            organizer_approval_status: demoUser.organizer_approval_status,
            institution_id: demoUser.institution_id,
          },
          role: demoUser.role,
          organizerStatus: demoUser.organizer_approval_status,
          institutionId: demoUser.institution_id,
        })
      }
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
