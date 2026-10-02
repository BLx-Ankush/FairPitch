/**
 * Generates balanced judge assignments across teams with randomized order sequence
 * to prevent panel drift ordering fatigue bias.
 */
export function generateBalancedAssignments(params: {
  eventId: string
  institutionId: string
  judgeIds: string[]
  teamIds: string[]
  minJudgesPerTeam: number
}) {
  const { eventId, institutionId, judgeIds, teamIds, minJudgesPerTeam } = params

  if (judgeIds.length === 0 || teamIds.length === 0) {
    return []
  }

  // Ensure minJudgesPerTeam doesn't exceed available judges
  const effectiveJudgesPerTeam = Math.min(minJudgesPerTeam, judgeIds.length)

  const assignments: {
    event_id: string
    institution_id: string
    judge_id: string
    team_id: string
    order_index: number
    status: 'assigned'
  }[] = []

  // Track assignments per judge to maintain balanced workload
  const judgeWorkload: Record<string, number> = {}
  judgeIds.forEach((id) => (judgeWorkload[id] = 0))

  // For each team, select judges with the lowest current workload
  teamIds.forEach((teamId) => {
    // Sort judges by ascending current workload, with random tie-breaker
    const sortedJudges = [...judgeIds].sort((a, b) => {
      const diff = judgeWorkload[a] - judgeWorkload[b]
      return diff !== 0 ? diff : Math.random() - 0.5
    })

    const selectedJudges = sortedJudges.slice(0, effectiveJudgesPerTeam)

    selectedJudges.forEach((judgeId) => {
      judgeWorkload[judgeId]++
      assignments.push({
        event_id: eventId,
        institution_id: institutionId,
        judge_id: judgeId,
        team_id: teamId,
        order_index: 0, // will be randomized per judge below
        status: 'assigned',
      })
    })
  })

  // Assign randomized evaluation sequence (order_index) per judge
  judgeIds.forEach((judgeId) => {
    const judgeAssignments = assignments.filter((a) => a.judge_id === judgeId)
    // Fisher-Yates shuffle
    for (let i = judgeAssignments.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1))
      const temp = judgeAssignments[i]
      judgeAssignments[i] = judgeAssignments[j]
      judgeAssignments[j] = temp
    }
    // Set order_index
    judgeAssignments.forEach((a, index) => {
      a.order_index = index + 1
    })
  })

  return assignments
}

/**
 * Returns deterministic blind mode alias label for a team index.
 * e.g., 0 -> "Team 01", 1 -> "Team 02"
 */
export function getBlindModeTeamLabel(index: number): string {
  const num = (index + 1).toString().padStart(2, '0')
  return `Team ${num}`
}
