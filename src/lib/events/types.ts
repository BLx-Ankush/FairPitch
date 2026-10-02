export type EventStatus = 'draft' | 'open' | 'judging' | 'review' | 'published'

export type JudgingMode = 'rubric' | 'pairwise'

export interface Event {
  id: string
  institution_id: string
  title: string
  slug: string
  description: string | null
  start_date: string
  end_date: string
  registration_deadline: string | null
  submission_deadline: string | null
  status: EventStatus
  blind_mode: boolean
  min_judges_per_team: number
  judging_mode: JudgingMode
  anchored_merkle_root: string | null
  anchored_at: string | null
  created_by: string | null
  created_at: string
  updated_at: string
}

export interface ScoreBand {
  min: number
  max: number
  label: string
  description: string
}

export interface RubricCriterion {
  id: string
  event_id: string
  institution_id: string
  name: string
  description: string | null
  weight: number
  max_score: number
  score_bands: ScoreBand[]
  order_index: number
  created_at: string
}

export type TeamStatus = 'pending' | 'approved' | 'rejected'

export interface Team {
  id: string
  event_id: string
  institution_id: string
  name: string
  team_code: string
  tagline: string | null
  track: string | null
  status: TeamStatus
  created_by: string | null
  created_at: string
  updated_at: string
  member_count?: number
  submission?: Submission | null
}

export interface TeamMember {
  id: string
  team_id: string
  event_id: string
  institution_id: string
  user_id: string
  role: 'lead' | 'member'
  joined_at: string
  user?: {
    full_name: string
    email: string
  }
}

export interface Submission {
  id: string
  team_id: string
  event_id: string
  institution_id: string
  title: string
  description: string | null
  repo_url: string | null
  demo_url: string | null
  attachments: any[]
  submitted_at: string
  updated_at: string
}
