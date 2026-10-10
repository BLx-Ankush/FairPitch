import { createClient } from '@/lib/supabase/server'
import { getServiceSupabase } from '@/lib/supabase/service-role'
import { type AuthContext, type UserProfile, type UserEventRole, CURRENT_CONSENT_VERSION } from './roles'

export { CURRENT_CONSENT_VERSION }

/**
 * Retrieves the currently authenticated Supabase auth user.
 */
export async function getAuthUser() {
  try {
    const supabase = await createClient()
    const { data: { user }, error } = await supabase.auth.getUser()
    if (!error && user) return user
  } catch {}

  return null
}

/**
 * Retrieves the profile of a given user ID.
 */
export async function getUserProfile(userId: string): Promise<UserProfile | null> {
  try {
    const supabase = await createClient()
    const { data, error } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', userId)
      .single()

    if (!error && data) return data as UserProfile
  } catch {}

  return null
}

/**
 * Retrieves active event roles for a given user.
 */
export async function getUserEventRoles(userId: string): Promise<UserEventRole[]> {
  const supabase = await createClient()
  const { data, error } = await supabase
    .from('event_roles')
    .select('*')
    .eq('user_id', userId)
    .eq('status', 'active')

  if (error || !data) return []
  return data as UserEventRole[]
}

/**
 * Checks if the user has signed the latest DPDP consent version.
 */
export async function checkUserConsent(userId: string, version: string = CURRENT_CONSENT_VERSION): Promise<boolean> {
  const supabase = await createClient()
  const { data, error } = await supabase
    .from('consents')
    .select('id')
    .eq('user_id', userId)
    .eq('consent_version', version)
    .limit(1)

  if (error || !data || data.length === 0) return false
  return true
}

/**
 * Records DPDP consent agreement for a user.
 */
export async function recordUserConsent(params: {
  userId: string
  institutionId: string
  consentVersion: string
  consentText: string
  ipAddress?: string
}) {
  const serviceClient = getServiceSupabase()
  const { data, error } = await serviceClient
    .from('consents')
    .insert({
      user_id: params.userId,
      institution_id: params.institutionId,
      consent_version: params.consentVersion,
      consent_text: params.consentText,
      ip_address: params.ipAddress || null,
    })
    .select()
    .single()

  if (error) {
    throw new Error(`Failed to record consent: ${error.message}`)
  }

  return data
}

/**
 * Resolves full auth and tenant context for the caller.
 */
export async function getAuthContext(): Promise<AuthContext> {
  const user = await getAuthUser()
  if (!user) {
    return {
      user: null,
      profile: null,
      eventRoles: [],
      hasConsent: false,
    }
  }

  const [profile, eventRoles, hasConsent] = await Promise.all([
    getUserProfile(user.id),
    getUserEventRoles(user.id),
    checkUserConsent(user.id),
  ])

  return {
    user: {
      id: user.id,
      email: user.email || '',
    },
    profile,
    eventRoles,
    hasConsent,
  }
}
