'use client'

import React, { useEffect, useState, use } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import {
  CalendarCheck,
  ArrowLeft,
  Shield,
  FileCheck2,
  Users,
  CheckCircle2,
  Lock,
  ArrowRight,
  Loader2,
  AlertCircle,
  Hash,
  Sparkles,
  Layers,
  ChevronRight,
  Scale,
  LayoutGrid,
  MessageSquare,
  CreditCard,
  Trophy,
  ShieldCheck,
  QrCode,
} from 'lucide-react'
import type { Event, RubricCriterion } from '@/lib/events/types'

export default function EventCommandCenterPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const router = useRouter()
  const { id } = use(params)

  const [event, setEvent] = useState<any | null>(null)
  const [loading, setLoading] = useState(true)
  const [transitioning, setTransitioning] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [notification, setNotification] = useState<string | null>(null)

  async function fetchEventDetails() {
    try {
      const res = await fetch(`/api/events/${id}`)
      if (res.ok) {
        const data = await res.json()
        setEvent(data.event)
      } else {
        setError('Event could not be found')
      }
    } catch {
      setError('Failed to connect to server')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchEventDetails()
  }, [id])

  async function handleTransition(newStatus: string) {
    if (!confirm(`Are you sure you want to transition event to "${newStatus.toUpperCase()}"? This action moves the event forward in its lifecycle.`)) return

    setTransitioning(true)
    setError(null)
    setNotification(null)

    try {
      const res = await fetch(`/api/events/${id}/transition`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ newStatus }),
      })

      const data = await res.json()
      if (!res.ok) {
        throw new Error(data.error || 'Status transition failed')
      }

      setNotification(`Event status updated to ${newStatus.toUpperCase()}`)
      await fetchEventDetails()
    } catch (err: any) {
      setError(err.message || 'Status transition failed')
    } finally {
      setTransitioning(false)
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-950 flex items-center justify-center text-slate-500">
        <Loader2 className="w-8 h-8 animate-spin text-indigo-500" />
      </div>
    )
  }

  if (!event) {
    return (
      <div className="min-h-screen bg-slate-950 flex items-center justify-center text-slate-400">
        Event not found.
      </div>
    )
  }

  const stages = ['draft', 'open', 'judging', 'review', 'published']
  const currentStageIndex = stages.indexOf(event.status)

  const nextStatusMap: Record<string, { target: string; label: string }> = {
    draft: { target: 'open', label: 'Open Event for Submissions' },
    open: { target: 'judging', label: 'Start Judging (Freeze Rubrics)' },
    judging: { target: 'review', label: 'Conclude Judging & Review' },
    review: { target: 'published', label: 'Publish Results & Anchor Merkle Root' },
  }

  const nextAction = nextStatusMap[event.status]

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col">
      {/* Header */}
      <header className="border-b border-slate-800 bg-slate-900/60 backdrop-blur-md px-6 py-4 flex items-center justify-between sticky top-0 z-20">
        <div className="flex items-center gap-3">
          <Link
            href="/org"
            className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-slate-200 transition-colors"
          >
            <ArrowLeft className="w-4 h-4" />
          </Link>
          <div className="h-9 w-9 rounded-lg bg-emerald-600 flex items-center justify-center text-white shadow-md shadow-emerald-600/30">
            <CalendarCheck className="w-5 h-5" />
          </div>
          <div>
            <h1 className="text-sm font-bold text-slate-100 flex items-center gap-2">
              {event.title}
              <span className="text-[10px] px-2 py-0.5 rounded-full bg-slate-800 text-slate-300 font-mono">
                {event.slug}
              </span>
            </h1>
            <p className="text-[11px] text-slate-400">Event Command Center</p>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <Link
            href={`/org/events/${id}/rubric`}
            className="text-xs px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 transition-colors"
          >
            Rubric Criteria ({event.criteria?.length || 0})
          </Link>
          <Link
            href={`/org/events/${id}/teams`}
            className="text-xs px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 transition-colors"
          >
            Teams ({event.teamCount || 0})
          </Link>
          <Link
            href={`/org/events/${id}/payments`}
            className="text-xs px-3 py-1.5 rounded-lg bg-emerald-950/60 hover:bg-emerald-900/60 text-emerald-300 border border-emerald-700/50 transition-colors flex items-center gap-1.5"
          >
            <QrCode className="w-3.5 h-3.5 text-emerald-400" />
            <span>UPI Payments</span>
          </Link>
        </div>
      </header>

      <main className="flex-1 max-w-6xl w-full mx-auto px-6 py-8">
        {/* Alerts */}
        {error && (
          <div className="mb-6 p-4 rounded-xl bg-red-950/40 border border-red-800/60 flex items-start gap-3 text-xs text-red-300 shadow-lg">
            <AlertCircle className="w-4 h-4 text-red-400 shrink-0 mt-0.5" />
            <span>{error}</span>
          </div>
        )}

        {notification && (
          <div className="mb-6 p-4 rounded-xl bg-emerald-950/40 border border-emerald-800/60 flex items-start gap-3 text-xs text-emerald-300 shadow-lg">
            <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
            <span>{notification}</span>
          </div>
        )}

        {/* State Machine Stepper */}
        <div className="bg-slate-900/80 border border-slate-800 rounded-2xl p-6 shadow-xl mb-8">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h2 className="text-sm font-bold text-slate-100 uppercase tracking-wider text-slate-400">
                Forward-Only Event Lifecycle
              </h2>
              <p className="text-xs text-slate-400 mt-0.5">
                Current State: <strong className="text-indigo-400 uppercase">{event.status}</strong>
              </p>
            </div>

            {nextAction && (
              <button
                onClick={() => handleTransition(nextAction.target)}
                disabled={transitioning || (event.status === 'draft' && !event.isRubricValid)}
                className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-semibold shadow-lg transition-all cursor-pointer ${
                  event.status === 'draft' && !event.isRubricValid
                    ? 'bg-slate-800 text-slate-500 cursor-not-allowed border border-slate-700/50'
                    : 'bg-gradient-to-r from-indigo-600 to-violet-600 hover:from-indigo-500 hover:to-violet-500 text-white shadow-indigo-600/30'
                }`}
                title={
                  event.status === 'draft' && !event.isRubricValid
                    ? 'Rubric criteria weights must sum to exactly 100% before opening event'
                    : undefined
                }
              >
                {transitioning ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    <span>Transitioning...</span>
                  </>
                ) : (
                  <>
                    <span>{nextAction.label}</span>
                    <ArrowRight className="w-4 h-4" />
                  </>
                )}
              </button>
            )}

            {event.status === 'published' && (
              <div className="flex items-center gap-2">
                <Link
                  href={`/events/${id}/results`}
                  className="flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-semibold bg-indigo-600 hover:bg-indigo-500 text-white shadow-lg shadow-indigo-600/20 transition-all"
                >
                  <Trophy className="w-4 h-4 text-amber-300" />
                  <span>Public Leaderboard</span>
                </Link>
                <Link
                  href={`/verify/${id}`}
                  className="flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-semibold bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 transition-all"
                >
                  <ShieldCheck className="w-4 h-4" />
                  <span>Audit Proof</span>
                </Link>
              </div>
            )}
          </div>

          {/* Stepper Visualization */}
          <div className="grid grid-cols-5 gap-2 mt-6">
            {stages.map((stage, idx) => {
              const isPast = idx < currentStageIndex
              const isCurrent = idx === currentStageIndex

              return (
                <div
                  key={stage}
                  className={`p-3 rounded-xl border text-center transition-all ${
                    isCurrent
                      ? 'bg-indigo-950/40 border-indigo-500 text-white shadow-md shadow-indigo-500/10'
                      : isPast
                      ? 'bg-slate-950/60 border-emerald-900/40 text-emerald-400'
                      : 'bg-slate-950/30 border-slate-800/60 text-slate-600'
                  }`}
                >
                  <div className="flex items-center justify-center mb-1">
                    {isPast ? (
                      <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                    ) : (
                      <span className={`w-4 h-4 rounded-full text-[10px] font-bold flex items-center justify-center ${isCurrent ? 'bg-indigo-600 text-white' : 'bg-slate-800 text-slate-500'}`}>
                        {idx + 1}
                      </span>
                    )}
                  </div>
                  <p className="text-[11px] font-semibold uppercase tracking-wider">{stage}</p>
                </div>
              )
            })}
          </div>

          {event.status === 'draft' && !event.isRubricValid && (
            <div className="mt-4 p-3 rounded-xl bg-amber-950/30 border border-amber-800/50 flex items-center justify-between text-xs text-amber-300">
              <div className="flex items-center gap-2">
                <AlertCircle className="w-4 h-4 text-amber-400 shrink-0" />
                <span>
                  <strong>Opening Blocked:</strong> Rubric criteria weights sum to <strong>{event.totalWeight}%</strong>. Database rule requires exactly 100%.
                </span>
              </div>
              <Link
                href={`/org/events/${id}/rubric`}
                className="underline font-semibold hover:text-amber-200 text-[11px]"
              >
                Configure Rubric &rarr;
              </Link>
            </div>
          )}

          {event.isRubricFrozen && (
            <div className="mt-4 p-3 rounded-xl bg-purple-950/30 border border-purple-800/50 flex items-center gap-2 text-xs text-purple-300">
              <Lock className="w-4 h-4 text-purple-400 shrink-0" />
              <span>
                <strong>Rubric Immutable:</strong> In accordance with FairPitch audit policy, criteria are frozen against edits during and after judging.
              </span>
            </div>
          )}
        </div>

        {/* Feature Cards Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
          {/* Rubric Card */}
          <div className="bg-slate-900/80 border border-slate-800 rounded-2xl p-6 shadow-xl flex flex-col justify-between">
            <div>
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-2.5">
                  <div className="p-2 rounded-xl bg-indigo-500/10 text-indigo-400 border border-indigo-500/20">
                    <FileCheck2 className="w-5 h-5" />
                  </div>
                  <div>
                    <h3 className="text-sm font-bold text-slate-100">Evaluation Rubric</h3>
                    <p className="text-[11px] text-slate-400">Dimensions & score bands</p>
                  </div>
                </div>

                <span
                  className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold border ${
                    event.isRubricValid
                      ? 'bg-emerald-950/40 text-emerald-400 border-emerald-800/60'
                      : 'bg-amber-950/40 text-amber-400 border-amber-800/60'
                  }`}
                >
                  {event.totalWeight}% / 100%
                </span>
              </div>

              <div className="space-y-2 mb-4">
                {(event.criteria || []).map((c: RubricCriterion) => (
                  <div
                    key={c.id}
                    className="p-2.5 rounded-xl bg-slate-950 border border-slate-800 flex items-center justify-between text-xs"
                  >
                    <span className="font-medium text-slate-300">{c.name}</span>
                    <span className="font-semibold text-indigo-400">{c.weight}% weight</span>
                  </div>
                ))}
              </div>
            </div>

            <Link
              href={`/org/events/${id}/rubric`}
              className="w-full flex items-center justify-center gap-2 py-2 px-4 rounded-xl bg-slate-800 hover:bg-slate-700 text-xs font-semibold text-slate-200 transition-colors"
            >
              <span>{event.isRubricFrozen ? 'View Locked Rubric' : 'Edit Rubric Criteria'}</span>
              <ChevronRight className="w-3.5 h-3.5" />
            </Link>
          </div>

          {/* Teams Card */}
          <div className="bg-slate-900/80 border border-slate-800 rounded-2xl p-6 shadow-xl flex flex-col justify-between">
            <div>
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-2.5">
                  <div className="p-2 rounded-xl bg-blue-500/10 text-blue-400 border border-blue-500/20">
                    <Users className="w-5 h-5" />
                  </div>
                  <div>
                    <h3 className="text-sm font-bold text-slate-100">Participating Teams</h3>
                    <p className="text-[11px] text-slate-400">Rosters & project submissions</p>
                  </div>
                </div>

                <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-blue-950/40 text-blue-400 border border-blue-800/60">
                  {event.teamCount || 0} Registered
                </span>
              </div>

              <p className="text-xs text-slate-400 leading-relaxed mb-4">
                Participants register teams and invite teammates via unique team codes. Review project submissions and approve teams into the judging pool.
              </p>
            </div>

            <Link
              href={`/org/events/${id}/teams`}
              className="w-full flex items-center justify-center gap-2 py-2 px-4 rounded-xl bg-slate-800 hover:bg-slate-700 text-xs font-semibold text-slate-200 transition-colors"
            >
              <span>Manage Teams Roster</span>
              <ChevronRight className="w-3.5 h-3.5" />
            </Link>
          </div>

          {/* Jury Assignments Card */}
          <div className="bg-slate-900/80 border border-slate-800 rounded-2xl p-6 shadow-xl flex flex-col justify-between">
            <div>
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-2.5">
                  <div className="p-2 rounded-xl bg-purple-500/10 text-purple-400 border border-purple-500/20">
                    <LayoutGrid className="w-5 h-5" />
                  </div>
                  <div>
                    <h3 className="text-sm font-bold text-slate-100">Jury Evaluation Matrix</h3>
                    <p className="text-[11px] text-slate-400">Pairings & drift mitigation</p>
                  </div>
                </div>

                <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-purple-950/40 text-purple-400 border border-purple-800/60">
                  Balanced Grid
                </span>
              </div>

              <p className="text-xs text-slate-400 leading-relaxed mb-4">
                Configure judge-to-team assignment matrices with randomized sequence ordering to disperse cognitive fatigue drift across the panel.
              </p>
            </div>

            <Link
              href={`/org/events/${id}/assignments`}
              className="w-full flex items-center justify-center gap-2 py-2 px-4 rounded-xl bg-slate-800 hover:bg-slate-700 text-xs font-semibold text-slate-200 transition-colors"
            >
              <span>View Assignment Matrix</span>
              <ChevronRight className="w-3.5 h-3.5" />
            </Link>
          </div>

          {/* Statistical Fairness Card */}
          <div className="bg-slate-900/80 border border-slate-800 rounded-2xl p-6 shadow-xl flex flex-col justify-between">
            <div>
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-2.5">
                  <div className="p-2 rounded-xl bg-amber-500/10 text-amber-400 border border-amber-500/20">
                    <Scale className="w-5 h-5" />
                  </div>
                  <div>
                    <h3 className="text-sm font-bold text-slate-100">Statistical Fairness & Telemetry</h3>
                    <p className="text-[11px] text-slate-400">Z-Scores, drift & winner flips</p>
                  </div>
                </div>

                <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-amber-950/40 text-amber-400 border border-amber-800/60">
                  Peer Calibrated
                </span>
              </div>

              <p className="text-xs text-slate-400 leading-relaxed mb-4">
                Examine judge leniency outliers, fatigue correlation, panel disagreement dispersion, and run counterfactual what-if rerank simulations.
              </p>
            </div>

            <Link
              href={`/org/events/${id}/fairness`}
              className="w-full flex items-center justify-center gap-2 py-2 px-4 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-xs font-semibold text-white transition-colors shadow-lg shadow-indigo-600/20"
            >
              <span>Open Fairness Engine</span>
              <ChevronRight className="w-3.5 h-3.5" />
            </Link>
          </div>

          {/* Dispute Inquiries Card */}
          <div className="bg-slate-900/80 border border-slate-800 rounded-2xl p-6 shadow-xl flex flex-col justify-between">
            <div>
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-2.5">
                  <div className="p-2 rounded-xl bg-amber-500/10 text-amber-400 border border-amber-500/20">
                    <MessageSquare className="w-5 h-5" />
                  </div>
                  <div>
                    <h3 className="text-sm font-bold text-slate-100">Dispute & Review Desk</h3>
                    <p className="text-[11px] text-slate-400">Clarification tickets & appeals</p>
                  </div>
                </div>

                <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-amber-950/40 text-amber-400 border border-amber-800/60">
                  Tickets Pipeline
                </span>
              </div>

              <p className="text-xs text-slate-400 leading-relaxed mb-4">
                Review and resolve participant inquiries contesting rubric deductions, review qualitative notes, and record formal decisions.
              </p>
            </div>

            <Link
              href={`/org/events/${id}/tickets`}
              className="w-full flex items-center justify-center gap-2 py-2 px-4 rounded-xl bg-slate-800 hover:bg-slate-700 text-xs font-semibold text-slate-200 transition-colors"
            >
              <span>Manage Dispute Tickets</span>
              <ChevronRight className="w-3.5 h-3.5" />
            </Link>
          </div>

          {/* UPI Payments & Registrations Card */}
          <div className="bg-slate-900/80 border border-slate-800 rounded-2xl p-6 shadow-xl flex flex-col justify-between">
            <div>
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-2.5">
                  <div className="p-2 rounded-xl bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                    <QrCode className="w-5 h-5" />
                  </div>
                  <div>
                    <h3 className="text-sm font-bold text-slate-100">UPI Payments & Registrations</h3>
                    <p className="text-[11px] text-slate-400">Dynamic QR, UTR approvals & Join Codes</p>
                  </div>
                </div>

                <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-emerald-950/40 text-emerald-400 border border-emerald-800/60">
                  0% Gateway Fees
                </span>
              </div>

              <p className="text-xs text-slate-400 leading-relaxed mb-4">
                Configure your UPI VPA to allocate dynamic, prefilled QR codes to registering teams. Verify incoming 12-digit UTR numbers to unlock team join codes directly into your bank account.
              </p>
            </div>

            <Link
              href={`/org/events/${id}/payments`}
              className="w-full flex items-center justify-center gap-2 py-2 px-4 rounded-xl bg-slate-800 hover:bg-slate-700 text-xs font-semibold text-slate-200 transition-colors"
            >
              <span>Manage UPI & Registrations</span>
              <ChevronRight className="w-3.5 h-3.5" />
            </Link>
          </div>
        </div>

        {/* Cryptographic Ledger Summary */}
        <div className="bg-slate-900/60 border border-slate-800 rounded-2xl p-6">
          <div className="flex items-center gap-3 mb-3">
            <div className="p-2 rounded-xl bg-violet-500/10 text-violet-400 border border-violet-500/20">
              <Hash className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-slate-100">Cryptographic Proof & Anchoring</h3>
              <p className="text-[11px] text-slate-400">Append-Only SHA-256 Hash Chain & Merkle Tree</p>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 text-xs mt-4">
            <div className="p-3 rounded-xl bg-slate-950 border border-slate-800">
              <span className="text-slate-500 block text-[10px] uppercase">Anchored Merkle Root</span>
              <span className="font-mono text-slate-300 text-[11px] truncate block mt-0.5">
                {event.anchored_merkle_root || 'Calculated at Publish time'}
              </span>
            </div>

            <div className="p-3 rounded-xl bg-slate-950 border border-slate-800">
              <span className="text-slate-500 block text-[10px] uppercase">Per-Judge Chains</span>
              <span className="text-emerald-400 font-semibold block mt-0.5">
                One SHA-256 Chain Per Judge
              </span>
            </div>

            <div className="p-3 rounded-xl bg-slate-950 border border-slate-800">
              <span className="text-slate-500 block text-[10px] uppercase">Odd-Leaf Tree Rule</span>
              <span className="text-indigo-400 font-semibold block mt-0.5">
                Duplicate Final Node
              </span>
            </div>
          </div>
        </div>
      </main>
    </div>
  )
}
