import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { getServiceSupabase } from '@/lib/supabase/service-role'
import { DEMO_COOKIE_NAME, verifyDemoCookie } from '@/lib/auth/demo-cookie'

import { memoryCache } from '@/lib/cache/memory-cache'

export interface CallerContext {
  user: { id: string; email: string; isJury?: boolean }
  profile: {
    id: string
    role: string
    organizer_approval_status: string
    institution_id: string | null
    full_name: string
  }
}

/**
 * Resolves current caller context via Supabase session or verified signed demo cookie.
 */
export async function getCallerContext(): Promise<CallerContext | null> {
  try {
    const supabase = await createClient()
    const {
      data: { user },
      error: userErr,
    } = await supabase.auth.getUser()

    if (!userErr && user) {
      const profileCacheKey = `user:guard-profile:${user.id}`
      let profile = memoryCache.get<any>(profileCacheKey)

      if (!profile) {
        const { data } = await supabase
          .from('profiles')
          .select('id, role, organizer_approval_status, institution_id, full_name')
          .eq('id', user.id)
          .single()

        profile = data || {
          id: user.id,
          role: 'user',
          organizer_approval_status: 'none',
          institution_id: null,
          full_name: '',
        }
        memoryCache.set(profileCacheKey, profile, 15, [`user:${user.id}`])
      }

      return {
        user: { id: user.id, email: user.email || '' },
        profile,
      }
    }
  } catch {}

  // Check signed demo cookie if demo mode is permitted
  try {
    const { cookies } = await import('next/headers')
    const cookieStore = await cookies()
    const demoCookie = cookieStore.get(DEMO_COOKIE_NAME)?.value
    const demoUser = await verifyDemoCookie(demoCookie)
    if (demoUser) {
      return {
        user: { id: demoUser.id, email: demoUser.email, isJury: demoUser.isJury },
        profile: {
          id: demoUser.id,
          role: demoUser.role,
          organizer_approval_status: demoUser.organizer_approval_status,
          institution_id: demoUser.institution_id,
          full_name: demoUser.full_name,
        },
      }
    }
  } catch {}

  return null
}

/**
 * Guard: Requires caller to be authenticated.
 */
export async function requireAuth(): Promise<
  { caller: CallerContext; errorResponse: null } | { caller: null; errorResponse: NextResponse }
> {
  const caller = await getCallerContext()
  if (!caller) {
    return {
      caller: null,
      errorResponse: NextResponse.json({ error: 'Unauthorized: Authentication required' }, { status: 401 }),
    }
  }
  return { caller, errorResponse: null }
}

/**
 * Guard: Requires caller to be an Institution Admin or Platform Owner.
 */
export async function requireInstitutionAdmin(institutionId?: string | null): Promise<
  { caller: CallerContext; errorResponse: null } | { caller: null; errorResponse: NextResponse }
> {
  const auth = await requireAuth()
  if (auth.errorResponse) return auth

  const { caller } = auth
  const { role, institution_id } = caller.profile

  if (role !== 'platform_owner' && role !== 'institution_admin') {
    return {
      caller: null,
      errorResponse: NextResponse.json(
        { error: 'Forbidden: Institution administrator privileges required' },
        { status: 403 }
      ),
    }
  }

  if (institutionId && role !== 'platform_owner' && institution_id !== institutionId) {
    return {
      caller: null,
      errorResponse: NextResponse.json(
        { error: 'Forbidden: Access restricted to your assigned institution' },
        { status: 403 }
      ),
    }
  }

  return { caller, errorResponse: null }
}

/**
 * Guard: Requires caller to be an authorized Event Organizer or Institution Admin.
 */
export async function requireEventOrganizer(eventId?: string | null): Promise<
  { caller: CallerContext; errorResponse: null } | { caller: null; errorResponse: NextResponse }
