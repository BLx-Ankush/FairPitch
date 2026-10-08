import { NextResponse, type NextRequest } from 'next/server'
import { createProxyClient } from '@/lib/supabase/proxy'

export async function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl
  const { supabase, getResponse } = createProxyClient(request)

  // 1. Static and public system files pass through unconditionally
  if (
    pathname.startsWith('/_next') ||
    pathname.startsWith('/api') ||
    pathname.includes('.') ||
    pathname === '/favicon.ico'
  ) {
    return getResponse()
  }

  // 2. Refresh or retrieve user session
  let {
    data: { user },
  } = await supabase.auth.getUser()

  let role = 'user'
  let organizerStatus = 'none'
  let institutionId: string | null = null
  let hasConsent = false

  // Dev / Demo Cookie Support (only trusted if cryptographically signed and demo mode is allowed)
  const { DEMO_COOKIE_NAME, verifyDemoCookie } = await import('@/lib/auth/demo-cookie')
  const demoCookie = request.cookies.get(DEMO_COOKIE_NAME)?.value
  const demoData = await verifyDemoCookie(demoCookie)
  if (!user && demoData) {
    user = { id: demoData.id, email: demoData.email, isJury: demoData.isJury } as any
    role = demoData.role || 'user'
    organizerStatus = demoData.organizer_approval_status || 'none'
    institutionId = demoData.institution_id || null
    hasConsent = true
  }

  const isPublicRoute =
    pathname === '/' ||
    pathname.startsWith('/verify') ||
    pathname.startsWith('/invite') ||
    pathname === '/unauthorized'

  const isAuthRoute = pathname === '/login' || pathname === '/signup' || pathname === '/auth'

  // 3. Unauthenticated requests to protected paths
  if (!user) {
    if (isPublicRoute || isAuthRoute) {
      return getResponse()
    }
    const redirectUrl = new URL('/auth', request.url)
    redirectUrl.searchParams.set('redirectTo', pathname)
    return NextResponse.redirect(redirectUrl)
  }

  // 4. Load user profile for tenant & role checks if not already set from demo session
  if (!hasConsent) {
    const { data: profile } = await supabase
      .from('profiles')
      .select('id, role, institution_id, organizer_approval_status')
      .eq('id', user.id)
      .single()

    role = profile?.role || 'user'
    organizerStatus = profile?.organizer_approval_status || 'none'
    institutionId = profile?.institution_id || null

    // 5. Check DPDP Consent
    const { data: consentRecord } = await supabase
      .from('consents')
      .select('id')
      .eq('user_id', user.id)
      .limit(1)

    hasConsent = Boolean(consentRecord && consentRecord.length > 0)
  }

  // If user has not signed consent, force /consent unless already there or signing out
  if (!hasConsent) {
    if (pathname !== '/consent') {
      const consentUrl = new URL('/consent', request.url)
      consentUrl.searchParams.set('redirectTo', pathname)
      return NextResponse.redirect(consentUrl)
    }
    return getResponse()
  } else if (pathname === '/consent') {
    // If user already signed consent, don't keep them on /consent
    const homeUrl = new URL(
      role === 'institution_admin' || role === 'platform_owner'
        ? '/admin'
        : organizerStatus === 'approved'
        ? '/org'
        : organizerStatus === 'pending'
        ? '/pending-approval'
        : '/team',
      request.url
    )
    return NextResponse.redirect(homeUrl)
  }

  // 6. Authenticated user visiting /login, /signup, or /auth -> redirect to appropriate dashboard
  if (isAuthRoute) {
    const dest =
      role === 'institution_admin' || role === 'platform_owner'
        ? '/admin'
        : organizerStatus === 'approved'
        ? '/org'
        : organizerStatus === 'pending'
        ? '/pending-approval'
        : '/team'
    return NextResponse.redirect(new URL(dest, request.url))
  }

  // 7. Route role gating

  // /admin/* -> Only platform_owner or institution_admin
  if (pathname.startsWith('/admin')) {
    if (role !== 'platform_owner' && role !== 'institution_admin') {
      const unauthUrl = new URL('/unauthorized', request.url)
      unauthUrl.searchParams.set('reason', 'admin_privileges_required')
      return NextResponse.redirect(unauthUrl)
    }
    return getResponse()
  }

  // /org/* -> platform_owner, institution_admin, or approved organizer
  if (pathname.startsWith('/org')) {
    if (role === 'platform_owner' || role === 'institution_admin') {
      return getResponse()
    }
    if (organizerStatus === 'pending') {
      return NextResponse.redirect(new URL('/pending-approval', request.url))
    }
    if (organizerStatus === 'rejected') {
      const unauthUrl = new URL('/unauthorized', request.url)
      unauthUrl.searchParams.set('reason', 'organizer_application_rejected')
      return NextResponse.redirect(unauthUrl)
    }
    if (organizerStatus !== 'approved') {
      const unauthUrl = new URL('/unauthorized', request.url)
      unauthUrl.searchParams.set('reason', 'organizer_approval_required')
      return NextResponse.redirect(unauthUrl)
    }
    return getResponse()
  }

  // /pending-approval -> if already approved, take to /org
  if (pathname === '/pending-approval') {
    if (organizerStatus === 'approved' || role === 'institution_admin' || role === 'platform_owner') {
      return NextResponse.redirect(new URL('/org', request.url))
    }
    return getResponse()
  }

  // /jury/* -> active jury event role ONLY (admins are strictly barred from scoring to prevent score rigging)
  if (pathname.startsWith('/jury')) {
    if ((user as any)?.isJury) {
      return getResponse()
    }

    const { data: juryRole } = await supabase
      .from('event_roles')
      .select('id')
      .eq('user_id', user.id)
      .eq('role', 'jury')
      .eq('status', 'active')
      .limit(1)

    if (!juryRole || juryRole.length === 0) {
      const unauthUrl = new URL('/unauthorized', request.url)
      unauthUrl.searchParams.set('reason', 'jury_access_required')
      return NextResponse.redirect(unauthUrl)
    }
    return getResponse()
  }

  // /team/* -> active participant or team member only (admins and non-participant organizers are barred)
  if (pathname.startsWith('/team')) {
    const { data: teamRole } = await supabase
      .from('team_members')
      .select('id')
      .eq('user_id', user.id)
      .limit(1)

    const { data: participantEventRole } = await supabase
      .from('event_roles')
      .select('id')
      .eq('user_id', user.id)
      .eq('role', 'participant')
      .limit(1)

    const isMember = (teamRole && teamRole.length > 0) || (participantEventRole && participantEventRole.length > 0)

    // Admins and approved organizers who are not participants cannot enter participant team space
    if ((role === 'platform_owner' || role === 'institution_admin' || organizerStatus === 'approved') && !isMember) {
      const unauthUrl = new URL('/unauthorized', request.url)
      unauthUrl.searchParams.set('reason', 'participant_only')
      return NextResponse.redirect(unauthUrl)
    }

    return getResponse()
  }

  return getResponse()

}

// Backwards compatibility export
export const middleware = proxy

export const config = {
  matcher: [
    /*
     * Match all request paths except for:
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     * - public assets
     */
    '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
}
