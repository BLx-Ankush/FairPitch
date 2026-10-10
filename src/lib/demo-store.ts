export interface DemoTeam {
  id: string
  event_id: string
  name: string
  tagline?: string | null
  track?: string | null
  team_code: string
  join_code: string | null
  status: 'pending' | 'approved'
  payment_status: 'unpaid' | 'pending_verification' | 'verified'
  utr_number?: string | null
  amount_paid: number
  created_by: string
  created_at: string
  userRole?: string
  members: any[]
  submission?: any | null
}

export const DEMO_EVENTS: any[] = []
export const demoTeams: DemoTeam[] = []
export function findDemoTeamForUser(_userId: string): DemoTeam | null {
  return null
}
export async function createDemoTeam(_params: any) {
  return null
}
