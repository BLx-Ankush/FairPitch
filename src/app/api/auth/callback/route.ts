import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { getServiceSupabase } from '@/lib/supabase/service-role'

export async function GET(request: Request) {
  const requestUrl = new URL(request.url)
  const code = requestUrl.searchParams.get('code')
  const accountType = requestUrl.searchParams.get('accountType')
  let redirectTo = requestUrl.searchParams.get('redirectTo') || requestUrl.searchParams.get('next')

  const tokenHash = requestUrl.searchParams.get('token_hash')
  const type = requestUrl.searchParams.get('type') as any

  let authUser: any = null

  const supabase = await createClient()

  if (code) {
    const { data, error } = await supabase.auth.exchangeCodeForSession(code)
    if (!error && data?.user) {
      authUser = data.user
    }
  } else if (tokenHash && type) {
    const { data, error } = await supabase.auth.verifyOtp({
      token_hash: tokenHash,
      type,
    })
    if (!error && data?.user) {
      authUser = data.user
    }
  }

  if (authUser) {
    let dest = redirectTo || (accountType === 'jury' ? '/jury' : '/team')

    if (type === 'recovery') {
      return NextResponse.redirect(new URL('/auth?mode=reset', requestUrl.origin))
    }

    // Ensure user profile exists
    try {
      const serviceClient = getServiceSupabase()
      const { data: existingProfile } = await serviceClient
        .from('profiles')
        .select('id, role, organizer_approval_status')
        .eq('id', authUser.id)
        .single()

      if (!existingProfile) {
        const fullName =
          authUser.user_metadata?.full_name ||
          authUser.user_metadata?.name ||
          authUser.email?.split('@')[0] ||
          'FairPitch User'

        let role: 'institution_admin' | 'user' = 'user'
        let organizerStatus: 'none' | 'pending' | 'approved' = 'none'

        if (accountType === 'institution_admin' || accountType === 'admin') {
          role = 'institution_admin'
          organizerStatus = 'approved'
          dest = '/admin'
        } else if (accountType === 'organizer') {
          role = 'user'
          organizerStatus = 'pending'
          dest = '/pending-approval'
        } else if (accountType === 'jury') {
          dest = '/jury'
        } else {
          dest = '/team'
        }

        await serviceClient.from('profiles').insert({
          id: authUser.id,
          email: authUser.email,
          full_name: fullName,
          role,
          organizer_approval_status: organizerStatus,
        })
      } else {
        // If already existing, route to appropriate dashboard
        if (existingProfile.role === 'institution_admin' || existingProfile.role === 'platform_owner') {
          dest = '/admin'
        } else if (existingProfile.organizer_approval_status === 'approved') {
          dest = '/org'
        } else if (existingProfile.organizer_approval_status === 'pending') {
          dest = '/pending-approval'
        } else if (accountType === 'jury') {
          dest = '/jury'
        } else {
          dest = redirectTo || '/team'
        }
      }
    } catch (err) {
      console.error('Error provisioning profile in auth callback:', err)
    }

    return NextResponse.redirect(new URL(dest, requestUrl.origin))
  }

  // If error or no valid code/token_hash, return to login with informative parameter
  return NextResponse.redirect(
    new URL('/login?error=Authentication link expired or invalid. Please try again.', requestUrl.origin)
  )
}
