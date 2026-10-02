'use client'

import React, { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import {
  Award,
  CheckCircle2,
  Clock,
  Shield,
  ShieldAlert,
  ArrowRight,
  LogOut,
  Loader2,
  ExternalLink,
  GitBranch,
  Hash,
  AlertCircle
} from 'lucide-react'
import type { JudgeQueueItem } from '@/lib/jury/types'

export default function JuryQueueDashboard() {
  const router = useRouter()
  const [queue, setQueue] = useState<JudgeQueueItem[]>([])
  const [stats, setStats] = useState<{ totalCount: number; completedCount: number; progressPct: number }>({
    totalCount: 0,
    completedCount: 0,
    progressPct: 0,
  })
  const [loading, setLoading] = useState(true)

  async function fetchQueue() {
    try {
      const res = await fetch('/api/jury/assignments')
      if (res.ok) {
        const data = await res.json()
        setQueue(data.queue || [])
        if (data.stats) setStats(data.stats)
      }
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchQueue()
  }, [])

  async function handleSignOut() {
    await fetch('/api/auth/logout', { method: 'POST' })
    router.push('/login')
  }

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col">
      {/* Header */}
      <header className="border-b border-slate-800 bg-slate-900/60 backdrop-blur-md px-6 py-4 flex items-center justify-between sticky top-0 z-20">
        <div className="flex items-center gap-3">
          <div className="h-9 w-9 rounded-lg bg-violet-600 flex items-center justify-center text-white shadow-md shadow-violet-600/30">
            <Award className="w-5 h-5" />
          </div>
          <div>
            <h1 className="text-sm font-bold text-slate-100 flex items-center gap-2">
              Jury Evaluation Suite
              <span className="text-[10px] px-2 py-0.5 rounded-full bg-violet-500/20 text-violet-400 font-semibold border border-violet-500/30 flex items-center gap-1">
                <Hash className="w-3 h-3" />
                SHA-256 Ledger
              </span>
            </h1>
            <p className="text-[11px] text-slate-400">Randomized Drift Order Evaluation Queue</p>
          </div>
        </div>

        <button
          onClick={handleSignOut}
          className="flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-lg bg-red-950/40 hover:bg-red-950/80 text-red-400 border border-red-900/50 transition-colors cursor-pointer"
        >
          <LogOut className="w-3.5 h-3.5" />
          <span>Sign Out</span>
        </button>
      </header>

      <main className="flex-1 max-w-5xl w-full mx-auto px-6 py-8">
        {/* Progress & Telemetry Header */}
        <div className="bg-slate-900/80 border border-slate-800 rounded-2xl p-6 shadow-xl mb-8">
          <div className="flex items-center justify-between mb-2">
            <div>
              <h2 className="text-base font-bold text-slate-100">
                Evaluation Progress
              </h2>
              <p className="text-xs text-slate-400 mt-0.5">
                {stats.completedCount} of {stats.totalCount} assigned teams evaluated
              </p>
            </div>

            <div className="text-right">
              <span className="text-2xl font-bold font-mono text-violet-400">
                {stats.progressPct}%
              </span>
            </div>
          </div>

          <div className="w-full h-2.5 rounded-full bg-slate-950 overflow-hidden border border-slate-800 p-0.5 mt-2">
            <div
              className="h-full rounded-full bg-gradient-to-r from-violet-600 to-indigo-500 transition-all duration-300 shadow-sm shadow-violet-500/50"
              style={{ width: `${stats.progressPct}%` }}
            />
          </div>

          <div className="mt-4 pt-4 border-t border-slate-800/80 flex items-center justify-between text-xs text-slate-400">
            <span className="flex items-center gap-1.5">
              <Shield className="w-3.5 h-3.5 text-indigo-400" />
              <span>Randomized sequence mitigates panel fatigue drift</span>
            </span>
            <span className="text-slate-500">
              Evaluations commit directly to your independent hash chain
            </span>
          </div>
        </div>

        {/* Queue Items */}
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-base font-bold text-slate-100">
            Assigned Teams Queue ({queue.length})
          </h2>
          <span className="text-xs text-slate-500">
            Sequence 1 &rarr; {queue.length}
          </span>
        </div>

        {loading ? (
          <div className="py-20 flex flex-col items-center justify-center gap-2 text-slate-500">
            <Loader2 className="w-7 h-7 animate-spin text-violet-500" />
            <span className="text-xs">Loading assigned evaluation matrix...</span>
          </div>
        ) : queue.length === 0 ? (
          <div className="bg-slate-900/60 border border-slate-800 rounded-2xl p-12 text-center text-xs text-slate-500 max-w-md mx-auto">
            <div className="w-12 h-12 rounded-xl bg-violet-500/10 border border-violet-500/20 flex items-center justify-center mx-auto mb-3 text-violet-400">
              <Award className="w-6 h-6" />
            </div>
            <h3 className="text-sm font-semibold text-slate-200">No Assignments Yet</h3>
            <p className="mt-1 text-slate-400">
              The event organizer has not published the balanced judging matrix yet. You will be notified when judging commences.
            </p>
          </div>
        ) : (
          <div className="space-y-4">
            {queue.map((item, idx) => {
              const isCompleted = item.isCompleted
              const isExcused = item.status === 'excused' || item.hasConflict

              return (
                <div
                  key={item.id}
                  className={`bg-slate-900/80 border rounded-2xl p-5 shadow-lg transition-all ${
                    isExcused
                      ? 'border-slate-800/50 opacity-60'
                      : isCompleted
                      ? 'border-emerald-900/40 bg-slate-900/50'
                      : 'border-slate-800 hover:border-violet-500/50'
                  }`}
                >
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex-1">
                      <div className="flex items-center gap-2.5 mb-2">
                        <span className="w-6 h-6 rounded-lg bg-slate-800 text-slate-300 font-mono text-xs font-bold flex items-center justify-center">
                          #{item.orderIndex || idx + 1}
                        </span>

                        <h3 className="text-base font-bold text-slate-100">
                          {item.displayName}
                        </h3>

                        {item.track && (
                          <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-slate-800 text-slate-400 border border-slate-700/60">
                            {item.track}
                          </span>
                        )}

                        {isExcused ? (
                          <span className="flex items-center gap-1 text-[10px] font-semibold px-2 py-0.5 rounded-full bg-red-950/40 text-red-400 border border-red-800/60">
                            <ShieldAlert className="w-3 h-3" />
                            Conflict Declared / Excused
                          </span>
                        ) : isCompleted ? (
                          <span className="flex items-center gap-1 text-[10px] font-semibold px-2 py-0.5 rounded-full bg-emerald-950/40 text-emerald-400 border border-emerald-800/60">
                            <CheckCircle2 className="w-3 h-3" />
                            Completed (Committed)
                          </span>
                        ) : (
                          <span className="flex items-center gap-1 text-[10px] font-semibold px-2 py-0.5 rounded-full bg-amber-950/40 text-amber-400 border border-amber-800/60">
                            <Clock className="w-3 h-3" />
                            Pending Evaluation
                          </span>
                        )}
                      </div>

                      {item.tagline && (
                        <p className="text-xs text-slate-400 italic mb-2">{item.tagline}</p>
                      )}

                      {item.submission && (
                        <div className="text-xs text-slate-400 flex items-center gap-4 mt-2">
                          <span className="text-slate-300 font-medium">
                            Project: {item.submission.title}
                          </span>
                          {item.submission.repoUrl && (
                            <a
                              href={item.submission.repoUrl}
                              target="_blank"
                              rel="noreferrer"
                              className="text-indigo-400 hover:text-indigo-300 flex items-center gap-1"
                            >
                              <GitBranch className="w-3 h-3" />
                              <span>Repo</span>
                            </a>
                          )}
                          {item.submission.demoUrl && (
                            <a
                              href={item.submission.demoUrl}
                              target="_blank"
                              rel="noreferrer"
                              className="text-emerald-400 hover:text-emerald-300 flex items-center gap-1"
                            >
                              <ExternalLink className="w-3 h-3" />
                              <span>Demo</span>
                            </a>
                          )}
                        </div>
                      )}
                    </div>

                    <div>
                      {!isExcused && (
                        <Link
                          href={`/jury/evaluate/${item.teamId}`}
                          className={`flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-semibold shadow-md transition-all ${
                            isCompleted
                              ? 'bg-slate-800 hover:bg-slate-700 text-slate-300'
                              : 'bg-violet-600 hover:bg-violet-500 text-white shadow-violet-600/30'
                          }`}
                        >
                          <span>{isCompleted ? 'Review / Edit' : 'Evaluate Team'}</span>
                          <ArrowRight className="w-3.5 h-3.5" />
                        </Link>
                      )}
                    </div>
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </main>
    </div>
  )
}
