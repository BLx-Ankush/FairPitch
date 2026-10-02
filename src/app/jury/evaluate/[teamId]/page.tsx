'use client'

import React, { useEffect, useState, use } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import {
  Award,
  ArrowLeft,
  Shield,
  ShieldAlert,
  GitBranch,
  ExternalLink,
  Save,
  CheckCircle2,
  AlertCircle,
  Loader2,
  Lock,
  MessageSquare,
  Sparkles
} from 'lucide-react'
import type { RubricCriterion } from '@/lib/events/types'

export default function JuryEvaluateTeamPage({
  params,
}: {
  params: Promise<{ teamId: string }>
}) {
  const router = useRouter()
  const { teamId } = use(params)

  const [team, setTeam] = useState<any | null>(null)
  const [event, setEvent] = useState<any | null>(null)
  const [criteria, setCriteria] = useState<RubricCriterion[]>([])
  const [scores, setScores] = useState<Record<string, { score: number; comment: string }>>({})
  const [loading, setLoading] = useState(true)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)

  // Conflict modal state
  const [showConflictModal, setShowConflictModal] = useState(false)
  const [conflictReason, setConflictReason] = useState('')
  const [conflictSubmitting, setConflictSubmitting] = useState(false)

  // Edit request modal state
  const [showEditModal, setShowEditModal] = useState(false)
  const [editReason, setEditReason] = useState('')

  useEffect(() => {
    async function loadData() {
      try {
        const queueRes = await fetch('/api/jury/assignments')
        if (queueRes.ok) {
          const qData = await queueRes.json()
          const item = (qData.queue || []).find((q: any) => q.teamId === teamId)
          if (item) {
            setTeam(item)
            setEvent(item.event)

            // Fetch event rubrics
            const critRes = await fetch(`/api/events/${item.event.id}/rubrics`)
            if (critRes.ok) {
              const critData = await critRes.json()
              const fetchedCriteria: RubricCriterion[] = critData.criteria || []
              setCriteria(fetchedCriteria)

              // Initialize scores
              const initialScores: Record<string, { score: number; comment: string }> = {}
              fetchedCriteria.forEach((c) => {
                const existing = (item.existingScores || []).find((s: any) => s.criterion_id === c.id || s.criterionId === c.id)
                initialScores[c.id] = {
                  score: existing ? Number(existing.score) : 7.0,
                  comment: existing ? existing.comment : '',
                }
              })
              setScores(initialScores)
            }
          }
        }
      } finally {
        setLoading(false)
      }
    }

    loadData()
  }, [teamId])

  function handleScoreChange(criterionId: string, val: number) {
    setScores((prev) => ({
      ...prev,
      [criterionId]: {
        ...prev[criterionId],
        score: val,
      },
    }))
  }

  function handleCommentChange(criterionId: string, comment: string) {
    setScores((prev) => ({
      ...prev,
      [criterionId]: {
        ...prev[criterionId],
        comment,
      },
    }))
  }

  // Calculate weighted total score
  const totalWeightedScore = criteria.reduce((sum, c) => {
    const item = scores[c.id]
    if (!item) return sum
    return sum + (item.score / (c.max_score || 10)) * c.weight
  }, 0)

  async function handleSubmitEvaluation(e: React.FormEvent) {
    e.preventDefault()
    setSubmitting(true)
    setError(null)
    setSuccess(null)

    // Verify all comments non-empty
    for (const c of criteria) {
      const item = scores[c.id]
      if (!item || !item.comment.trim()) {
        setError(`Feedback comment is mandatory for criterion: "${c.name}"`)
        setSubmitting(false)
        return
      }
    }

    try {
      const payloadScores = criteria.map((c) => ({
        criterionId: c.id,
        score: scores[c.id].score,
        comment: scores[c.id].comment,
      }))

      const res = await fetch('/api/jury/evaluate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          teamId,
          scores: payloadScores,
        }),
      })

      const data = await res.json()
      if (!res.ok) {
        throw new Error(data.error || 'Failed to submit evaluation')
      }

      setSuccess('Evaluation committed to your append-only SHA-256 audit ledger!')
      setTimeout(() => router.push('/jury'), 1500)
    } catch (err: any) {
      setError(err.message)
    } finally {
      setSubmitting(false)
    }
  }

  async function handleDeclareConflict() {
    if (!conflictReason.trim()) {
      alert('Please provide a reason for the conflict of interest')
      return
    }

    setConflictSubmitting(true)
    try {
      const res = await fetch('/api/jury/conflicts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          teamId,
          reason: conflictReason,
        }),
      })

      const data = await res.json()
      if (!res.ok) {
        throw new Error(data.error || 'Failed to declare conflict')
      }

      alert('Conflict declared. Assignment has been excused.')
      router.push('/jury')
    } catch (err: any) {
      alert(err.message)
    } finally {
      setConflictSubmitting(false)
    }
  }

  async function handleSubmitEditRequest() {
    if (!editReason.trim()) {
      alert('Please provide a justification reason for requesting a score edit')
      return
    }

    try {
      const requestedChanges = criteria.map((c) => ({
        criterionId: c.id,
        newScore: scores[c.id].score,
        newComment: scores[c.id].comment,
      }))

      const res = await fetch('/api/jury/edit-requests', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          teamId,
          reason: editReason,
          requestedChanges,
        }),
      })

      const data = await res.json()
      if (!res.ok) {
        throw new Error(data.error || 'Failed to submit edit request')
      }

      alert('Score correction request submitted for organizer review.')
      setShowEditModal(false)
      router.push('/jury')
    } catch (err: any) {
      alert(err.message)
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-950 flex items-center justify-center text-slate-500">
        <Loader2 className="w-8 h-8 animate-spin text-violet-500" />
      </div>
    )
  }

  if (!team) {
    return (
      <div className="min-h-screen bg-slate-950 flex items-center justify-center text-slate-400">
        Team evaluation assignment not found.
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col">
      {/* Header */}
      <header className="border-b border-slate-800 bg-slate-900/60 backdrop-blur-md px-6 py-4 flex items-center justify-between sticky top-0 z-20">
        <div className="flex items-center gap-3">
          <Link
            href="/jury"
            className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-slate-200 transition-colors"
          >
            <ArrowLeft className="w-4 h-4" />
          </Link>
          <div className="h-9 w-9 rounded-lg bg-violet-600 flex items-center justify-center text-white shadow-md shadow-violet-600/30">
            <Award className="w-5 h-5" />
          </div>
          <div>
            <h1 className="text-sm font-bold text-slate-100 flex items-center gap-2">
              Evaluating: {team.displayName}
              {event?.blindMode && (
                <span className="text-[10px] px-2 py-0.5 rounded-full bg-purple-500/20 text-purple-400 font-semibold border border-purple-500/30 flex items-center gap-1">
                  <Shield className="w-3 h-3" /> Blind Mode Active
                </span>
              )}
            </h1>
            <p className="text-[11px] text-slate-400">{event?.title}</p>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={() => setShowConflictModal(true)}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-slate-900 hover:bg-red-950/60 text-slate-400 hover:text-red-400 border border-slate-800 hover:border-red-900/60 text-xs font-semibold transition-colors cursor-pointer"
          >
            <ShieldAlert className="w-3.5 h-3.5" />
            <span>Declare Conflict</span>
          </button>
        </div>
      </header>

      <main className="flex-1 max-w-4xl w-full mx-auto px-6 py-8">
        {/* Alerts */}
        {error && (
          <div className="mb-6 p-4 rounded-xl bg-red-950/40 border border-red-800/60 flex items-start gap-3 text-xs text-red-300">
            <AlertCircle className="w-4 h-4 text-red-400 shrink-0 mt-0.5" />
            <span>{error}</span>
          </div>
        )}

        {success && (
          <div className="mb-6 p-4 rounded-xl bg-emerald-950/40 border border-emerald-800/60 flex items-start gap-3 text-xs text-emerald-300">
            <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
            <span>{success}</span>
          </div>
        )}

        {/* Project Overview Card */}
        <div className="bg-slate-900/80 border border-slate-800 rounded-2xl p-6 shadow-xl mb-8">
          <div className="flex items-start justify-between gap-4 mb-3">
            <div>
              <span className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider">
                Submission Information
              </span>
              <h2 className="text-xl font-bold text-slate-100 mt-0.5">
                {team.submission?.title || `${team.displayName} Project`}
              </h2>
            </div>

            <div className="text-right bg-slate-950 px-3.5 py-2 rounded-xl border border-slate-800">
              <span className="text-[10px] text-slate-400 uppercase tracking-wider block">
                Calculated Weighted Score
              </span>
              <span className="text-xl font-bold font-mono text-violet-400">
                {totalWeightedScore.toFixed(1)}
              </span>
              <span className="text-xs text-slate-500 font-mono"> / 100</span>
            </div>
          </div>

          {team.submission?.description && (
            <p className="text-xs text-slate-300 leading-relaxed mb-4">
              {team.submission.description}
            </p>
          )}

          <div className="flex items-center gap-4 text-xs pt-3 border-t border-slate-800">
            {team.submission?.repoUrl && (
              <a
                href={team.submission.repoUrl}
                target="_blank"
                rel="noreferrer"
                className="flex items-center gap-1.5 text-indigo-400 hover:text-indigo-300 font-medium"
              >
                <GitBranch className="w-4 h-4" />
                <span>Code Repository</span>
              </a>
            )}
            {team.submission?.demoUrl && (
              <a
                href={team.submission.demoUrl}
                target="_blank"
                rel="noreferrer"
                className="flex items-center gap-1.5 text-emerald-400 hover:text-emerald-300 font-medium"
              >
                <ExternalLink className="w-4 h-4" />
                <span>Interactive Live Demo</span>
              </a>
            )}
            {!team.submission?.repoUrl && !team.submission?.demoUrl && (
              <span className="text-slate-500 text-[11px]">No repository or demo URL provided</span>
            )}
          </div>
        </div>

        {/* Criteria Evaluation Form */}
        <form onSubmit={handleSubmitEvaluation} className="space-y-6">
          <div className="flex items-center justify-between">
            <h2 className="text-base font-bold text-slate-100">
              Scoring Criteria ({criteria.length} Dimensions)
            </h2>
            <span className="text-xs text-slate-500">
              All dimensions and comments required
            </span>
          </div>

          <div className="space-y-6">
            {criteria.map((c, idx) => {
              const currentScore = scores[c.id]?.score ?? 7.0
              const currentComment = scores[c.id]?.comment ?? ''

              // Dynamic score band lookup
              const matchedBand = (c.score_bands || []).find(
                (b: any) => currentScore >= b.min && currentScore <= b.max
              )

              return (
                <div
                  key={c.id}
                  className="bg-slate-900/80 border border-slate-800 rounded-2xl p-6 shadow-xl"
                >
                  <div className="flex items-start justify-between gap-4 mb-2">
                    <div>
                      <div className="flex items-center gap-2 mb-1">
                        <span className="w-5 h-5 rounded-md bg-slate-800 text-slate-300 text-[11px] font-bold flex items-center justify-center">
                          {idx + 1}
                        </span>
                        <h3 className="text-sm font-bold text-slate-100">{c.name}</h3>
                        <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-violet-950/40 text-violet-400 border border-violet-800/60 font-mono">
                          {c.weight}% weight
                        </span>
                      </div>
                      {c.description && (
                        <p className="text-xs text-slate-400 pl-7">{c.description}</p>
                      )}
                    </div>

                    <div className="text-right">
                      <span className="text-xl font-bold font-mono text-violet-400">
                        {currentScore.toFixed(1)}
                      </span>
                      <span className="text-xs text-slate-500 font-mono"> / {c.max_score}</span>
                    </div>
                  </div>

                  {/* Score Slider */}
                  <div className="mt-4 pl-7 pr-2">
                    <input
                      type="range"
                      min={0}
                      max={c.max_score || 10}
                      step={0.5}
                      value={currentScore}
                      onChange={(e) => handleScoreChange(c.id, parseFloat(e.target.value))}
                      className="w-full h-2 bg-slate-950 rounded-lg appearance-none cursor-pointer accent-violet-500"
                    />

                    <div className="flex justify-between text-[10px] text-slate-500 font-mono mt-1">
                      <span>0.0</span>
                      <span>5.0</span>
                      <span>10.0</span>
                    </div>

                    {/* Matched Score Band Description */}
                    {matchedBand && (
                      <div className="mt-2 p-2 rounded-lg bg-slate-950 border border-slate-800/80 text-[11px]">
                        <span className="font-semibold text-violet-300 mr-1.5">
                          {matchedBand.label}:
                        </span>
                        <span className="text-slate-400">{matchedBand.description}</span>
                      </div>
                    )}
                  </div>

                  {/* Mandatory Feedback Comment */}
                  <div className="mt-4 pl-7">
                    <label className="block text-xs font-semibold text-slate-300 mb-1 flex items-center gap-1.5">
                      <MessageSquare className="w-3.5 h-3.5 text-slate-400" />
                      <span>Evaluator Feedback & Justification *</span>
                    </label>
                    <textarea
                      rows={2}
                      required
                      value={currentComment}
                      onChange={(e) => handleCommentChange(c.id, e.target.value)}
                      placeholder={`Provide constructive commentary explaining why this score was awarded...`}
                      className="w-full px-3.5 py-2 bg-slate-950 border border-slate-800 rounded-xl text-xs text-slate-100 placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-violet-500/50"
                    />
                  </div>
                </div>
              )
            })}
          </div>

          <div className="pt-4 border-t border-slate-800 flex items-center justify-between">
            <Link
              href="/jury"
              className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-semibold"
            >
              Back to Queue
            </Link>

            <div className="flex items-center gap-3">
              {team.isCompleted && (
                <button
                  type="button"
                  onClick={() => setShowEditModal(true)}
                  className="px-4 py-2.5 rounded-xl bg-slate-900 border border-slate-700 hover:bg-slate-800 text-slate-300 text-xs font-semibold transition-colors cursor-pointer"
                >
                  Request Formal Score Edit
                </button>
              )}

              <button
                type="submit"
                disabled={submitting}
                className="flex items-center gap-2 px-6 py-2.5 rounded-xl bg-gradient-to-r from-violet-600 to-indigo-600 hover:from-violet-500 hover:to-indigo-500 text-white font-semibold text-xs shadow-lg shadow-violet-600/30 transition-all cursor-pointer disabled:opacity-50"
              >
                {submitting ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    <span>Committing to Ledger...</span>
                  </>
                ) : (
                  <>
                    <Save className="w-4 h-4" />
                    <span>{team.isCompleted ? 'Update Evaluation' : 'Submit Official Evaluation'}</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </form>

        {/* Conflict Modal */}
        {showConflictModal && (
          <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-xs flex items-center justify-center p-4">
            <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 max-w-md w-full shadow-2xl">
              <div className="flex items-center gap-2.5 mb-3 text-red-400">
                <ShieldAlert className="w-5 h-5" />
                <h3 className="text-sm font-bold text-slate-100">Declare Conflict of Interest</h3>
              </div>
              <p className="text-xs text-slate-400 mb-4 leading-relaxed">
                If you have an affiliation, mentorship relationship, or institutional connection with this team, you must recuse yourself. This will remove this team from your scoring assignment and log an audit block.
              </p>
              <textarea
                rows={3}
                value={conflictReason}
                onChange={(e) => setConflictReason(e.target.value)}
                placeholder="State your reason (e.g. Previous co-author, team advisor, same lab)..."
                className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-xs text-slate-100 placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-red-500/50 mb-4"
              />
              <div className="flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setShowConflictModal(false)}
                  className="px-3 py-1.5 rounded-lg bg-slate-800 text-slate-400 text-xs font-semibold"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handleDeclareConflict}
                  disabled={conflictSubmitting}
                  className="px-4 py-1.5 rounded-lg bg-red-600 hover:bg-red-500 text-white text-xs font-semibold"
                >
                  {conflictSubmitting ? 'Declaring...' : 'Confirm Conflict & Recuse'}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Edit Request Modal */}
        {showEditModal && (
          <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-xs flex items-center justify-center p-4">
            <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 max-w-md w-full shadow-2xl">
              <h3 className="text-sm font-bold text-slate-100 mb-2">Request Score Correction</h3>
              <p className="text-xs text-slate-400 mb-4 leading-relaxed">
                Scores already committed to the append-only ledger cannot be silently modified. In compliance with FairPitch audit integrity, an organizer must approve your revision before a new version is anchored.
              </p>
              <textarea
                rows={3}
                value={editReason}
                onChange={(e) => setEditReason(e.target.value)}
                placeholder="Explain the justification for score revision (e.g. Discovered demo bug was due to network issue)..."
                className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-xs text-slate-100 placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/50 mb-4"
              />
              <div className="flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setShowEditModal(false)}
                  className="px-3 py-1.5 rounded-lg bg-slate-800 text-slate-400 text-xs font-semibold"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handleSubmitEditRequest}
                  className="px-4 py-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-semibold"
                >
                  Submit Revision Request
                </button>
              </div>
            </div>
          </div>
        )}
      </main>
    </div>
  )
}
