'use client'

import React, { useEffect, useState, use } from 'react'
import Link from 'next/link'
import {
  Users,
  ArrowLeft,
  CheckCircle2,
  XCircle,
  ExternalLink,
  GitBranch,
  Loader2,
  AlertCircle,
  Tag
} from 'lucide-react'

export default function EventTeamsManagerPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = use(params)

  const [teams, setTeams] = useState<any[]>([])
  const [eventTitle, setEventTitle] = useState('')
  const [loading, setLoading] = useState(true)
  const [actionLoading, setActionLoading] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  async function fetchTeams() {
    try {
      const res = await fetch(`/api/events/${id}/teams`)
      if (res.ok) {
        const data = await res.json()
        setTeams(data.teams || [])
      }

      const eventRes = await fetch(`/api/events/${id}`)
      if (eventRes.ok) {
        const ev = await eventRes.json()
        setEventTitle(ev.event.title)
      }
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchTeams()
  }, [id])

  async function handleUpdateStatus(teamId: string, status: 'approved' | 'rejected') {
    setActionLoading(teamId)
    setError(null)

    try {
      const res = await fetch(`/api/events/${id}/teams/${teamId}/approve`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status }),
      })

      const data = await res.json()
      if (!res.ok) {
        throw new Error(data.error || 'Failed to update team status')
      }

      await fetchTeams()
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
          <div className="h-9 w-9 rounded-lg bg-blue-600 flex items-center justify-center text-white shadow-md shadow-blue-600/30">
            <Users className="w-5 h-5" />
          </div>
          <div>
            <h1 className="text-sm font-bold text-slate-100 flex items-center gap-2">
              Participating Teams & Submissions
            </h1>
            <p className="text-[11px] text-slate-400">{eventTitle || 'Event Teams Roster'}</p>
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

        <div className="flex items-center justify-between mb-6">
          <div>
            <h2 className="text-base font-bold text-slate-100">
              Registered Teams ({teams.length})
            </h2>
            <p className="text-xs text-slate-400 mt-0.5">
              Review project repo/demo links and approve teams into the scoring matrix.
            </p>
          </div>
        </div>

        {loading ? (
          <div className="py-20 flex flex-col items-center justify-center gap-2 text-slate-500">
            <Loader2 className="w-7 h-7 animate-spin text-indigo-500" />
            <span className="text-xs">Loading team roster...</span>
          </div>
        ) : teams.length === 0 ? (
          <div className="bg-slate-900/60 border border-slate-800 rounded-2xl p-12 text-center text-xs text-slate-500">
            No teams registered for this event yet. Participants can register using the event link or join via team codes.
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {teams.map((team) => (
              <div
                key={team.id}
                className="bg-slate-900/80 border border-slate-800 rounded-2xl p-6 shadow-xl flex flex-col justify-between"
              >
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <span className="font-mono text-xs font-bold text-indigo-400 px-2 py-0.5 rounded-md bg-indigo-950/50 border border-indigo-800/60">
                      {team.team_code}
                    </span>

                    <span
                      className={`px-2 py-0.5 rounded-full text-[10px] font-bold border ${
                        team.status === 'approved'
                          ? 'bg-emerald-950/40 text-emerald-400 border-emerald-800/60'
                          : team.status === 'pending'
                          ? 'bg-amber-950/40 text-amber-400 border-amber-800/60'
                          : 'bg-red-950/40 text-red-400 border-red-800/60'
                      }`}
                    >
                      {team.status}
                    </span>
                  </div>

                  <h3 className="text-base font-bold text-slate-100">{team.name}</h3>

                  {team.tagline && (
                    <p className="text-xs text-slate-400 mt-0.5 italic">{team.tagline}</p>
                  )}

                  {team.track && (
                    <div className="mt-2 flex items-center gap-1.5 text-[11px] text-slate-400">
                      <Tag className="w-3 h-3 text-slate-500" />
                      <span>Track: <strong>{team.track}</strong></span>
                    </div>
                  )}

                  {/* Submission status */}
                  <div className="mt-4 p-3 rounded-xl bg-slate-950 border border-slate-800 text-xs">
                    {team.submission ? (
                      <div>
                        <span className="font-semibold text-slate-200 block mb-1">
                          Submission: {team.submission.title}
                        </span>
                        <div className="flex items-center gap-3 text-[11px]">
                          {team.submission.repo_url && (
                            <a
                              href={team.submission.repo_url}
                              target="_blank"
                              rel="noreferrer"
                              className="text-indigo-400 hover:text-indigo-300 flex items-center gap-1"
                            >
                              <GitBranch className="w-3.5 h-3.5" />
                              <span>Repository</span>
                            </a>
                          )}
                          {team.submission.demo_url && (
                            <a
                              href={team.submission.demo_url}
                              target="_blank"
                              rel="noreferrer"
                              className="text-emerald-400 hover:text-emerald-300 flex items-center gap-1"
                            >
                              <ExternalLink className="w-3.5 h-3.5" />
                              <span>Live Demo</span>
                            </a>
                          )}
                        </div>
                      </div>
                    ) : (
                      <span className="text-slate-500 text-[11px]">
                        No project submission received yet
                      </span>
                    )}
                  </div>
                </div>

                <div className="mt-5 pt-4 border-t border-slate-800 flex items-center justify-between">
                  <span className="text-[11px] text-slate-500">
                    {team.memberCount || 1} team member{team.memberCount === 1 ? '' : 's'}
                  </span>

                  <div className="space-x-2">
                    {team.status === 'pending' && (
                      <>
                        <button
                          onClick={() => handleUpdateStatus(team.id, 'approved')}
                          disabled={actionLoading === team.id}
                          className="px-3 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white font-semibold text-xs transition-colors cursor-pointer"
                        >
                          Approve Team
                        </button>
                        <button
                          onClick={() => handleUpdateStatus(team.id, 'rejected')}
                          disabled={actionLoading === team.id}
                          className="px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-red-950/60 text-red-300 font-semibold text-xs transition-colors cursor-pointer"
                        >
                          Decline
                        </button>
                      </>
                    )}
                    {team.status === 'approved' && (
                      <button
                        onClick={() => handleUpdateStatus(team.id, 'rejected')}
                        disabled={actionLoading === team.id}
                        className="px-2.5 py-1 rounded-lg bg-slate-800 hover:bg-red-950/60 text-slate-400 hover:text-red-300 text-xs transition-colors cursor-pointer"
                      >
                        Revoke Approval
                      </button>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </main>
    </div>
  )
}
