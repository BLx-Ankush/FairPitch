export interface CriterionScoreInput {
  criterionId: string
  score: number
  comment: string
}

export interface EvaluationPayload {
  teamId: string
  scores: CriterionScoreInput[]
}

export type AssignmentStatus = 'assigned' | 'completed' | 'excused'

export interface JudgeQueueItem {
  id: string
  assignmentId: string
  teamId: string
  displayName: string // Masked as "Team 01" if blind mode is active
  actualName?: string // Only for organizers or non-blind
  tagline: string | null
  track: string | null
  status: AssignmentStatus
  orderIndex: number
  hasConflict: boolean
  isCompleted: boolean
  submission?: {
    id: string
    title: string
    description: string | null
    repoUrl: string | null
    demoUrl: string | null
  } | null
  existingScores?: {
    criterionId: string
    score: number
    comment: string
    version: number
  }[]
}

export interface ConflictDeclarationInput {
  teamId: string
  reason: string
}

export interface EditRequestInput {
  teamId: string
  reason: string
  requestedChanges: {
    criterionId: string
    newScore: number
    newComment: string
  }[]
}
