import { generateDynamicUpiQr, generateTransactionRef } from '@/lib/payments/upi'

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

export const DEMO_EVENTS = [
  {
    id: 'e0000000-0000-0000-0000-000000000001',
    institution_id: 'a0000000-0000-0000-0000-000000000001',
    title: 'HackNexis 2026',
    slug: 'hacknexis-2026',
    event_code: 'HACK-2026',
    description: 'Annual Inter-Collegiate Engineering Hackathon',
    status: 'registration',
    registration_fee: 500,
    upi_id: 'hacknexis@upi',
    upi_name: 'HackNexis Organizer Desk',
    institutions: { name: 'Nexis Institute of Technology' },
    events: {
      title: 'HackNexis 2026',
      slug: 'hacknexis-2026',
      event_code: 'HACK-2026',
      status: 'registration',
      registration_fee: 500,
      upi_id: 'hacknexis@upi',
      upi_name: 'HackNexis Organizer Desk',
    },
  },
]

const globalForDemo = globalThis as unknown as {
  __fairpitch_demo_teams?: DemoTeam[]
}

if (!globalForDemo.__fairpitch_demo_teams) {
  globalForDemo.__fairpitch_demo_teams = []
}

export const demoTeams: DemoTeam[] = globalForDemo.__fairpitch_demo_teams

export function findDemoTeamForUser(userId: string): DemoTeam | null {
  return demoTeams.find((t) => t.created_by === userId || t.members.some((m) => m.id === userId || m.email?.includes('ada'))) || null
}

export async function createDemoTeam(params: {
  eventId: string
  name: string
  tagline?: string
  track?: string
  userId: string
  userEmail: string
  userName: string
}) {
  const event = DEMO_EVENTS.find((e) => e.id === params.eventId) || DEMO_EVENTS[0]
  const isFree = (event.registration_fee || 0) === 0
  const randomSuffix = Math.random().toString(36).substring(2, 6).toUpperCase()
  const code = `TEAM-${randomSuffix}`

  const newTeam: DemoTeam = {
    id: `team-${Date.now()}`,
    event_id: event.id,
    name: params.name,
    tagline: params.tagline || null,
    track: params.track || null,
    team_code: code,
    join_code: isFree ? code : null,
    status: isFree ? 'approved' : 'pending',
    payment_status: isFree ? 'verified' : 'unpaid',
    amount_paid: 0,
    created_by: params.userId,
    created_at: new Date().toISOString(),
    userRole: 'lead',
    members: [
      {
        id: params.userId,
        role: 'lead',
        joinedAt: new Date().toISOString(),
        fullName: params.userName,
        email: params.userEmail,
      },
    ],
    submission: null,
  }

  demoTeams.unshift(newTeam)

  let upiQr = null
  if (!isFree) {
    upiQr = await generateDynamicUpiQr({
      vpa: event.upi_id || 'hacknexis@upi',
      payeeName: event.upi_name || 'HackNexis Organizer Desk',
      amount: event.registration_fee || 500,
      transactionNote: `Reg ${params.name}`,
      transactionRef: generateTransactionRef(params.eventId, newTeam.id),
    })
  }

  return {
    team: newTeam,
    requiresPayment: !isFree,
    upiQr,
  }
}
