import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { getServiceSupabase } from '@/lib/supabase/service-role'

export async function GET(request: Request) {
  const requestUrl = new URL(request.url)
  const code = requestUrl.searchParams.get('code')
  const accountType = requestUrl.searchParams.get('accountType')
  let redirectTo = requestUrl.searchParams.get('redirectTo') || requestUrl.searchParams.get('next')

  if (code) {
    const supabase = await createClient()
    const { data, error } = await supabase.auth.exchangeCodeForSession(code)

    if (!error && data.user) {
      let dest = redirectTo || '/team'

      // Ensure user profile exists
      try {
        const serviceClient = getServiceSupabase()
        const { data: existingProfile } = await serviceClient
          .from('profiles')
          .select('id, role, organizer_approval_status')
          .eq('id', data.user.id)
          .single()

        if (!existingProfile) {
          const fullName =
            data.user.user_metadata?.full_name ||
            data.user.user_metadata?.name ||
            data.user.email?.split('@')[0] ||
            'FairPitch User'

          let role: 'institution_admin' | 'user' = 'user'
          let organizerStatus: 'none' | 'pending' | 'approved' = 'none'

          if (accountType === 'institution_admin') {
            role = 'institution_admin'
            organizerStatus = 'approved'
            dest = '/admin'
          } else if (accountType === 'organizer') {
            role = 'user'
            organizerStatus = 'pending'
            dest = '/pending-approval'
          } else {
            dest = '/team'
          }

          await serviceClient.from('profiles').insert({
            id: data.user.id,
            email: data.user.email,
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
          } else {
            dest = '/team'
          }
        }
      } catch (err) {
        console.error('Error provisioning profile after Google OAuth:', err)
      }

      return NextResponse.redirect(new URL(dest, requestUrl.origin))
    }
  }

  // If error or no code, return to login with error parameter
  return NextResponse.redirect(
    new URL('/login?error=Google authentication failed. Please try again.', requestUrl.origin)
  )
}
