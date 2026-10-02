'use client'

import React, { useState, useEffect } from 'react'
import { useParams } from 'next/navigation'
import Link from 'next/link'
import {
  Trophy,
  Medal,
  Award,
  ShieldCheck,
  Search,
  ExternalLink,
  ArrowLeft,
  Sparkles,
  Share2,
  Check,
  Layers,
  Clock,
  ChevronRight,
} from 'lucide-react'

interface Criterion {
  id: string
  name: string
  weight: number
  max_score: number
}

interface LeaderboardEntry {
  teamId: string
  teamName: string
  tagline?: string
  rank: number
  totalWeightedScore: number
  rawAverageScore: number
  criterionBreakdown: Record<string, number>
}

interface EventData {
  id: string
  title: string
  slug: string
  status: string
  anchored_merkle_root: string | null
  anchored_at: string | null
}

export default function PublicEventResultsPage() {
  const params = useParams()
  const eventId = params.id as string

  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [event, setEvent] = useState<EventData | null>(null)
  const [leaderboard, setLeaderboard] = useState<LeaderboardEntry[]>([])
  const [criteria, setCriteria] = useState<Criterion[]>([])
  const [podium, setPodium] = useState<LeaderboardEntry[]>([])
  const [searchFilter, setSearchFilter] = useState('')
  const [copiedShare, setCopiedShare] = useState(false)

  useEffect(() => {
    async function fetchResults() {
      setLoading(true)
      setError(null)
      try {
        const res = await fetch(`/api/public/events/${eventId}/results`)
        const data = await res.json()

        if (!res.ok) {
          throw new Error(data.error || 'Failed to load official results.')
        }

        setEvent(data.event)
        setLeaderboard(data.leaderboard || [])
        setCriteria(data.criteria || [])
        setPodium(data.podium || [])
      } catch (err: any) {
        setError(err.message || 'An error occurred while loading results.')
      } finally {
        setLoading(false)
      }
    }

    if (eventId) {
      fetchResults()
    }
  }, [eventId])

  function handleShare() {
    if (typeof window !== 'undefined') {
      navigator.clipboard.writeText(window.location.href)
      setCopiedShare(true)
      setTimeout(() => setCopiedShare(false), 2000)
    }
  }

  const filteredLeaderboard = leaderboard.filter((item) =>
    item.teamName.toLowerCase().includes(searchFilter.toLowerCase())
  )

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-950 text-slate-100 flex items-center justify-center p-6">
        <div className="flex flex-col items-center gap-4 text-center max-w-sm">
          <div className="w-16 h-16 rounded-2xl bg-indigo-600/20 border border-indigo-500/30 flex items-center justify-center text-indigo-400 animate-pulse">
            <Trophy className="w-8 h-8 text-amber-400" />
          </div>
          <h2 className="text-base font-bold text-slate-200">
            Compiling Official Leaderboard...
          </h2>
          <p className="text-xs text-slate-400">
            Aggregating peer-reviewed jury scores and criterion weightings...
          </p>
        </div>
      </div>
    )
  }

  if (error || !event) {
    return (
      <div className="min-h-screen bg-slate-950 text-slate-100 flex items-center justify-center p-6">
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-8 max-w-md w-full text-center space-y-4 shadow-2xl">
          <div className="w-14 h-14 rounded-2xl bg-amber-500/10 border border-amber-500/30 flex items-center justify-center mx-auto text-amber-400">
            <Clock className="w-7 h-7" />
          </div>
          <h2 className="text-lg font-bold text-slate-100">Leaderboard Unavailable</h2>
          <p className="text-xs text-slate-400">
            {error || 'The official results for this event are not yet published.'}
          </p>
          <div className="pt-2">
            <Link
              href="/verify"
              className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-xs font-semibold text-slate-300 transition-colors inline-block"
            >
              Back to Verify Portal
            </Link>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col">
      {/* Top Header */}
      <header className="border-b border-slate-800 bg-slate-900/70 backdrop-blur-md px-6 py-4 flex items-center justify-between sticky top-0 z-30">
        <div className="flex items-center gap-4">
          <Link
            href="/verify"
            className="p-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-slate-200 transition-colors"
            title="Public Verification Ledger"
          >
            <ArrowLeft className="w-4 h-4" />
          </Link>
          <div>
            <div className="flex items-center gap-2">
              <span className="text-sm font-bold text-slate-100">Official Results</span>
              <span className="text-slate-600">/</span>
              <span className="text-xs font-semibold text-indigo-400 truncate max-w-xs">
                {event.title}
              </span>
            </div>
            <p className="text-[11px] text-slate-400">
              Published on {event.anchored_at ? new Date(event.anchored_at).toLocaleDateString() : 'N/A'}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={handleShare}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-semibold transition-colors cursor-pointer"
          >
            {copiedShare ? (
              <>
                <Check className="w-3.5 h-3.5 text-emerald-400" />
                <span className="text-emerald-400">Link Copied!</span>
              </>
            ) : (
              <>
                <Share2 className="w-3.5 h-3.5 text-slate-400" />
                <span>Share</span>
              </>
            )}
          </button>

          <Link
            href={`/verify/${event.id}`}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 text-xs font-semibold transition-colors"
          >
            <ShieldCheck className="w-4 h-4" />
            <span>Verify Merkle Proof</span>
          </Link>
        </div>
      </header>

      {/* Main Content */}
      <main className="flex-1 max-w-5xl w-full mx-auto px-6 py-8 space-y-10">
        {/* Banner */}
        <div className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-indigo-950/60 via-slate-900 to-slate-950 border border-indigo-900/40 p-8 shadow-2xl text-center space-y-3">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-indigo-500/10 border border-indigo-500/20 text-indigo-400 text-xs font-bold uppercase tracking-wider mb-1">
            <Sparkles className="w-3.5 h-3.5 text-amber-400" />
            Official Certified Standings
          </div>
          <h1 className="text-2xl sm:text-3xl font-extrabold text-slate-100 tracking-tight">
            {event.title}
          </h1>
          <p className="text-xs text-slate-400 max-w-xl mx-auto leading-relaxed">
            All scores have been audited under advisory locks and anchored into an immutable cryptographic Merkle root. No scores can be altered post-publication.
          </p>
        </div>

        {/* Podium View (Top 3) */}
        {podium.length > 0 && (
          <div className="space-y-4">
            <div className="text-center">
              <h2 className="text-base font-bold text-slate-100">Top Honors Podium</h2>
              <p className="text-xs text-slate-400">Awarded according to weighted composite criteria</p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 pt-4 items-end">
              {/* 2nd Place */}
              {podium[1] && (
                <div className="order-2 md:order-1 bg-slate-900/90 border border-slate-700/60 rounded-2xl p-6 text-center space-y-3 relative shadow-xl hover:border-slate-500 transition-all">
                  <div className="w-12 h-12 rounded-full bg-slate-800 border-2 border-slate-400 flex items-center justify-center mx-auto text-slate-300 font-bold text-lg shadow-md">
                    <Medal className="w-6 h-6 text-slate-300" />
                  </div>
                  <div>
                    <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400">
                      2nd Place / Silver
                    </span>
                    <h3 className="text-lg font-bold text-slate-100 truncate mt-1">
                      {podium[1].teamName}
                    </h3>
                    {podium[1].tagline && (
                      <p className="text-[11px] text-slate-400 truncate mt-0.5">
                        {podium[1].tagline}
                      </p>
                    )}
                  </div>
                  <div className="pt-2 border-t border-slate-800">
                    <div className="text-2xl font-black text-slate-200">
                      {podium[1].totalWeightedScore.toFixed(1)}
                    </div>
                    <span className="text-[10px] text-slate-500 uppercase tracking-wider">
                      Composite Score
                    </span>
                  </div>
                  <Link
                    href={`/team/${podium[1].teamId}/autopsy`}
                    className="inline-flex items-center gap-1 text-[11px] text-indigo-400 hover:text-indigo-300 font-semibold"
                  >
                    <span>View AI Autopsy</span>
                    <ChevronRight className="w-3 h-3" />
                  </Link>
                </div>
              )}

              {/* 1st Place */}
              {podium[0] && (
                <div className="order-1 md:order-2 bg-gradient-to-b from-amber-950/40 via-slate-900 to-slate-900 border-2 border-amber-500/50 rounded-2xl p-7 text-center space-y-4 relative shadow-2xl scale-105 z-10">
                  <div className="absolute -top-3 left-1/2 -translate-x-1/2 px-3 py-0.5 rounded-full bg-amber-500 text-slate-950 text-[10px] font-black uppercase tracking-wider shadow-lg">
                    Winner
                  </div>
                  <div className="w-16 h-16 rounded-full bg-amber-500/20 border-2 border-amber-400 flex items-center justify-center mx-auto text-amber-300 shadow-amber-500/20 shadow-lg">
                    <Trophy className="w-8 h-8 text-amber-400 animate-bounce" />
                  </div>
                  <div>
                    <span className="text-xs font-bold uppercase tracking-wider text-amber-400">
                      1st Place / Champion
                    </span>
                    <h3 className="text-xl font-extrabold text-slate-100 truncate mt-1">
                      {podium[0].teamName}
                    </h3>
                    {podium[0].tagline && (
                      <p className="text-xs text-slate-400 truncate mt-0.5">
                        {podium[0].tagline}
                      </p>
                    )}
                  </div>
                  <div className="pt-2 border-t border-slate-800">
                    <div className="text-3xl font-black text-amber-400">
                      {podium[0].totalWeightedScore.toFixed(1)}
                    </div>
                    <span className="text-[10px] text-slate-500 uppercase tracking-wider">
                      Composite Score
                    </span>
                  </div>
                  <Link
                    href={`/team/${podium[0].teamId}/autopsy`}
                    className="inline-flex items-center gap-1 text-xs text-amber-400 hover:text-amber-300 font-semibold"
                  >
                    <span>View Benchmark Autopsy</span>
                    <ChevronRight className="w-3.5 h-3.5" />
                  </Link>
                </div>
              )}

              {/* 3rd Place */}
              {podium[2] && (
                <div className="order-3 bg-slate-900/90 border border-slate-700/60 rounded-2xl p-6 text-center space-y-3 relative shadow-xl hover:border-slate-500 transition-all">
                  <div className="w-12 h-12 rounded-full bg-slate-800 border-2 border-amber-700 flex items-center justify-center mx-auto text-amber-600 font-bold text-lg shadow-md">
                    <Award className="w-6 h-6 text-amber-600" />
                  </div>
                  <div>
                    <span className="text-[11px] font-bold uppercase tracking-wider text-amber-600">
                      3rd Place / Bronze
                    </span>
                    <h3 className="text-lg font-bold text-slate-100 truncate mt-1">
                      {podium[2].teamName}
                    </h3>
                    {podium[2].tagline && (
                      <p className="text-[11px] text-slate-400 truncate mt-0.5">
                        {podium[2].tagline}
                      </p>
                    )}
                  </div>
                  <div className="pt-2 border-t border-slate-800">
                    <div className="text-2xl font-black text-slate-200">
                      {podium[2].totalWeightedScore.toFixed(1)}
                    </div>
                    <span className="text-[10px] text-slate-500 uppercase tracking-wider">
                      Composite Score
                    </span>
                  </div>
                  <Link
                    href={`/team/${podium[2].teamId}/autopsy`}
                    className="inline-flex items-center gap-1 text-[11px] text-indigo-400 hover:text-indigo-300 font-semibold"
                  >
                    <span>View AI Autopsy</span>
                    <ChevronRight className="w-3 h-3" />
                  </Link>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Full Leaderboard Table */}
        <div className="space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div>
              <h2 className="text-base font-bold text-slate-100">
                Official Ranked Standings ({leaderboard.length} Teams)
              </h2>
              <p className="text-xs text-slate-400">
                Sorted by final composite score across all evaluated criteria
              </p>
            </div>

            <div className="relative w-full sm:w-64">
              <Search className="w-4 h-4 text-slate-500 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                placeholder="Search team name..."
                value={searchFilter}
                onChange={(e) => setSearchFilter(e.target.value)}
                className="w-full pl-9 pr-3 py-1.5 bg-slate-900 border border-slate-800 rounded-xl text-xs text-slate-100 placeholder-slate-500 focus:outline-hidden focus:border-indigo-500"
              />
            </div>
          </div>

          <div className="bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden shadow-xl">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs text-slate-300">
                <thead className="bg-slate-950/60 border-b border-slate-800 text-[11px] uppercase tracking-wider text-slate-400">
                  <tr>
                    <th className="py-3.5 px-4 font-bold">Rank</th>
                    <th className="py-3.5 px-4 font-bold">Team</th>
                    <th className="py-3.5 px-4 font-bold text-right">Composite Score</th>
                    <th className="py-3.5 px-4 font-bold text-right">Raw Avg</th>
                    {criteria.map((c) => (
                      <th key={c.id} className="py-3.5 px-3 font-semibold text-right text-slate-400 hidden lg:table-cell">
                        {c.name} ({c.weight}%)
                      </th>
                    ))}
                    <th className="py-3.5 px-4 font-bold text-center">Analysis</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/60 font-medium">
                  {filteredLeaderboard.map((team) => (
                    <tr
                      key={team.teamId}
                      className="hover:bg-slate-800/40 transition-colors group"
                    >
                      <td className="py-3 px-4 font-mono font-bold">
                        {team.rank === 1 ? (
                          <span className="inline-flex items-center justify-center w-6 h-6 rounded-full bg-amber-500/20 text-amber-400 border border-amber-500/40 text-xs">
                            1
                          </span>
                        ) : team.rank === 2 ? (
                          <span className="inline-flex items-center justify-center w-6 h-6 rounded-full bg-slate-300/20 text-slate-300 border border-slate-300/40 text-xs">
                            2
                          </span>
                        ) : team.rank === 3 ? (
                          <span className="inline-flex items-center justify-center w-6 h-6 rounded-full bg-amber-700/20 text-amber-500 border border-amber-700/40 text-xs">
                            3
                          </span>
                        ) : (
                          <span className="text-slate-500 pl-1.5">#{team.rank}</span>
                        )}
                      </td>
                      <td className="py-3 px-4">
                        <div className="font-bold text-slate-100 group-hover:text-indigo-400 transition-colors">
                          {team.teamName}
                        </div>
                        {team.tagline && (
                          <div className="text-[11px] text-slate-500 truncate max-w-xs">
                            {team.tagline}
                          </div>
                        )}
                      </td>
                      <td className="py-3 px-4 text-right font-mono font-bold text-slate-100 text-sm">
                        {team.totalWeightedScore.toFixed(2)}
                      </td>
                      <td className="py-3 px-4 text-right font-mono text-slate-400 text-xs">
                        {team.rawAverageScore.toFixed(2)}
                      </td>
                      {criteria.map((c) => (
                        <td
                          key={c.id}
                          className="py-3 px-3 text-right font-mono text-slate-400 hidden lg:table-cell"
                        >
                          {team.criterionBreakdown[c.id] !== undefined
                            ? team.criterionBreakdown[c.id].toFixed(1)
                            : '-'}
                        </td>
                      ))}
                      <td className="py-3 px-4 text-center">
                        <Link
                          href={`/team/${team.teamId}/autopsy`}
                          className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-indigo-500/10 hover:bg-indigo-500/20 text-indigo-400 border border-indigo-500/30 text-[11px] font-semibold transition-colors"
                        >
                          <span>Autopsy</span>
                          <ExternalLink className="w-3 h-3" />
                        </Link>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>

        {/* Cryptographic Ledger Callout Footer */}
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="p-3 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 shrink-0">
              <ShieldCheck className="w-6 h-6" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-slate-100">
                Tamper-Evident SHA-256 Ledger
              </h3>
              <p className="text-xs text-slate-400">
                Root: <span className="font-mono text-slate-300">{event.anchored_merkle_root?.slice(0, 24)}...</span>
              </p>
            </div>
          </div>

          <Link
            href={`/verify/${event.id}`}
            className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold transition-colors shrink-0"
          >
            <span>Audit Merkle Proof</span>
            <ChevronRight className="w-3.5 h-3.5 text-indigo-400" />
          </Link>
        </div>
      </main>
    </div>
  )
}
