'use client'

import React, { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import {
  CalendarCheck,
  Plus,
  LogOut,
  CheckCircle2,
  Clock,
  ChevronRight,
  Shield,
  Loader2,
  AlertTriangle,
  Building2
} from 'lucide-react'
import type { Event } from '@/lib/events/types'

export default function OrganizerDashboardPage() {
  const router = useRouter()
  const [events, setEvents] = useState<Event[]>([])
  const [loading, setLoading] = useState(true)

  async function fetchEvents() {
    try {
      const res = await fetch('/api/events')
      if (res.ok) {
        const data = await res.json()
        setEvents(data.events || [])
      }
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchEvents()
  }, [])

  async function handleSignOut() {
    await fetch('/api/auth/logout', { method: 'POST' })
    router.push('/login')
  }

  const statusColors: Record<string, { bg: string; text: string; border: string }> = {
    draft: { bg: 'bg-slate-900', text: 'text-slate-400', border: 'border-slate-800' },
    open: { bg: 'bg-blue-950/40', text: 'text-blue-400', border: 'border-blue-800/60' },
    judging: { bg: 'bg-amber-950/40', text: 'text-amber-400', border: 'border-amber-800/60' },
    review: { bg: 'bg-purple-950/40', text: 'text-purple-400', border: 'border-purple-800/60' },
    published: { bg: 'bg-emerald-950/40', text: 'text-emerald-400', border: 'border-emerald-800/60' },
  }

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col">
      {/* Header */}
      <header className="border-b border-slate-800 bg-slate-900/60 backdrop-blur-md px-6 py-4 flex items-center justify-between sticky top-0 z-20">
        <div className="flex items-center gap-3">
          <div className="h-9 w-9 rounded-lg bg-emerald-600 flex items-center justify-center text-white shadow-md shadow-emerald-600/30">
            <CalendarCheck className="w-5 h-5" />
          </div>
          <div>
            <h1 className="text-sm font-bold text-slate-100 flex items-center gap-2">
              Organizer Workspace
              <span className="text-[10px] px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-400 font-semibold border border-emerald-500/30 flex items-center gap-1">
                <CheckCircle2 className="w-3 h-3" />
                Active Organizer
              </span>
            </h1>
            <p className="text-[11px] text-slate-400">FairPitch Event Lifecycle & Rubric Control</p>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <Link
            href="/admin"
            className="text-xs px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 transition-colors"
          >
            Admin View
          </Link>
          <button
            onClick={handleSignOut}
            className="flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-lg bg-red-950/40 hover:bg-red-950/80 text-red-400 border border-red-900/50 transition-colors cursor-pointer"
          >
            <LogOut className="w-3.5 h-3.5" />
            <span>Sign Out</span>
          </button>
        </div>
      </header>

      {/* Main Container */}
      <main className="flex-1 max-w-6xl w-full mx-auto px-6 py-8">
        <div className="flex items-center justify-between mb-8">
          <div>
            <h2 className="text-xl font-bold text-slate-100">Your Hackathons & Events</h2>
            <p className="text-xs text-slate-400 mt-0.5">
              Manage evaluation rubrics, team rosters, and transition events through their auditable lifecycle.
            </p>
          </div>

          <Link
            href="/org/events/new"
            className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-gradient-to-r from-indigo-600 to-violet-600 hover:from-indigo-500 hover:to-violet-500 text-white font-semibold text-xs shadow-lg shadow-indigo-600/30 transition-all cursor-pointer"
          >
            <Plus className="w-4 h-4" />
            <span>Create New Event</span>
          </Link>
        </div>

        {loading ? (
          <div className="py-20 flex flex-col items-center justify-center gap-3 text-slate-500">
            <Loader2 className="w-7 h-7 animate-spin text-indigo-500" />
            <span className="text-xs">Loading institution events...</span>
          </div>
        ) : events.length === 0 ? (
          <div className="bg-slate-900/60 border border-slate-800 rounded-2xl p-12 text-center max-w-lg mx-auto">
            <div className="w-14 h-14 rounded-2xl bg-indigo-500/10 border border-indigo-500/20 flex items-center justify-center mx-auto mb-4 text-indigo-400">
              <CalendarCheck className="w-7 h-7" />
            </div>
            <h3 className="text-base font-semibold text-slate-200">No Events Configured Yet</h3>
            <p className="text-xs text-slate-400 mt-1 mb-6 leading-relaxed">
              Start by launching your first hackathon or pitch event. You will configure criteria weights, invite jury evaluators, and anchor cryptographic proofs.
            </p>
            <Link
              href="/org/events/new"
              className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-semibold text-xs transition-colors"
            >
              <Plus className="w-4 h-4" />
              <span>Create Event Wizard</span>
            </Link>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {events.map((event) => {
              const sc = statusColors[event.status] || statusColors.draft
              return (
                <Link
                  key={event.id}
                  href={`/org/events/${event.id}`}
                  className="group bg-slate-900/80 hover:bg-slate-900 border border-slate-800 hover:border-indigo-500/50 rounded-2xl p-5 shadow-lg transition-all duration-200 flex flex-col justify-between"
                >
                  <div>
                    <div className="flex items-center justify-between mb-3">
                      <span
                        className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider border ${sc.bg} ${sc.text} ${sc.border}`}
                      >
                        {event.status}
                      </span>
                      {event.blind_mode && (
                        <span className="flex items-center gap-1 text-[10px] font-semibold text-purple-400 bg-purple-950/30 border border-purple-800/40 px-2 py-0.5 rounded-full">
                          <Shield className="w-2.5 h-2.5" /> Blind Mode
                        </span>
                      )}
                    </div>

                    <h3 className="text-base font-bold text-slate-100 group-hover:text-indigo-400 transition-colors line-clamp-1">
                      {event.title}
                    </h3>

                    <p className="text-xs text-slate-400 mt-1 line-clamp-2 leading-relaxed">
                      {event.description || 'No description provided.'}
                    </p>
                  </div>

                  <div className="mt-5 pt-4 border-t border-slate-800 flex items-center justify-between text-xs text-slate-400">
                    <div className="flex items-center gap-1 text-[11px] text-slate-500">
                      <Clock className="w-3.5 h-3.5" />
                      <span>{new Date(event.start_date).toLocaleDateString()}</span>
                    </div>

                    <div className="flex items-center gap-1 text-indigo-400 font-medium group-hover:translate-x-0.5 transition-transform text-[11px]">
                      <span>Command Center</span>
                      <ChevronRight className="w-3.5 h-3.5" />
                    </div>
                  </div>
                </Link>
              )
            })}
          </div>
        )}
      </main>
    </div>
  )
}
