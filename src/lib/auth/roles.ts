export type GlobalRole = 'platform_owner' | 'institution_admin' | 'user'

export type OrganizerApprovalStatus = 'none' | 'pending' | 'approved' | 'rejected'

export type EventRoleType = 'admin' | 'organizer' | 'jury' | 'participant'

export type EventRoleStatus = 'pending' | 'active' | 'revoked'

export const CURRENT_CONSENT_VERSION = 'v1.0-dpdp-2026'

export interface UserProfile {
  id: string
  institution_id: string | null
  full_name: string
  email: string
  role: GlobalRole
  organizer_approval_status: OrganizerApprovalStatus
  avatar_url: string | null
  created_at: string
  updated_at: string
}

export interface UserEventRole {
  id: string
  user_id: string
  event_id: string
  institution_id: string
  role: EventRoleType
  status: EventRoleStatus
}

export interface AuthContext {
  user: {
    id: string
    email: string
  } | null
  profile: UserProfile | null
  eventRoles: UserEventRole[]
  hasConsent: boolean
}

export const ROUTE_PERMISSIONS = {
  admin: ['platform_owner', 'institution_admin'],
  org: ['platform_owner', 'institution_admin', 'organizer'],
  jury: ['jury'],
  team: ['participant'],
  public: ['*'],
} as const
