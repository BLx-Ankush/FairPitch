import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { getServiceSupabase } from '@/lib/supabase/service-role'

/**
 * Verifies a 6-digit email OTP token and establishes authenticated session.
 */
export async function POST(request: Request) {
  try {
    const { email, token, accountType, redirectTo } = await request.json()

    if (!email || !token) {
      return NextResponse.json(
        { error: 'Email and verification code are required' },
        { status: 400 }
      )
    }

    const cleanEmail = email.trim().toLowerCase()
    const cleanToken = token.trim()

    const supabase = await createClient()

    // 1. Verify OTP with Supabase Auth
    const { data, error } = await supabase.auth.verifyOtp({
      email: cleanEmail,
      token: cleanToken,
      type: 'email',
    })

    if (error || !data.user) {
      return NextResponse.json(
        { error: error?.message || 'Invalid or expired verification code' },
        { status: 400 }
      )
    }

    // 2. Ensure profile exists and resolve target dashboard
    let targetDest = redirectTo || '/team'
    try {
      const serviceClient = getServiceSupabase()
      const { data: profile } = await serviceClient
        .from('profiles')
        .select('id, role, organizer_approval_status')
        .eq('id', data.user.id)
        .single()

      if (!profile) {
        // Provision profile if new
        const role = accountType === 'admin' ? 'institution_admin' : 'user'
        const organizerStatus = accountType === 'organizer' ? 'pending' : 'none'

        await serviceClient.from('profiles').insert({
          id: data.user.id,
          email: cleanEmail,
          full_name: cleanEmail.split('@')[0],
          role,
          organizer_approval_status: organizerStatus,
        })

        targetDest =
          accountType === 'admin'
            ? '/admin'
            : accountType === 'organizer'
            ? '/pending-approval'
            : accountType === 'jury'
            ? '/jury'
            : '/team'
      } else {
        if (profile.role === 'institution_admin' || profile.role === 'platform_owner') {
          targetDest = '/admin'
        } else if (profile.organizer_approval_status === 'approved') {
          targetDest = '/org'
        } else if (profile.organizer_approval_status === 'pending') {
          targetDest = '/pending-approval'
        } else if (accountType === 'jury') {
          targetDest = '/jury'
        } else {
          targetDest = '/team'
        }
      }
    } catch (profileErr) {
      console.warn('Profile provisioning note:', profileErr)
    }

    return NextResponse.json({
      success: true,
      user: {
        id: data.user.id,
        email: data.user.email,
      },
      targetDest,
    })
  } catch (err: any) {
    return NextResponse.json(
      { error: err.message || 'OTP verification failed' },
      { status: 500 }
    )
  }
}
