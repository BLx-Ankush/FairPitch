import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { sendPasswordResetEmail } from '@/lib/email/resend'

/**
 * Handles password reset dispatch and authenticated password update.
 */
export async function POST(request: Request) {
  try {
    const body = await request.json()
    const { email, password } = body

    const supabase = await createClient()

    // 1. Password Update flow (user already opened recovery link and has active session)
    if (password) {
      if (password.length < 8) {
        return NextResponse.json(
          { error: 'Password must be at least 8 characters' },
          { status: 400 }
        )
      }

      const { data, error } = await supabase.auth.updateUser({ password })
      if (error) {
        return NextResponse.json({ error: error.message }, { status: 400 })
      }

      return NextResponse.json({
        success: true,
        message: 'Password updated successfully',
        user: { id: data.user.id, email: data.user.email },
      })
    }

    // 2. Password Reset Request flow (send email with recovery token)
    if (!email) {
      return NextResponse.json(
        { error: 'Email address is required to reset password' },
        { status: 400 }
      )
    }

    const cleanEmail = email.trim().toLowerCase()
    const baseUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'
    const resetUrl = `${baseUrl}/api/auth/callback?type=recovery&redirectTo=${encodeURIComponent(
      '/auth?mode=reset'
    )}`

    const { error: resetErr } = await supabase.auth.resetPasswordForEmail(cleanEmail, {
      redirectTo: resetUrl,
    })

    if (resetErr) {
      console.warn('Supabase resetPasswordForEmail notice:', resetErr.message)
      // Custom Resend dispatch fallback
      await sendPasswordResetEmail({
        to: cleanEmail,
        resetUrl,
      })
    }

    return NextResponse.json({
      success: true,
      message: `Password reset instructions sent to ${cleanEmail}. Check your inbox.`,
    })
  } catch (err: any) {
    return NextResponse.json(
      { error: err.message || 'Password reset request failed' },
      { status: 500 }
    )
  }
}
