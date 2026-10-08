import { NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { DEMO_COOKIE_NAME, isDemoModeAllowed, signDemoPayload } from '@/lib/auth/demo-cookie'

// Demo accounts matching supabase/seed.sql
const DEMO_ACCOUNTS = {
  institution_admin: {
    id: 'b0000000-0000-0000-0000-000000000001',
    email: 'admin@nexis.edu',
    full_name: 'Dean Sarah Lin',
    role: 'institution_admin' as const,
    organizer_approval_status: 'approved' as const,
    institution_id: 'a0000000-0000-0000-0000-000000000001',
    destination: '/admin',
  },
  organizer: {
    id: 'b0000000-0000-0000-0000-000000000002',
    email: 'organizer@nexis.edu',
    full_name: 'Kavita Rao',
    role: 'user' as const,
    organizer_approval_status: 'approved' as const,
    institution_id: 'a0000000-0000-0000-0000-000000000001',
    destination: '/org',
  },
  jury: {
    id: 'b0000000-0000-0000-0000-000000000011',
    email: 'evelyn@nexis.edu',
    full_name: 'Dr. Evelyn Vance',
    role: 'user' as const,
    isJury: true,
    organizer_approval_status: 'none' as const,
    institution_id: 'a0000000-0000-0000-0000-000000000001',
    destination: '/jury',
  },
  participant: {
    id: 'b0000000-0000-0000-0000-000000000021',
    email: 'ada@nexis.edu',
    full_name: 'Ada Lovelace',
    role: 'user' as const,
    organizer_approval_status: 'none' as const,
    institution_id: 'a0000000-0000-0000-0000-000000000001',
    destination: '/team',
  },
}

export async function POST(request: Request) {
  try {
    if (!isDemoModeAllowed()) {
      return NextResponse.json(
        { error: 'Demo mode is disabled in this environment' },
        { status: 403 }
      )
    }

    const { role } = await request.json()
    const targetKey = role === 'admin' ? 'institution_admin' : role
    const account = DEMO_ACCOUNTS[targetKey as keyof typeof DEMO_ACCOUNTS]

    if (!account) {
      return NextResponse.json({ error: 'Invalid demo role selected' }, { status: 400 })
    }

    // Cryptographically sign the demo payload with HMAC-SHA256
    const signedToken = await signDemoPayload({
      id: account.id,
      email: account.email,
      full_name: account.full_name,
      role: account.role,
      organizer_approval_status: account.organizer_approval_status,
      institution_id: account.institution_id,
      isJury: (account as any).isJury,
    })

    const cookieStore = await cookies()
    cookieStore.set(DEMO_COOKIE_NAME, signedToken, {
      path: '/',
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      maxAge: 60 * 60 * 24 * 7, // 7 days
      sameSite: 'lax',
    })

    return NextResponse.json({
      success: true,
      user: account,
      destination: account.destination,
    })
  } catch (err: any) {
    return NextResponse.json(
      { error: err.message || 'Failed to switch demo role' },
      { status: 500 }
    )
  }
}

