'use client'

import React, { useEffect, useState, use } from 'react'
import Link from 'next/link'
import {
  ArrowLeft,
  Sparkles,
  Trophy,
  AlertCircle,
  CheckCircle2,
  FileText,
  MessageSquare,
  HelpCircle,
  Loader2,
  ChevronRight,
  ShieldCheck,
  Send,
  Clock,
  Check,
} from 'lucide-react'

export default function TeamAutopsyPage({
  params,
}: {
  params: Promise<{ teamId: string }>
}) {
  const { teamId } = use(params)

  const [loading, setLoading] = useState(true)
  const [autopsy, setAutopsy] = useState<any | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [eventId, setEventId] = useState<string | null>(null)
  const [eventStatus, setEventStatus] = useState<string | null>(null)

  // Dispute ticket modal state
  const [ticketModalOpen, setTicketModalOpen] = useState(false)
  const [ticketReason, setTicketReason] = useState('')
  const [submittingTicket, setSubmittingTicket] = useState(false)
  const [ticketSuccess, setTicketSuccess] = useState<string | null>(null)
  const [ticketError, setTicketError] = useState<string | null>(null)
  const [existingTickets, setExistingTickets] = useState<any[]>([])

  async function fetchAutopsy() {
    setLoading(true)
    setError(null)
    try {
      // First get team's event ID
      const teamRes = await fetch('/api/team/my-team')
      const teamData = await teamRes.json()

      if (!teamRes.ok || !teamData.team) {
        setError('Could not verify team membership')
        setLoading(false)
        return
      }

      const evId = teamData.team.event_id
      setEventId(evId)

      // Fetch autopsy for this team
      const res = await fetch(`/api/events/${evId}/autopsies/${teamId}`)
      const data = await res.json()

      if (res.ok && data.success) {
        setAutopsy(data.autopsy)
      } else {
        setError(data.error || 'Failed to load loss autopsy')
        if (data.eventStatus) {
          setEventStatus(data.eventStatus)
        }
      }

      // Fetch any existing review tickets
      const tRes = await fetch(`/api/team/review-requests?teamId=${teamId}`)
      if (tRes.ok) {
        const tData = await tRes.json()
        setExistingTickets(tData.tickets || [])
      }
    } catch {
      setError('Network error loading autopsy')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchAutopsy()
  }, [teamId])

  async function submitDisputeTicket(e: React.FormEvent) {
    e.preventDefault()
    if (!ticketReason.trim() || !eventId) return

    setSubmittingTicket(true)
    setTicketError(null)
    setTicketSuccess(null)

    try {
      const res = await fetch('/api/team/review-requests', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          eventId,
          teamId,
          reason: ticketReason.trim(),
        }),
      })

      const data = await res.json()
      if (res.ok && data.success) {
        setTicketSuccess('Clarification ticket submitted successfully!')
        setTicketReason('')
        setExistingTickets([data.ticket, ...existingTickets])
        setTimeout(() => {
          setTicketModalOpen(false)
          setTicketSuccess(null)
        }, 1500)
      } else {
        setTicketError(data.error || 'Failed to submit ticket')
      }
    } catch {
      setTicketError('Network error submitting ticket')
    } finally {
      setSubmittingTicket(false)
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-950 flex items-center justify-center text-slate-500">
        <Loader2 className="w-8 h-8 animate-spin text-indigo-500" />
      </div>
    )
  }

  if (error) {
    return (
      <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col items-center justify-center p-6">
        <div className="max-w-md w-full bg-slate-900 border border-slate-800 rounded-2xl p-6 text-center space-y-4">
          <div className="w-12 h-12 rounded-full bg-amber-500/10 text-amber-400 flex items-center justify-center mx-auto border border-amber-500/20">
            <AlertCircle className="w-6 h-6" />
          </div>
          <h2 className="text-lg font-bold text-slate-100">Autopsy Notice</h2>
          <p className="text-xs text-slate-400 leading-relaxed">{error}</p>
          {eventStatus && eventStatus !== 'published' && (
            <div className="p-3 rounded-xl bg-slate-950 border border-slate-800 text-[11px] text-indigo-400 font-medium">
              Current Event Stage: <strong>{eventStatus.toUpperCase()}</strong>.
              Results and autopsies unlock automatically once published.
            </div>
          )}
          <Link
            href="/team"
            className="inline-block px-4 py-2 bg-slate-800 hover:bg-slate-700 text-xs font-semibold text-slate-200 rounded-xl transition-colors"
          >
            Return to Team Portal
          </Link>
        </div>
      </div>
    )
  }

  const lossData = autopsy?.loss_gap_data || {}
  const gaps = lossData.weightedPointGaps || []
  const fixes = autopsy?.fixes || []
  const issues = autopsy?.issues || []

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col">
      {/* Top Header */}
      <header className="border-b border-slate-800 bg-slate-900/60 backdrop-blur-md px-6 py-4 flex items-center justify-between sticky top-0 z-20">
        <div className="flex items-center gap-3">
          <Link
            href="/team"
            className="p-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-slate-100 transition-colors"
          >
            <ArrowLeft className="w-4 h-4" />
          </Link>
          <div>
            <div className="flex items-center gap-2">
              <span className="text-xs font-semibold text-indigo-400 uppercase tracking-wider">
                Audited Evaluation
              </span>
              <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-indigo-950/60 text-indigo-400 border border-indigo-800/40">
                AI Loss Diagnostic
              </span>
            </div>
            <h1 className="text-lg font-bold text-slate-100">
              Loss Autopsy & Head-to-Head Gap Analysis
            </h1>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={() => setTicketModalOpen(true)}
            className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-amber-400 text-xs font-semibold border border-amber-900/40 transition-colors"
          >
            <HelpCircle className="w-3.5 h-3.5" />
            <span>Open Review Inquiry</span>
          </button>
        </div>
      </header>

      {/* Main Content */}
      <main className="flex-1 max-w-5xl w-full mx-auto p-6 space-y-6">
        {/* Matchup Header Banner */}
        <div className="rounded-2xl border border-slate-800 bg-gradient-to-r from-slate-900 via-indigo-950/30 to-slate-900 p-6 shadow-xl">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div>
              <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500">
                Benchmark Comparison
              </span>
              <h2 className="text-xl font-bold text-slate-100 mt-1">
                Your Performance vs 1st-Place Benchmark
              </h2>
              <p className="text-xs text-slate-400 mt-1">
                Mathematical gap breakdown across each judging criterion, showing exactly where marks were lost.
              </p>
            </div>

            <div className="flex items-center gap-4 bg-slate-950/80 p-3 rounded-xl border border-slate-800/80">
              <div className="text-right">
                <span className="text-[10px] text-slate-500 uppercase block">Total Score</span>
                <span className="text-xl font-bold font-mono text-indigo-400">
                  {lossData.teamTotal?.toFixed(2) || '0.00'}
                </span>
              </div>
              <div className="text-slate-600 font-bold">vs</div>
              <div>
                <span className="text-[10px] text-slate-500 uppercase block">1st Place</span>
                <span className="text-xl font-bold font-mono text-emerald-400">
                  {lossData.winnerTotal?.toFixed(2) || '0.00'}
                </span>
              </div>
              <div className="border-l border-slate-800 pl-3">
                <span className="text-[10px] text-rose-400 uppercase block font-semibold">Net Gap</span>
                <span className="text-base font-bold font-mono text-rose-400">
                  -{lossData.netDeficit?.toFixed(2) || '0.00'}
                </span>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-3 mt-4 pt-3 border-t border-slate-800/80 text-[11px] text-slate-400">
            <span className="flex items-center gap-1.5">
              <ShieldCheck className="w-4 h-4 text-emerald-400" />
              Verified by Gemini {autopsy?.model_name || '2.5 Flash'}
            </span>
            <span>&bull;</span>
            <span className="text-slate-500">
              Status: <strong className="text-slate-300 capitalize">{autopsy?.verification_status}</strong>
            </span>
          </div>
        </div>

        {/* 1. Rubric Deficit Breakdown Cards */}
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-bold text-slate-200">
              Rank-Ordered Criterion Deficits
            </h3>
            <span className="text-[11px] text-slate-500">
              Sorted by largest weighted point deduction
            </span>
          </div>

          <div className="grid grid-cols-1 gap-3">
            {gaps.map((gap: any, idx: number) => {
              const isDeficit = gap.weightedGap > 0
              return (
                <div
                  key={gap.criterionId}
                  className={`p-4 rounded-2xl border transition-all ${
                    isDeficit
                      ? 'bg-slate-900/80 border-slate-800'
                      : 'bg-emerald-950/20 border-emerald-900/40'
                  }`}
                >
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-2.5">
                      <span
                        className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold ${
                          isDeficit
                            ? 'bg-rose-500/20 text-rose-400 border border-rose-500/30'
                            : 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30'
                        }`}
                      >
                        {idx + 1}
                      </span>
                      <h4 className="text-sm font-bold text-slate-100">
                        {gap.criterionName}
                      </h4>
                      <span className="text-[10px] font-semibold text-slate-400 bg-slate-950 px-2 py-0.5 rounded-full border border-slate-800">
                        {gap.weight}% Weight
                      </span>
                    </div>

                    <div className="text-right">
                      {isDeficit ? (
                        <span className="font-mono text-sm font-bold text-rose-400">
                          -{gap.weightedGap.toFixed(2)} weighted pts
                        </span>
                      ) : (
                        <span className="font-mono text-xs font-bold text-emerald-400">
                          Even with Winner
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Benchmark Bar */}
                  <div className="grid grid-cols-2 gap-4 text-xs mt-3 pt-3 border-t border-slate-800/80">
                    <div>
                      <span className="text-[10px] text-slate-500 uppercase block">
                        Your Score Average
                      </span>
                      <span className="font-mono font-semibold text-slate-200">
                        {gap.teamAverage.toFixed(1)} / {gap.maxScore}
                      </span>
                    </div>
                    <div>
                      <span className="text-[10px] text-slate-500 uppercase block">
                        1st-Place Benchmark Average
                      </span>
                      <span className="font-mono font-semibold text-emerald-400">
                        {gap.winnerAverage.toFixed(1)} / {gap.maxScore}
                      </span>
                    </div>
                  </div>
                </div>
              )
            })}
          </div>
        </div>

        {/* 2. Top Diagnosed Issues */}
        {issues.length > 0 && (
          <div className="bg-slate-900/80 border border-slate-800 rounded-2xl p-6 shadow-xl space-y-4">
            <h3 className="text-sm font-bold text-slate-100 flex items-center gap-2">
              <AlertCircle className="w-4 h-4 text-amber-400" />
              <span>Primary Deduction Root Causes</span>
            </h3>

            <div className="space-y-3">
              {issues.map((issue: any, idx: number) => (
                <div
                  key={idx}
                  className="p-3.5 rounded-xl bg-slate-950 border border-slate-800/80 text-xs space-y-1"
                >
                  <div className="flex items-center justify-between">
                    <span className="font-bold text-slate-200">
                      {issue.criterionName}
                    </span>
                    <span className="text-[11px] font-mono text-rose-400 font-semibold">
                      -{issue.weightedGap} pts
                    </span>
                  </div>
                  <p className="text-slate-400 leading-relaxed">{issue.summary}</p>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* 3. Exactly 3 Concrete High-Leverage Fixes */}
        {fixes.length > 0 && (
          <div className="bg-slate-900/80 border border-slate-800 rounded-2xl p-6 shadow-xl space-y-4">
            <div className="flex items-center gap-2">
              <div className="p-1.5 rounded-lg bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                <Sparkles className="w-4 h-4" />
              </div>
              <h3 className="text-sm font-bold text-slate-100">
                Exactly 3 High-Leverage Remediation Fixes
              </h3>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              {fixes.map((fix: any) => (
                <div
                  key={fix.priority}
                  className="p-4 rounded-xl bg-slate-950 border border-slate-800 flex flex-col justify-between"
                >
                  <div>
                    <span className="w-5 h-5 rounded-full bg-emerald-500/20 text-emerald-400 text-[10px] font-bold flex items-center justify-center mb-2">
                      #{fix.priority}
                    </span>
                    <h4 className="text-xs font-bold text-slate-200 mb-1">
                      {fix.title}
                    </h4>
                    <p className="text-[11px] text-slate-400 leading-relaxed">
                      {fix.description}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* 4. Full Markdown Autopsy Diagnostic */}
        {autopsy?.raw_markdown && (
          <div className="bg-slate-900/60 border border-slate-800 rounded-2xl p-6 shadow-xl">
            <div className="flex items-center justify-between mb-4 border-b border-slate-800 pb-3">
              <div className="flex items-center gap-2">
                <FileText className="w-4 h-4 text-indigo-400" />
                <h3 className="text-sm font-bold text-slate-200">
                  Full Diagnostic Analysis Report
                </h3>
              </div>
              <span className="text-[10px] font-mono text-slate-500">
                Generated {new Date(autopsy.generated_at).toLocaleString()}
              </span>
            </div>

            <div className="prose prose-invert max-w-none text-xs text-slate-300 leading-relaxed whitespace-pre-wrap font-sans">
              {autopsy.raw_markdown}
            </div>
          </div>
        )}

        {/* 5. Existing Review Tickets */}
        {existingTickets.length > 0 && (
          <div className="bg-slate-900/60 border border-slate-800 rounded-2xl p-6 shadow-xl space-y-4">
            <h3 className="text-sm font-bold text-slate-200 flex items-center gap-2">
              <MessageSquare className="w-4 h-4 text-indigo-400" />
              <span>Your Review Inquiries & Dispute Tickets</span>
            </h3>

            <div className="space-y-3">
              {existingTickets.map((ticket) => (
                <div
                  key={ticket.id}
                  className="p-4 rounded-xl bg-slate-950 border border-slate-800 space-y-2 text-xs"
                >
                  <div className="flex items-center justify-between">
                    <span className="font-semibold text-slate-300">
                      Inquiry #{ticket.id.slice(0, 8)}
                    </span>
                    <span
                      className={`px-2 py-0.5 rounded-full text-[10px] font-bold uppercase ${
                        ticket.status === 'resolved'
                          ? 'bg-emerald-950/60 text-emerald-400 border border-emerald-800/40'
                          : ticket.status === 'under_review'
                          ? 'bg-indigo-950/60 text-indigo-400 border border-indigo-800/40'
                          : 'bg-amber-950/60 text-amber-400 border border-amber-800/40'
                      }`}
                    >
                      {ticket.status.replace('_', ' ')}
                    </span>
                  </div>

                  <p className="text-slate-400 italic">"{ticket.reason}"</p>

                  {ticket.resolution_notes && (
                    <div className="p-3 rounded-lg bg-indigo-950/30 border border-indigo-900/50 mt-2">
                      <span className="text-[10px] font-bold uppercase text-indigo-300 block mb-0.5">
                        Organizer Response:
                      </span>
                      <p className="text-slate-200">{ticket.resolution_notes}</p>
                    </div>
                  )}

                  <span className="text-[10px] text-slate-500 block pt-1">
                    Submitted {new Date(ticket.created_at).toLocaleDateString()}
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}
      </main>

      {/* Review Ticket Modal */}
      {ticketModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl max-w-lg w-full p-6 shadow-2xl space-y-4">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <div className="flex items-center gap-2">
                <HelpCircle className="w-5 h-5 text-amber-400" />
                <h3 className="text-base font-bold text-slate-100">
                  Open Review Inquiry / Dispute
                </h3>
              </div>
              <button
                onClick={() => setTicketModalOpen(false)}
                className="text-slate-400 hover:text-white text-lg"
              >
                &times;
              </button>
            </div>

            <p className="text-xs text-slate-400 leading-relaxed">
              If your team believes marks were deducted in error or you have a documented dispute regarding specific criterion feedback, describe your inquiry below. Event organizers will review and provide a formal response.
            </p>

            {ticketError && (
              <div className="p-3 rounded-xl bg-rose-950/40 border border-rose-800 text-xs text-rose-300">
                {ticketError}
              </div>
            )}

            {ticketSuccess && (
              <div className="p-3 rounded-xl bg-emerald-950/40 border border-emerald-800 text-xs text-emerald-300 flex items-center gap-2">
                <Check className="w-4 h-4 text-emerald-400" />
                <span>{ticketSuccess}</span>
              </div>
            )}

            <form onSubmit={submitDisputeTicket} className="space-y-4">
              <div>
                <label className="text-xs font-semibold text-slate-300 block mb-1">
                  Dispute Details & Clarification Request *
                </label>
                <textarea
                  value={ticketReason}
                  onChange={(e) => setTicketReason(e.target.value)}
                  placeholder="Detail the criterion, specific judge critique, or reason you are contesting this deduction..."
                  rows={4}
                  required
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl p-3 text-xs text-slate-100 focus:outline-hidden focus:border-indigo-500 resize-none"
                />
              </div>

              <div className="flex items-center justify-end gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setTicketModalOpen(false)}
                  className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-xs text-slate-300 font-semibold rounded-xl transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submittingTicket || !ticketReason.trim()}
                  className="flex items-center gap-2 px-5 py-2 bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-semibold rounded-xl shadow-lg shadow-indigo-600/20 disabled:opacity-50 transition-colors"
                >
                  {submittingTicket ? (
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  ) : (
                    <Send className="w-3.5 h-3.5" />
                  )}
                  <span>Submit Inquiry</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
