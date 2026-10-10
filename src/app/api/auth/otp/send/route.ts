import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { sendMagicLinkEmail } from '@/lib/email/resend'

/**
 * Dispatches a passwordless Magic Link or 6-digit email OTP code.
 */
export async function POST(request: Request) {
  try {
    const { email, accountType, redirectTo } = await request.json()

    if (!email || !email.includes('@')) {
      return NextResponse.json(
        { error: 'A valid email address is required' },
        { status: 400 }
      )
    }

    const cleanEmail = email.trim().toLowerCase()
    const baseUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'
    const targetDest =
      redirectTo ||
      (accountType === 'admin'
        ? '/admin'
        : accountType === 'organizer'
        ? '/org'
        : accountType === 'jury'
        ? '/jury'
        : '/team')

    const redirectUrl = `${baseUrl}/api/auth/callback?redirectTo=${encodeURIComponent(
      targetDest
    )}&accountType=${encodeURIComponent(accountType || 'participant')}`

    const supabase = await createClient()

    // 1. Invoke Supabase signInWithOtp
    const { error: otpErr } = await supabase.auth.signInWithOtp({
      email: cleanEmail,
      options: {
        emailRedirectTo: redirectUrl,
        shouldCreateUser: true,
      },
    })

    if (otpErr) {
      console.warn('Supabase signInWithOtp notification:', otpErr.message)
      // Fallback for local testing or custom Resend dispatch
      await sendMagicLinkEmail({
        to: cleanEmail,
        magicLink: redirectUrl,
      })
    }

    return NextResponse.json({
      success: true,
      message: `Authentication link sent to ${cleanEmail}. Check your inbox.`,
      email: cleanEmail,
      targetDest,
    })
  } catch (err: any) {
    return NextResponse.json(
      { error: err.message || 'Failed to dispatch email authentication' },
      { status: 500 }
    )
  }
}
