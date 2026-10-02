import { NextResponse } from 'next/server'
import { cookies } from 'next/headers'

// Demo accounts matching supabase/seed.sql
const DEMO_ACCOUNTS = {
  institution_admin: {
    id: 'b0000000-0000-0000-0000-000000000001',
    email: 'admin@nexis.edu',
    full_name: 'Dean Sarah Lin',
    role: 'institution_admin',
    organizer_approval_status: 'approved',
    institution_id: 'a0000000-0000-0000-0000-000000000001',
    destination: '/admin',
  },
  organizer: {
    id: 'b0000000-0000-0000-0000-000000000002',
    email: 'organizer@nexis.edu',
    full_name: 'Kavita Rao',
    role: 'user',
    organizer_approval_status: 'approved',
    institution_id: 'a0000000-0000-0000-0000-000000000001',
    destination: '/org',
  },
  jury: {
    id: 'b0000000-0000-0000-0000-000000000011',
    email: 'evelyn@nexis.edu',
    full_name: 'Dr. Evelyn Vance',
    role: 'user',
    isJury: true,
    organizer_approval_status: 'none',
    institution_id: 'a0000000-0000-0000-0000-000000000001',
    destination: '/jury',
  },
  participant: {
    id: 'b0000000-0000-0000-0000-000000000021',
    email: 'ada@nexis.edu',
    full_name: 'Ada Lovelace',
    role: 'user',
    organizer_approval_status: 'none',
    institution_id: 'a0000000-0000-0000-0000-000000000001',
    destination: '/team',
  },
}

export async function POST(request: Request) {
  try {
    const { role } = await request.json()
    const account = DEMO_ACCOUNTS[role as keyof typeof DEMO_ACCOUNTS]

    if (!account) {
      return NextResponse.json({ error: 'Invalid demo role selected' }, { status: 400 })
    }

    const cookieStore = await cookies()
    cookieStore.set('fairpitch_demo_user', JSON.stringify(account), {
      path: '/',
      httpOnly: false, // Accessible to client and proxy
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
