'use client'

import React, { useEffect, useState, use } from 'react'
import Link from 'next/link'
import {
  FileEdit,
  ArrowLeft,
  CheckCircle2,
  AlertCircle,
  Loader2,
  Clock,
  Lock
} from 'lucide-react'

export default function EventScoreEditsPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = use(params)

  const [editRequests, setEditRequests] = useState<any[]>([])
  const [eventTitle, setEventTitle] = useState('')
  const [loading, setLoading] = useState(true)
  const [actionLoading, setActionLoading] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)

  async function fetchEdits() {
    try {
      const res = await fetch(`/api/org/events/${id}/edit-requests`)
      if (res.ok) {
        const data = await res.json()
        setEditRequests(data.editRequests || [])
      }

      const evRes = await fetch(`/api/events/${id}`)
      if (evRes.ok) {
        const ev = await evRes.json()
        setEventTitle(ev.event.title)
      }
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchEdits()
  }, [id])

  async function handleApprove(requestId: string) {
    if (!confirm('Approve this score correction? A new score row with version + 1 will be appended to the immutable audit ledger.')) return

    setActionLoading(requestId)
    setError(null)
    setSuccess(null)

    try {
      const res = await fetch(`/api/org/events/${id}/edit-requests/${requestId}/approve`, {
        method: 'POST',
      })

      const data = await res.json()
      if (!res.ok) {
        throw new Error(data.error || 'Failed to approve score edit')
      }

      setSuccess('Score correction approved and version incremented in append-only ledger!')
      await fetchEdits()
    } catch (err: any) {
      setError(err.message)
    } finally {
      setActionLoading(null)
    }
  }

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col">
      <header className="border-b border-slate-800 bg-slate-900/60 backdrop-blur-md px-6 py-4 flex items-center justify-between sticky top-0 z-20">
        <div className="flex items-center gap-3">
          <Link
            href={`/org/events/${id}`}
            className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-slate-200 transition-colors"
          >
            <ArrowLeft className="w-4 h-4" />
          </Link>
          <div className="h-9 w-9 rounded-lg bg-amber-600 flex items-center justify-center text-white shadow-md shadow-amber-600/30">
            <FileEdit className="w-5 h-5" />
          </div>
          <div>
            <h1 className="text-sm font-bold text-slate-100">Score Correction Governance</h1>
            <p className="text-[11px] text-slate-400">{eventTitle || 'Score Revision Review'}</p>
          </div>
        </div>

        <Link
          href={`/org/events/${id}`}
          className="text-xs px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 transition-colors"
        >
          Return to Command Center
        </Link>
      </header>

      <main className="flex-1 max-w-5xl w-full mx-auto px-6 py-8">
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

        <div className="mb-6">
          <h2 className="text-base font-bold text-slate-100">
            Jury Revision Requests ({editRequests.length})
          </h2>
          <p className="text-xs text-slate-400 mt-0.5">
            FairPitch enforces append-only scoring. Approved edits insert a new version without deleting previous evaluations.
          </p>
        </div>

        {loading ? (
          <div className="py-20 flex flex-col items-center justify-center gap-2 text-slate-500">
            <Loader2 className="w-7 h-7 animate-spin text-amber-500" />
            <span className="text-xs">Loading score edit requests...</span>
          </div>
        ) : editRequests.length === 0 ? (
          <div className="bg-slate-900/60 border border-slate-800 rounded-2xl p-12 text-center text-xs text-slate-500 max-w-md mx-auto">
            <div className="w-12 h-12 rounded-xl bg-amber-500/10 border border-amber-500/20 flex items-center justify-center mx-auto mb-3 text-amber-400">
              <FileEdit className="w-6 h-6" />
            </div>
            <h3 className="text-sm font-semibold text-slate-200">No Pending Requests</h3>
            <p className="mt-1 text-slate-400">
              No evaluator has submitted score correction requests for this event.
            </p>
          </div>
        ) : (
          <div className="space-y-4">
            {editRequests.map((req) => (
              <div
                key={req.id}
                className="bg-slate-900/80 border border-slate-800 rounded-2xl p-6 shadow-xl"
              >
                <div className="flex items-start justify-between gap-4 mb-3">
                  <div>
                    <span className="text-[11px] text-slate-400 uppercase tracking-wider block">
                      Team: <strong className="text-slate-200">{req.teams?.name}</strong> ({req.teams?.team_code})
                    </span>
                    <span className="text-xs text-indigo-400 font-semibold block mt-0.5">
                      Requested by: {req.profiles?.full_name} ({req.profiles?.email})
                    </span>
                  </div>

                  <span
                    className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold border ${
                      req.status === 'approved'
                        ? 'bg-emerald-950/40 text-emerald-400 border-emerald-800/60'
                        : req.status === 'rejected'
                        ? 'bg-red-950/40 text-red-400 border-red-800/60'
                        : 'bg-amber-950/40 text-amber-400 border-amber-800/60'
                    }`}
                  >
                    {req.status}
                  </span>
                </div>

                <div className="p-3.5 rounded-xl bg-slate-950 border border-slate-800 text-xs text-slate-300 mb-4">
                  <span className="text-slate-500 text-[11px] block uppercase font-semibold mb-1">
                    Justification Reason:
                  </span>
                  <p>{req.reason}</p>
                </div>

                {req.requested_changes && Array.isArray(req.requested_changes) && (
                  <div className="space-y-2 mb-4">
                    <span className="text-[11px] text-slate-500 uppercase font-semibold block">
                      Proposed Revisions:
                    </span>
                    {req.requested_changes.map((ch: any, idx: number) => (
                      <div
                        key={idx}
                        className="p-2.5 rounded-lg bg-slate-950/60 border border-slate-800 text-xs flex items-center justify-between"
                      >
                        <span className="text-slate-400 font-mono text-[11px]">Criterion: {ch.criterionId}</span>
                        <span className="font-bold text-violet-400">{ch.newScore} pts</span>
                      </div>
                    ))}
                  </div>
                )}

                <div className="pt-3 border-t border-slate-800 flex items-center justify-between text-xs">
                  <span className="text-slate-500 text-[11px]">
                    Submitted {new Date(req.created_at).toLocaleString()}
                  </span>

                  {req.status === 'pending' && (
                    <button
                      onClick={() => handleApprove(req.id)}
                      disabled={actionLoading === req.id}
                      className="px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-semibold text-xs transition-colors shadow-md shadow-emerald-600/30 cursor-pointer disabled:opacity-50"
                    >
                      {actionLoading === req.id ? 'Applying...' : 'Approve Score Correction (Append-Only)'}
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </main>
    </div>
  )
}