> {
  const auth = await requireAuth()
  if (auth.errorResponse) return auth

  const { caller } = auth
  const { role, organizer_approval_status } = caller.profile

  // Platform owner or institution admin always authorized
  if (role === 'platform_owner' || role === 'institution_admin') {
    return { caller, errorResponse: null }
  }

  // Must be an approved organizer
  if (organizer_approval_status !== 'approved') {
    return {
      caller: null,
      errorResponse: NextResponse.json(
        { error: 'Forbidden: Approved organizer status required' },
        { status: 403 }
      ),
    }
  }

  // If specific eventId provided, verify affiliation
  if (eventId) {
    const serviceClient = getServiceSupabase()
    const { data: eventRole } = await serviceClient
      .from('event_roles')
      .select('id')
      .eq('user_id', caller.user.id)
      .eq('event_id', eventId)
      .eq('role', 'organizer')
      .eq('status', 'active')
      .limit(1)

    const { data: event } = await serviceClient
      .from('events')
      .select('created_by, institution_id')
      .eq('id', eventId)
      .single()

    const isAuthorized =
      event?.created_by === caller.user.id ||
      (eventRole && eventRole.length > 0) ||
      (event?.institution_id && event.institution_id === caller.profile.institution_id)

    if (!isAuthorized) {
      return {
        caller: null,
        errorResponse: NextResponse.json(
          { error: 'Forbidden: You are not authorized to manage this event' },
          { status: 403 }
        ),
      }
    }
  }

  return { caller, errorResponse: null }
}

/**
 * Guard: Requires caller to be an active Jury evaluator for the event.
 * Admins are strictly forbidden from acting as jury unless explicitly assigned.
 */
export async function requireJury(eventId?: string | null): Promise<
  { caller: CallerContext; errorResponse: null } | { caller: null; errorResponse: NextResponse }
> {
  const auth = await requireAuth()
  if (auth.errorResponse) return auth

  const { caller } = auth

  const serviceClient = getServiceSupabase()
  const query = serviceClient
    .from('event_roles')
    .select('id, event_id')
    .eq('user_id', caller.user.id)
    .eq('role', 'jury')
    .eq('status', 'active')

  if (eventId) {
    query.eq('event_id', eventId)
  }

  const { data: roles } = await query.limit(1)

  if (!roles || roles.length === 0) {
    return {
      caller: null,
      errorResponse: NextResponse.json(
        { error: 'Forbidden: Active jury evaluator credentials required' },
        { status: 403 }
      ),
    }
  }

  return { caller, errorResponse: null }
}

/**
 * Guard: Requires caller to be an active participant or team member.
 */
export async function requireParticipant(teamId?: string | null, eventId?: string | null): Promise<
  { caller: CallerContext; errorResponse: null } | { caller: null; errorResponse: NextResponse }
> {
  const auth = await requireAuth()
  if (auth.errorResponse) return auth

  const { caller } = auth
  const serviceClient = getServiceSupabase()

  if (teamId) {
    const { data: membership } = await serviceClient
      .from('team_members')
      .select('id')
      .eq('team_id', teamId)
      .eq('user_id', caller.user.id)
      .limit(1)

    const { data: team } = await serviceClient
      .from('teams')
      .select('created_by')
      .eq('id', teamId)
      .single()

    if ((!membership || membership.length === 0) && team?.created_by !== caller.user.id) {
      return {
        caller: null,
        errorResponse: NextResponse.json(
          { error: 'Forbidden: You are not a registered member of this team' },
          { status: 403 }
        ),
      }
    }
  }

  if (eventId) {
    const { data: eventRole } = await serviceClient
      .from('event_roles')
      .select('id')
      .eq('user_id', caller.user.id)
      .eq('event_id', eventId)
      .eq('role', 'participant')
      .limit(1)

    // Also check if user is a member of any team in this event
    const { data: teamsInEvent } = await serviceClient
      .from('teams')
      .select('id')
      .eq('event_id', eventId)

    const teamIds = (teamsInEvent || []).map((t) => t.id)
    let isTeamMemberInEvent = false

    if (teamIds.length > 0) {
      const { data: m } = await serviceClient
        .from('team_members')
        .select('id')
        .eq('user_id', caller.user.id)
        .in('team_id', teamIds)
        .limit(1)
      if (m && m.length > 0) isTeamMemberInEvent = true
    }

    if ((!eventRole || eventRole.length === 0) && !isTeamMemberInEvent) {
      return {
        caller: null,
        errorResponse: NextResponse.json(
          { error: 'Forbidden: You are not registered for this event' },
          { status: 403 }
        ),
      }
    }
  }

  return { caller, errorResponse: null }
}
