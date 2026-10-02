'use client'

import React, { useEffect, useState, use } from 'react'
import Link from 'next/link'
import {
  ArrowLeft,
  MessageSquare,
  CheckCircle2,
  Clock,
  AlertCircle,
  HelpCircle,
  Loader2,
  RefreshCw,
  Search,
  Filter,
  Check,
  Send,
  User,
  Users,
} from 'lucide-react'

export default function OrganizerTicketsPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id: eventId } = use(params)

  const [loading, setLoading] = useState(true)
  const [tickets, setTickets] = useState<any[]>([])
  const [filter, setFilter] = useState<'all' | 'open' | 'under_review' | 'resolved'>('all')
  const [selectedTicket, setSelectedTicket] = useState<any | null>(null)
  const [resolutionStatus, setResolutionStatus] = useState<'open' | 'under_review' | 'resolved'>('resolved')
  const [resolutionNotes, setResolutionNotes] = useState('')
  const [updating, setUpdating] = useState(false)
  const [notification, setNotification] = useState<{ type: 'success' | 'error'; text: string } | null>(null)

  async function loadTickets() {
    setLoading(true)
    try {
      const res = await fetch(`/api/org/events/${eventId}/tickets`)
      const data = await res.json()
      if (res.ok && data.success) {
        setTickets(data.tickets || [])
      } else {
        setNotification({ type: 'error', text: data.error || 'Failed to load dispute tickets' })
      }
    } catch {
      setNotification({ type: 'error', text: 'Network connection error' })
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadTickets()
  }, [eventId])

  async function handleUpdateTicket(e: React.FormEvent) {
    e.preventDefault()
    if (!selectedTicket) return

    setUpdating(true)
    try {
      const res = await fetch(`/api/org/events/${eventId}/tickets/${selectedTicket.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          status: resolutionStatus,
          resolutionNotes: resolutionNotes.trim(),
        }),
      })

      const data = await res.json()
      if (res.ok && data.success) {
        setNotification({ type: 'success', text: `Ticket marked as ${resolutionStatus}` })
        setSelectedTicket(null)
        setResolutionNotes('')
        await loadTickets()
      } else {
        setNotification({ type: 'error', text: data.error || 'Failed to update ticket' })
      }
    } catch {
      setNotification({ type: 'error', text: 'Network error updating ticket' })
    } finally {
      setUpdating(false)
    }
  }

  const filteredTickets = tickets.filter((t) => {
    if (filter === 'all') return true
    return t.status === filter
  })

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-950 flex items-center justify-center text-slate-500">
        <Loader2 className="w-8 h-8 animate-spin text-indigo-500" />
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col">
      {/* Top Header */}
      <header className="border-b border-slate-800 bg-slate-900/60 backdrop-blur-md px-6 py-4 flex items-center justify-between sticky top-0 z-20">
        <div className="flex items-center gap-3">
          <Link
            href={`/org/events/${eventId}`}
            className="p-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-slate-100 transition-colors"
          >
            <ArrowLeft className="w-4 h-4" />
          </Link>
          <div>
            <div className="flex items-center gap-2">
              <span className="text-xs font-semibold text-indigo-400 uppercase tracking-wider">
                Event Disputes
              </span>
              <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-indigo-950/60 text-indigo-400 border border-indigo-800/40">
                Dispute Desk
              </span>
            </div>
            <h1 className="text-lg font-bold text-slate-100">
              Review Inquiries & Dispute Resolution
            </h1>
          </div>
        </div>

        <button
          onClick={loadTickets}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-medium transition-colors"
        >
          <RefreshCw className="w-3.5 h-3.5" />
          <span>Refresh</span>
        </button>
      </header>

      {/* Main Content */}
      <main className="flex-1 max-w-6xl w-full mx-auto p-6 space-y-6">
        {notification && (
          <div
            className={`p-4 rounded-xl border flex items-center justify-between text-xs ${
              notification.type === 'success'
                ? 'bg-emerald-950/40 border-emerald-800 text-emerald-300'
                : 'bg-rose-950/40 border-rose-800 text-rose-300'
            }`}
          >
            <span>{notification.text}</span>
            <button onClick={() => setNotification(null)} className="text-slate-400 hover:text-white">
              &times;
            </button>
          </div>
        )}

        {/* Filter Bar */}
        <div className="flex items-center justify-between gap-4 border-b border-slate-800 pb-4">
          <div className="flex items-center gap-2">
            {(['all', 'open', 'under_review', 'resolved'] as const).map((st) => (
              <button
                key={st}
                onClick={() => setFilter(st)}
                className={`px-3 py-1.5 rounded-xl text-xs font-semibold capitalize transition-all ${
                  filter === st
                    ? 'bg-indigo-600 text-white shadow-md shadow-indigo-600/20'
                    : 'bg-slate-900 border border-slate-800 text-slate-400 hover:text-slate-200'
                }`}
              >
                {st.replace('_', ' ')} (
                {st === 'all'
                  ? tickets.length
                  : tickets.filter((t) => t.status === st).length}
                )
              </button>
            ))}
          </div>

          <span className="text-xs text-slate-500">
            {filteredTickets.length} Inquiries Showing
          </span>
        </div>

        {/* Tickets Grid */}
        {filteredTickets.length === 0 ? (
          <div className="bg-slate-900/60 border border-slate-800 rounded-2xl p-12 text-center text-slate-400 space-y-2">
            <MessageSquare className="w-8 h-8 text-slate-600 mx-auto" />
            <h3 className="text-sm font-semibold text-slate-300">No Review Inquiries Found</h3>
            <p className="text-xs text-slate-500">
              No participants have submitted dispute or clarification inquiries for this filter.
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-4">
            {filteredTickets.map((t) => (
              <div
                key={t.id}
                className="bg-slate-900/80 border border-slate-800 rounded-2xl p-5 shadow-lg flex flex-col justify-between space-y-4"
              >
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                  <div className="flex items-center gap-3">
                    <span
                      className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase ${
                        t.status === 'resolved'
                          ? 'bg-emerald-950/60 text-emerald-400 border border-emerald-800/40'
                          : t.status === 'under_review'
                          ? 'bg-indigo-950/60 text-indigo-400 border border-indigo-800/40'
                          : 'bg-amber-950/60 text-amber-400 border border-amber-800/40'
                      }`}
                    >
                      {t.status.replace('_', ' ')}
                    </span>
                    <span className="font-bold text-sm text-slate-100">
                      Team: {t.teams?.name || 'Participant Team'}
                    </span>
                    <span className="text-[10px] text-slate-500 font-mono">
                      #{t.teams?.team_code}
                    </span>
                  </div>

                  <span className="text-[11px] text-slate-500">
                    Submitted: {new Date(t.created_at).toLocaleString()}
                  </span>
                </div>

                <div className="bg-slate-950 p-4 rounded-xl border border-slate-800/80 text-xs space-y-2">
                  <span className="text-[10px] uppercase font-bold text-slate-500 block">
                    Participant Dispute Details:
                  </span>
                  <p className="text-slate-200 leading-relaxed whitespace-pre-wrap">
                    "{t.reason}"
                  </p>
                  <div className="flex items-center gap-2 text-[10px] text-slate-400 pt-2 border-t border-slate-800/60">
                    <User className="w-3 h-3 text-slate-500" />
                    <span>Submitted by {t.submitter?.full_name || t.submitter?.email || 'Student'}</span>
                  </div>
                </div>

                {t.resolution_notes && (
                  <div className="bg-indigo-950/20 p-4 rounded-xl border border-indigo-900/40 text-xs space-y-1">
                    <span className="text-[10px] uppercase font-bold text-indigo-400 block">
                      Organizer Response & Resolution:
                    </span>
                    <p className="text-slate-300 leading-relaxed">
                      {t.resolution_notes}
                    </p>
                    {t.resolver && (
                      <span className="text-[10px] text-slate-500 block pt-1">
                        Resolved by {t.resolver.full_name} on {new Date(t.resolved_at).toLocaleString()}
                      </span>
                    )}
                  </div>
                )}

                <div className="flex items-center justify-end gap-3 pt-2 border-t border-slate-800/60">
                  <button
                    onClick={() => {
                      setSelectedTicket(t)
                      setResolutionStatus(t.status === 'open' ? 'under_review' : t.status)
                      setResolutionNotes(t.resolution_notes || '')
                    }}
                    className="px-4 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-xs font-semibold text-slate-200 transition-colors"
                  >
                    {t.status === 'resolved' ? 'Edit Response' : 'Review & Respond'}
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </main>

      {/* Resolution Modal */}
      {selectedTicket && (
        <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl max-w-lg w-full p-6 shadow-2xl space-y-4">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <h3 className="text-base font-bold text-slate-100">
                Respond to Inquiry: {selectedTicket.teams?.name}
              </h3>
              <button
                onClick={() => setSelectedTicket(null)}
                className="text-slate-400 hover:text-white text-lg"
              >
                &times;
              </button>
            </div>

            <div className="p-3 rounded-xl bg-slate-950 border border-slate-800 text-xs text-slate-300">
              <span className="text-[10px] text-slate-500 uppercase block mb-1">
                Participant Inquiry:
              </span>
              "{selectedTicket.reason}"
            </div>

            <form onSubmit={handleUpdateTicket} className="space-y-4">
              <div>
                <label className="text-xs font-semibold text-slate-300 block mb-1">
                  Ticket Status
                </label>
                <div className="grid grid-cols-3 gap-2">
                  {(['open', 'under_review', 'resolved'] as const).map((st) => (
                    <button
                      key={st}
                      type="button"
                      onClick={() => setResolutionStatus(st)}
                      className={`py-2 px-3 rounded-xl text-xs font-semibold capitalize border transition-all ${
                        resolutionStatus === st
                          ? 'bg-indigo-600 border-indigo-500 text-white'
                          : 'bg-slate-950 border-slate-800 text-slate-400 hover:text-slate-200'
                      }`}
                    >
                      {st.replace('_', ' ')}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label className="text-xs font-semibold text-slate-300 block mb-1">
                  Official Response to Team
                </label>
                <textarea
                  value={resolutionNotes}
                  onChange={(e) => setResolutionNotes(e.target.value)}
                  placeholder="Explain the organizer decision, scoring audit findings, or clarification..."
                  rows={4}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl p-3 text-xs text-slate-100 focus:outline-hidden focus:border-indigo-500 resize-none"
                />
              </div>

              <div className="flex items-center justify-end gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setSelectedTicket(null)}
                  className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-xs text-slate-300 font-semibold rounded-xl transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={updating}
                  className="flex items-center gap-2 px-5 py-2 bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-semibold rounded-xl shadow-lg shadow-indigo-600/20 disabled:opacity-50 transition-colors"
                >
                  {updating ? (
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  ) : (
                    <Check className="w-3.5 h-3.5" />
                  )}
                  <span>Save Decision</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
