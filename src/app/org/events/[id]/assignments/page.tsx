'use client'

import React, { useEffect, useState, use } from 'react'
import Link from 'next/link'
import {
  Users,
  ArrowLeft,
  Sparkles,
  CheckCircle2,
  Clock,
  ShieldAlert,
  Loader2,
  AlertCircle
} from 'lucide-react'

export default function EventAssignmentsPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = use(params)

  const [assignments, setAssignments] = useState<any[]>([])
  const [eventTitle, setEventTitle] = useState('')
  const [loading, setLoading] = useState(true)
  const [generating, setGenerating] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)

  async function fetchAssignments() {
    try {
      const res = await fetch(`/api/org/events/${id}/assignments`)
      if (res.ok) {
        const data = await res.json()
        setAssignments(data.assignments || [])
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
    fetchAssignments()
  }, [id])

  async function handleGenerateMatrix() {
    if (!confirm('Generate balanced judge assignments? This distributes approved teams across available evaluators with randomized drift sequence.')) return

    setGenerating(true)
    setError(null)
    setSuccess(null)

    try {
      const res = await fetch(`/api/org/events/${id}/assignments`, {
        method: 'POST',
      })

      const data = await res.json()
      if (!res.ok) {
        throw new Error(data.error || 'Failed to generate assignments')
      }

      setSuccess(data.message)
      await fetchAssignments()
    } catch (err: any) {
      setError(err.message)
    } finally {
      setGenerating(false)
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
          <div className="h-9 w-9 rounded-lg bg-indigo-600 flex items-center justify-center text-white shadow-md shadow-indigo-600/30">
            <Users className="w-5 h-5" />
          </div>
          <div>
            <h1 className="text-sm font-bold text-slate-100">Balanced Judge Assignment Matrix</h1>
            <p className="text-[11px] text-slate-400">{eventTitle || 'Event Assignments'}</p>
          </div>
        </div>

        <Link
          href={`/org/events/${id}`}
          className="text-xs px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 transition-colors"
        >
          Return to Command Center
        </Link>
      </header>

      <main className="flex-1 max-w-6xl w-full mx-auto px-6 py-8">
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

        <div className="flex items-center justify-between mb-6">
          <div>
            <h2 className="text-base font-bold text-slate-100">
              Evaluation Assignments ({assignments.length})
            </h2>
            <p className="text-xs text-slate-400 mt-0.5">
              Balanced round-robin allocation ensuring each team receives sufficient peer evaluations.
            </p>
          </div>

          <button
            onClick={handleGenerateMatrix}
            disabled={generating}
            className="flex items-center gap-2 px-4 py-2 rounded-xl bg-gradient-to-r from-indigo-600 to-violet-600 hover:from-indigo-500 hover:to-violet-500 text-white font-semibold text-xs shadow-lg shadow-indigo-600/30 transition-all cursor-pointer disabled:opacity-50"
          >
            {generating ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                <span>Distributing Matrix...</span>
              </>
            ) : (
              <>
                <Sparkles className="w-4 h-4" />
                <span>Auto-Generate Balanced Matrix</span>
              </>
            )}
          </button>
        </div>

        {loading ? (
          <div className="py-20 flex flex-col items-center justify-center gap-2 text-slate-500">
            <Loader2 className="w-7 h-7 animate-spin text-indigo-500" />
            <span className="text-xs">Loading assignment matrix...</span>
          </div>
        ) : assignments.length === 0 ? (
          <div className="bg-slate-900/60 border border-slate-800 rounded-2xl p-12 text-center text-xs text-slate-500 max-w-md mx-auto">
            <div className="w-12 h-12 rounded-xl bg-indigo-500/10 border border-indigo-500/20 flex items-center justify-center mx-auto mb-3 text-indigo-400">
              <Users className="w-6 h-6" />
            </div>
            <h3 className="text-sm font-semibold text-slate-200">No Assignments Generated</h3>
            <p className="mt-1 text-slate-400 mb-6">
              Ensure you have approved teams and invited jury evaluators, then click above to generate the matrix.
            </p>
          </div>
        ) : (
          <div className="bg-slate-900/80 border border-slate-800 rounded-2xl p-6 shadow-xl overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead>
                <tr className="border-b border-slate-800 text-slate-400">
                  <th className="pb-3 font-semibold">Judge</th>
                  <th className="pb-3 font-semibold">Team Assigned</th>
                  <th className="pb-3 font-semibold">Random Sequence #</th>
                  <th className="pb-3 font-semibold">Status</th>
                  <th className="pb-3 font-semibold">Assigned At</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/60">
                {assignments.map((a) => (
                  <tr key={a.id} className="hover:bg-slate-850/30 transition-colors">
                    <td className="py-3.5">
                      <span className="font-semibold text-slate-200 block">
                        {a.profiles?.full_name || 'Jury Evaluator'}
                      </span>
                      <span className="text-slate-500 text-[11px] block">{a.profiles?.email}</span>
                    </td>
                    <td className="py-3.5">
                      <span className="font-medium text-slate-300">
                        {a.teams?.name} ({a.teams?.team_code})
                      </span>
                    </td>
                    <td className="py-3.5">
                      <span className="font-mono text-slate-400 bg-slate-950 px-2 py-0.5 rounded border border-slate-800">
                        #{a.order_index}
                      </span>
                    </td>
                    <td className="py-3.5">
                      <span
                        className={`px-2 py-0.5 rounded-full text-[10px] font-semibold border ${
                          a.status === 'completed'
                            ? 'bg-emerald-950/40 text-emerald-400 border-emerald-800/60'
                            : a.status === 'excused'
                            ? 'bg-red-950/40 text-red-400 border-red-800/60'
                            : 'bg-amber-950/40 text-amber-400 border-amber-800/60'
                        }`}
                      >
                        {a.status}
                      </span>
                    </td>
                    <td className="py-3.5 text-slate-500">
                      {new Date(a.assigned_at).toLocaleDateString()}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </main>
    </div>
  )
}
