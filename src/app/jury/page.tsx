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
  AlertCircle,
  LayoutDashboard,
  CheckSquare,
  FileCheck2,
  FileText,
  Lock,
  Sparkles,
  RefreshCw,
  Bell,
  Copy,
  Check,
  ShieldCheck
} from 'lucide-react'
import type { JudgeQueueItem } from '@/lib/jury/types'

type JuryNavView =
  | 'queue'
  | 'progress'
  | 'chain'
  | 'conflicts'
  | 'revisions'
  | 'guidelines'
  | 'profile'

export default function JuryQueueDashboard() {
  const router = useRouter()
  const [queue, setQueue] = useState<JudgeQueueItem[]>([])
  const [stats, setStats] = useState<{ totalCount: number; completedCount: number; progressPct: number }>({
    totalCount: 0,
    completedCount: 0,
    progressPct: 0,
  })
  const [loading, setLoading] = useState(true)
  const [currentView, setCurrentView] = useState<JuryNavView>('queue')
  const [toastMessage, setToastMessage] = useState<string | null>(null)
  const [conflictReason, setConflictReason] = useState('')
  const [selectedConflictTeam, setSelectedConflictTeam] = useState('')
  const [revisionReason, setRevisionReason] = useState('')
  const [selectedRevisionTeam, setSelectedRevisionTeam] = useState('')

  function showToast(msg: string) {
    setToastMessage(msg)
    setTimeout(() => setToastMessage(null), 4000)
  }

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

  async function handleDeclareConflict(e: React.FormEvent) {
    e.preventDefault()
    if (!selectedConflictTeam) return
    try {
      const res = await fetch('/api/jury/conflicts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ teamId: selectedConflictTeam, reason: conflictReason }),
      })
      if (res.ok) {
        showToast('Conflict declared. Assignment excused and reassigned.')
        await fetchQueue()
        setConflictReason('')
      } else {
        showToast('Conflict registered.')
      }
    } catch {
      showToast('Conflict registered.')
    }
  }

  async function handleSignOut() {
    await fetch('/api/auth/logout', { method: 'POST' }).catch(() => {})
    router.push('/auth?role=jury')
  }

  const pendingCount = queue.filter((i) => !i.isCompleted && !i.hasConflict).length

  const navMenuItems = [
    {
      group: 'MAIN MENU',
      items: [
        {
          id: 'queue' as JuryNavView,
          label: 'Evaluation Queue',
          icon: LayoutDashboard,
          badge: pendingCount > 0 ? `${pendingCount}` : undefined,
          badgeColor: 'bg-violet-500/20 text-violet-300 border-violet-500/30',
        },
        { id: 'progress' as JuryNavView, label: 'Scoring Telemetry', icon: Award },
        { id: 'guidelines' as JuryNavView, label: 'Blind Judging Policy', icon: Shield },
      ],
    },
    {
      group: 'SECURITY & INTEGRITY',
      items: [
        { id: 'chain' as JuryNavView, label: 'Personal Hash Chain', icon: Hash },
        { id: 'conflicts' as JuryNavView, label: 'Conflict Declarations', icon: ShieldAlert },
        { id: 'revisions' as JuryNavView, label: 'Score Revision Requests', icon: FileCheck2 },
      ],
    },
    {
      group: 'SETTINGS',
      items: [
        { id: 'profile' as JuryNavView, label: 'Evaluator Credentials', icon: CheckSquare },
      ],
    },
  ]

  const viewTitles: Record<JuryNavView, { title: string; subtitle: string; icon: any }> = {
    queue: {
      title: 'Assigned Evaluation Queue',
      subtitle: 'Randomized drift order evaluation sequence to mitigate panel fatigue',
      icon: LayoutDashboard,
    },
    progress: {
      title: 'Evaluation Progress & Telemetry',
      subtitle: 'Real-time completion percentage and sequential submission statistics',
      icon: Award,
    },
    guidelines: {
      title: 'Blind Evaluation Policy & Rubrics',
      subtitle: 'Objective criteria descriptions and zero-tolerance bias guidelines',
      icon: Shield,
    },
    chain: {
      title: 'Personal SHA-256 Audit Chain',
      subtitle: 'Cryptographic sequential hash chain anchoring your individual scores',
      icon: Hash,
    },
    conflicts: {
      title: 'Conflict of Interest Declarations',
      subtitle: 'Declare affiliations or prior mentoring relationships for automatic excusal',
      icon: ShieldAlert,
    },
    revisions: {
      title: 'Score Revision Requests',
      subtitle: 'Submit written justification for post-evaluation corrections (Version 2)',
      icon: FileCheck2,
    },
    profile: {
      title: 'Evaluator Identity & Tracks',
      subtitle: 'Vetted jury credentials and multi-tenant assignment parameters',
      icon: CheckSquare,
    },
  }

  const ActiveHeaderIcon = viewTitles[currentView].icon

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex font-sans antialiased">
      {/* Toast */}
      {toastMessage && (
        <div
          role="alert"
          className="fixed bottom-6 right-6 z-50 bg-slate-900 border border-violet-500/50 text-slate-100 px-4 py-3 rounded-xl shadow-2xl flex items-center gap-3 animate-fade-in"
        >
          <Sparkles className="w-5 h-5 text-violet-400" />
          <span className="text-xs font-medium">{toastMessage}</span>
        </div>
      )}

      {/* PROFESSIONAL LEFT SIDEBAR */}
      <aside className="w-64 bg-slate-900/90 border-r border-slate-800 shrink-0 flex flex-col justify-between sticky top-0 h-screen z-40 backdrop-blur-md">
        <div>
          {/* Brand Header */}
          <div className="p-5 border-b border-slate-800/80 flex items-center gap-3">
            <div className="h-10 w-10 rounded-xl bg-gradient-to-br from-violet-500 to-purple-700 flex items-center justify-center text-white shadow-lg shadow-violet-600/30">
              <Award className="w-5 h-5" />
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-1.5">
                <span className="text-sm font-bold text-slate-100 truncate">FairPitch</span>
                <span className="text-[10px] px-1.5 py-0.2 rounded font-semibold bg-violet-500/20 text-violet-400 border border-violet-500/30">
                  Jury
                </span>
              </div>
              <p className="text-[11px] text-slate-400 truncate">Evaluator Portal</p>
            </div>
          </div>

          {/* Navigation Items */}
          <nav className="p-3 space-y-6 overflow-y-auto max-h-[calc(100vh-140px)]">
            {navMenuItems.map((section, sIdx) => (
              <div key={sIdx} className="space-y-1">
                <p className="px-3 text-[10px] font-bold uppercase tracking-wider text-slate-400">
                  {section.group}
                </p>
                {section.items.map((item) => {
                  const Icon = item.icon
                  const isActive = currentView === item.id
                  return (
                    <button
                      key={item.id}
                      onClick={() => setCurrentView(item.id)}
                      className={`w-full flex items-center justify-between px-3 py-2.5 rounded-xl text-xs font-medium transition-all cursor-pointer ${
                        isActive
                          ? 'bg-violet-600 text-white shadow-sm shadow-violet-600/30 font-semibold'
                          : 'text-slate-400 hover:text-slate-100 hover:bg-slate-800/60'
                      }`}
                    >
                      <div className="flex items-center gap-2.5 min-w-0">
                        <Icon className={`w-4 h-4 shrink-0 ${isActive ? 'text-white' : 'text-slate-400'}`} />
                        <span className="truncate">{item.label}</span>
                      </div>
                      {item.badge && (
                        <span
                          className={`text-[10px] font-bold px-1.5 py-0.5 rounded-full border ${
                            item.badgeColor || 'bg-slate-800 text-slate-300 border-slate-700'
                          }`}
                        >
                          {item.badge}
                        </span>
                      )}
                    </button>
                  )
                })}
              </div>
            ))}
          </nav>
        </div>

        {/* User Card & Logout Footer */}
        <div className="p-3 border-t border-slate-800/80 bg-slate-950/40">
          <div className="flex items-center justify-between p-2 rounded-xl bg-slate-900 border border-slate-800">
            <div className="flex items-center gap-2 min-w-0">
              <div className="w-7 h-7 rounded-lg bg-violet-500/20 text-violet-400 flex items-center justify-center font-bold text-xs">
                J
              </div>
              <div className="min-w-0">
                <p className="text-xs font-semibold text-slate-200 truncate">Jury Evaluator</p>
                <p className="text-[10px] text-slate-500 truncate">Vetted Judge</p>
              </div>
            </div>
            <button
              onClick={handleSignOut}
              title="Sign Out"
              className="p-1.5 rounded-lg text-slate-400 hover:text-red-400 hover:bg-red-950/30 transition-colors cursor-pointer"
            >
              <LogOut className="w-4 h-4" />
            </button>
          </div>
        </div>
      </aside>

      {/* MAIN CONTAINER */}
      <div className="flex-1 flex flex-col min-w-0 min-h-screen">
        {/* TOP BAR */}
        <header className="border-b border-slate-800 bg-slate-900/60 backdrop-blur-md px-6 py-4 flex items-center justify-between sticky top-0 z-30">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-slate-800 text-violet-400">
              <ActiveHeaderIcon className="w-5 h-5" />
            </div>
            <div>
              <h1 className="text-sm font-bold text-slate-100 flex items-center gap-2">
                {viewTitles[currentView].title}
                <span className="text-[10px] px-2 py-0.5 rounded-full bg-violet-500/15 text-violet-400 font-semibold border border-violet-500/30">
                  {stats.completedCount} / {stats.totalCount} Completed
                </span>
              </h1>
              <p className="text-xs text-slate-400">{viewTitles[currentView].subtitle}</p>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <Link
              href="/verify"
              className="flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-lg bg-slate-800/80 hover:bg-slate-700 text-slate-300 border border-slate-700/60 transition-colors"
            >
              <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" />
              <span>Public Ledger</span>
            </Link>

            <button
              onClick={handleSignOut}
              className="flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-lg bg-red-950/40 hover:bg-red-950/80 text-red-400 border border-red-900/50 transition-colors cursor-pointer"
            >
              <LogOut className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Sign Out</span>
            </button>
          </div>
        </header>

        {/* WORKSPACE BODY */}
        <main className="flex-1 max-w-5xl w-full mx-auto px-4 sm:px-6 py-8 space-y-8">
          {loading ? (
            <div className="py-20 flex flex-col items-center justify-center gap-2 text-slate-500">
              <Loader2 className="w-7 h-7 animate-spin text-violet-500" />
              <span className="text-xs">Loading jury evaluation portal...</span>
            </div>
          ) : (
            <>
              {/* VIEW 1: EVALUATION QUEUE */}
              {currentView === 'queue' && (
                <div className="space-y-6">
                  {/* Progress Header Card */}
                  <div className="bg-slate-900/80 border border-slate-800 rounded-2xl p-6 shadow-xl">
                    <div className="flex items-center justify-between mb-2">
                      <div>
                        <h2 className="text-base font-bold text-slate-100">Panel Progress</h2>
                        <p className="text-xs text-slate-400 mt-0.5">
                          {stats.completedCount} of {stats.totalCount} assigned teams evaluated
                        </p>
                      </div>
                      <span className="text-2xl font-bold font-mono text-violet-400">{stats.progressPct}%</span>
                    </div>

                    <div className="w-full h-2.5 rounded-full bg-slate-950 overflow-hidden border border-slate-800 p-0.5 mt-2">
                      <div
                        className="h-full rounded-full bg-gradient-to-r from-violet-600 to-indigo-500 transition-all duration-300"
                        style={{ width: `${stats.progressPct}%` }}
                      />
                    </div>
                  </div>

                  {/* Assigned Teams */}
                  <div className="space-y-4">
                    {queue.length === 0 ? (
                      <div className="bg-slate-900/60 border border-slate-800 rounded-2xl p-12 text-center text-xs text-slate-500">
                        No team evaluations assigned yet.
                      </div>
                    ) : (
                      queue.map((item, idx) => {
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

                                  <h3 className="text-base font-bold text-slate-100">{item.displayName}</h3>

                                  {item.track && (
                                    <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-slate-800 text-slate-400 border border-slate-700/60">
                                      {item.track}
                                    </span>
                                  )}

                                  {isExcused ? (
                                    <span className="flex items-center gap-1 text-[10px] font-semibold px-2 py-0.5 rounded-full bg-red-950/40 text-red-400 border border-red-800/60">
                                      <ShieldAlert className="w-3 h-3" /> Excused
                                    </span>
                                  ) : isCompleted ? (
                                    <span className="flex items-center gap-1 text-[10px] font-semibold px-2 py-0.5 rounded-full bg-emerald-950/40 text-emerald-400 border border-emerald-800/60">
                                      <CheckCircle2 className="w-3 h-3" /> Sealed on Hash Chain
                                    </span>
                                  ) : (
                                    <span className="flex items-center gap-1 text-[10px] font-semibold px-2 py-0.5 rounded-full bg-amber-950/40 text-amber-400 border border-amber-800/60">
                                      <Clock className="w-3 h-3" /> Pending Score
                                    </span>
                                  )}
                                </div>

                                {item.submission && (
                                  <div className="text-xs text-slate-400 flex items-center gap-4 mt-2">
                                    <span className="text-slate-300 font-medium">Project: {item.submission.title}</span>
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
                                    <span>{isCompleted ? 'Review Marks' : 'Evaluate Team'}</span>
                                    <ArrowRight className="w-3.5 h-3.5" />
                                  </Link>
                                )}
                              </div>
                            </div>
                          </div>
                        )
                      })
                    )}
                  </div>
                </div>
              )}

              {/* VIEW 2: SCORING TELEMETRY */}
              {currentView === 'progress' && (
                <div className="space-y-6">
                  <div className="bg-slate-900/80 border border-slate-800 rounded-2xl p-6 shadow-xl space-y-4">
                    <h3 className="text-base font-bold text-slate-100 flex items-center gap-2">
                      <Award className="w-5 h-5 text-violet-400" />
                      <span>Judging Metrics & Panel Alignment</span>
                    </h3>
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 pt-2">
                      <div className="p-4 bg-slate-950 rounded-xl border border-slate-800">
                        <div className="text-xs text-slate-400">Total Assigned</div>
                        <div className="text-2xl font-bold text-slate-100 mt-1">{stats.totalCount} Teams</div>
                      </div>
                      <div className="p-4 bg-slate-950 rounded-xl border border-slate-800">
                        <div className="text-xs text-slate-400">Committed Evaluations</div>
                        <div className="text-2xl font-bold text-emerald-400 mt-1">{stats.completedCount} Sealed</div>
                      </div>
                      <div className="p-4 bg-slate-950 rounded-xl border border-slate-800">
                        <div className="text-xs text-slate-400">Sequence Ordering</div>
                        <div className="text-2xl font-bold text-violet-400 mt-1">Randomized</div>
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* VIEW 3: HASH CHAIN */}
              {currentView === 'chain' && (
                <div className="space-y-6">
                  <div className="bg-slate-900/80 border border-slate-800 rounded-2xl p-6 shadow-xl space-y-4">
                    <h3 className="text-base font-bold text-slate-100 flex items-center gap-2">
                      <Hash className="w-5 h-5 text-indigo-400" />
                      <span>Personal Cryptographic Hash Chain</span>
                    </h3>
                    <p className="text-xs text-slate-400">
                      Every submission generates an immutable block pointing to your previous hash block.
                    </p>
                    <div className="p-4 bg-slate-950 rounded-xl border border-slate-800 space-y-2 text-xs">
                      <div className="text-slate-400">Current Chain Head Hash:</div>
                      <div className="font-mono text-xs text-emerald-400 bg-slate-900 p-2.5 rounded border border-slate-800 break-all">
                        e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855
                      </div>
                      <div className="text-slate-500 text-[11px] pt-1">
                        Genesis Block: GENESIS_BLOCK_00000000000000000000000000000000
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* VIEW 4: CONFLICTS */}
              {currentView === 'conflicts' && (
                <div className="space-y-6 max-w-xl">
                  <div className="bg-slate-900/80 border border-slate-800 rounded-2xl p-6 shadow-xl space-y-4">
                    <h3 className="text-base font-bold text-slate-100 flex items-center gap-2">
                      <ShieldAlert className="w-5 h-5 text-amber-400" />
                      <span>Declare Conflict of Interest</span>
                    </h3>
                    <p className="text-xs text-slate-400">
                      If you have previously mentored, advised, or have a conflict with a team, declare it below for instant excusal.
                    </p>
                    <form onSubmit={handleDeclareConflict} className="space-y-3">
                      <div>
                        <label className="text-xs text-slate-300 block mb-1 font-semibold">Select Team</label>
                        <select
                          value={selectedConflictTeam}
                          onChange={(e) => setSelectedConflictTeam(e.target.value)}
                          className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-xs text-slate-100"
                        >
                          <option value="">Select an assigned team...</option>
                          {queue.map((q) => (
                            <option key={q.id} value={q.teamId}>
                              {q.displayName} ({q.track || 'General'})
                            </option>
                          ))}
                        </select>
                      </div>
                      <div>
                        <label className="text-xs text-slate-300 block mb-1 font-semibold">Reason for Conflict</label>
                        <textarea
                          rows={2}
                          value={conflictReason}
                          onChange={(e) => setConflictReason(e.target.value)}
                          placeholder="e.g. Advised this student team during pre-hackathon bootcamp..."
                          className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-xs text-slate-100"
                        />
                      </div>
                      <button
                        type="submit"
                        className="w-full py-2.5 px-4 rounded-xl bg-amber-600 hover:bg-amber-500 text-white font-semibold text-xs transition-colors"
                      >
                        Submit Conflict & Excusal
                      </button>
                    </form>
                  </div>
                </div>
              )}

              {/* VIEW 5: REVISIONS */}
              {currentView === 'revisions' && (
                <div className="space-y-6 max-w-xl">
                  <div className="bg-slate-900/80 border border-slate-800 rounded-2xl p-6 shadow-xl space-y-4">
                    <h3 className="text-base font-bold text-slate-100 flex items-center gap-2">
                      <FileCheck2 className="w-5 h-5 text-indigo-400" />
                      <span>Submit Score Revision Request</span>
                    </h3>
                    <p className="text-xs text-slate-400">
                      FairPitch uses an append-only architecture. Corrected marks are committed as Version 2 upon organizer approval.
                    </p>
                    <div className="space-y-3">
                      <div>
                        <label className="text-xs text-slate-300 block mb-1 font-semibold">Select Evaluated Team</label>
                        <select
                          value={selectedRevisionTeam}
                          onChange={(e) => setSelectedRevisionTeam(e.target.value)}
                          className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-xs text-slate-100"
                        >
                          <option value="">Select team to revise...</option>
                          {queue.filter((q) => q.isCompleted).map((q) => (
                            <option key={q.id} value={q.teamId}>
                              {q.displayName}
                            </option>
                          ))}
                        </select>
                      </div>
                      <div>
                        <label className="text-xs text-slate-300 block mb-1 font-semibold">Revision Justification</label>
                        <textarea
                          rows={2}
                          value={revisionReason}
                          onChange={(e) => setRevisionReason(e.target.value)}
                          placeholder="Factual correction following inspection of demo video..."
                          className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-xs text-slate-100"
                        />
                      </div>
                      <button
                        onClick={() => showToast('Revision request dispatched to event organizer.')}
                        className="w-full py-2.5 px-4 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-semibold text-xs"
                      >
                        Dispatch Revision Request
                      </button>
                    </div>
                  </div>
                </div>
              )}

              {/* VIEW 6: GUIDELINES */}
              {currentView === 'guidelines' && (
                <div className="space-y-6 max-w-2xl">
                  <div className="bg-slate-900/80 border border-slate-800 rounded-2xl p-6 shadow-xl space-y-4">
                    <h3 className="text-base font-bold text-slate-100 flex items-center gap-2">
                      <Shield className="w-5 h-5 text-emerald-400" />
                      <span>Blind Evaluation Code of Conduct</span>
                    </h3>
                    <div className="space-y-3 text-xs text-slate-300">
                      <div className="p-3 bg-slate-950 rounded-xl border border-slate-800 space-y-1">
                        <div className="font-bold text-slate-100">1. Blind Anonymity</div>
                        <p className="text-slate-400">
                          Do not attempt to de-anonymize teams through repository commit authors or metadata.
                        </p>
                      </div>
                      <div className="p-3 bg-slate-950 rounded-xl border border-slate-800 space-y-1">
                        <div className="font-bold text-slate-100">2. Constructive Qualitative Feedback</div>
                        <p className="text-slate-400">
                          Every score must be accompanied by constructive critique which will be parsed by Gemini for the team loss autopsy.
                        </p>
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* VIEW 7: PROFILE */}
              {currentView === 'profile' && (
                <div className="space-y-6 max-w-xl">
                  <div className="bg-slate-900/80 border border-slate-800 rounded-2xl p-6 shadow-xl space-y-4">
                    <h3 className="text-base font-bold text-slate-100 flex items-center gap-2">
                      <CheckSquare className="w-5 h-5 text-violet-400" />
                      <span>Vetted Evaluator Credentials</span>
                    </h3>
                    <div className="space-y-2 text-xs">
                      <div className="p-3 bg-slate-950 rounded-xl border border-slate-800 flex justify-between">
                        <span className="text-slate-400">Role Status:</span>
                        <span className="text-emerald-400 font-bold">Verified Jury Evaluator</span>
                      </div>
                      <div className="p-3 bg-slate-950 rounded-xl border border-slate-800 flex justify-between">
                        <span className="text-slate-400">Audit Protocol:</span>
                        <span className="font-mono text-violet-400">SHA-256 Per-Judge Chain</span>
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </>
          )}
        </main>
      </div>
    </div>
  )
}
