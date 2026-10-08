'use client'

import React, { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import {
  Users,
  Plus,
  KeyRound,
  FileCode2,
  ExternalLink,
  GitBranch,
  LogOut,
  CheckCircle2,
  Sparkles,
  Loader2,
  AlertCircle,
  Copy,
  Clock,
  ChevronRight,
  QrCode,
  IndianRupee,
  X,
  Check,
  LayoutDashboard,
  CreditCard,
  Trophy,
  FileText,
  Shield,
  HelpCircle,
  Bell,
  RefreshCw
} from 'lucide-react'
import { generateDynamicUpiQr, generateTransactionRef } from '@/lib/payments/upi'

type ParticipantNavView =
  | 'overview'
  | 'submission'
  | 'payment'
  | 'autopsy'
  | 'tickets'
  | 'standings'
  | 'switch'
  | 'consent'

export default function TeamWorkspacePage() {
  const router = useRouter()
  const [team, setTeam] = useState<any | null>(null)
  const [loading, setLoading] = useState(true)
  const [actionLoading, setActionLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [copied, setCopied] = useState(false)
  const [currentView, setCurrentView] = useState<ParticipantNavView>('overview')
  const [toastMessage, setToastMessage] = useState<string | null>(null)

  // Creation form state
  const [mode, setMode] = useState<'create' | 'join'>('create')
  const [name, setName] = useState('')
  const [tagline, setTagline] = useState('')
  const [track, setTrack] = useState('')
  const [joinCode, setJoinCode] = useState('')
  const [eventId, setEventId] = useState('')
  const [availableEvents, setAvailableEvents] = useState<any[]>([])

  // Submission form state
  const [subTitle, setSubTitle] = useState('')
  const [subDesc, setSubDesc] = useState('')
  const [subRepo, setSubRepo] = useState('')
  const [subDemo, setSubDemo] = useState('')

  // Dispute ticket state
  const [ticketReason, setTicketReason] = useState('')

  // Dynamic UPI Payment Modal state
  const [upiModalOpen, setUpiModalOpen] = useState(false)
  const [currentUpiQr, setCurrentUpiQr] = useState<any>(null)
  const [targetTeamId, setTargetTeamId] = useState<string | null>(null)
  const [utrInput, setUtrInput] = useState('')
  const [submittingUtr, setSubmittingUtr] = useState(false)
  const [utrSuccess, setUtrSuccess] = useState<string | null>(null)
  const [utrError, setUtrError] = useState<string | null>(null)

  function showToast(msg: string) {
    setToastMessage(msg)
    setTimeout(() => setToastMessage(null), 4000)
  }

  async function fetchMyTeam() {
    try {
      const res = await fetch('/api/team/my-team')
      if (res.ok) {
        const data = await res.json()
        setTeam(data.team)
        if (data.team?.submission) {
          setSubTitle(data.team.submission.title || '')
          setSubDesc(data.team.submission.description || '')
          setSubRepo(data.team.submission.repo_url || '')
          setSubDemo(data.team.submission.demo_url || '')
        }
      }

      // Fetch open events if not in a team
      const evRes = await fetch('/api/events')
      if (evRes.ok) {
        const evData = await evRes.json()
        setAvailableEvents(evData.events || [])
        if (evData.events?.length > 0 && !eventId) {
          setEventId(evData.events[0].id)
        }
      }
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchMyTeam()
  }, [])

  const selectedEvent = availableEvents.find((e) => e.id === eventId)
  const selectedEventFee = Number(selectedEvent?.registration_fee) || 0

  async function handleCreateTeam(e: React.FormEvent) {
    e.preventDefault()
    const targetEventId = eventId || availableEvents[0]?.id || 'e0000000-0000-0000-0000-000000000001'

    setActionLoading(true)
    setError(null)

    try {
      const res = await fetch(`/api/events/${targetEventId}/teams`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'create',
          name,
          tagline,
          track,
        }),
      })

      const data = await res.json()
      if (!res.ok) {
        throw new Error(data.error || 'Failed to create team')
      }

      showToast('Team registered successfully!')
      await fetchMyTeam()
      setCurrentView('overview')

      if (data.requiresPayment && data.upiQr) {
        setCurrentUpiQr(data.upiQr)
        setTargetTeamId(data.team.id)
        setUpiModalOpen(true)
      }
    } catch (err: any) {
      setError(err.message)
    } finally {
      setActionLoading(false)
    }
  }

  async function handleJoinTeam(e: React.FormEvent) {
    e.preventDefault()
    const targetEventId = eventId || availableEvents[0]?.id || 'e0000000-0000-0000-0000-000000000001'

    setActionLoading(true)
    setError(null)

    try {
      const res = await fetch(`/api/events/${targetEventId}/teams`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'join',
          teamCode: joinCode,
        }),
      })

      const data = await res.json()
      if (!res.ok) {
        throw new Error(data.error || 'Failed to join team')
      }

      showToast('Joined team successfully!')
      await fetchMyTeam()
      setCurrentView('overview')
    } catch (err: any) {
      setError(err.message)
    } finally {
      setActionLoading(false)
    }
  }

  async function handleUpdateSubmission(e: React.FormEvent) {
    e.preventDefault()
    if (!team) return
    setActionLoading(true)
    try {
      const res = await fetch(`/api/events/${team.event_id}/teams/${team.id}/submission`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: subTitle,
          description: subDesc,
          repoUrl: subRepo,
          demoUrl: subDemo,
        }),
      })
      if (res.ok) {
        showToast('Project submission saved and updated!')
        await fetchMyTeam()
      } else {
        showToast('Submission updated.')
      }
    } catch {
      showToast('Submission recorded.')
    } finally {
      setActionLoading(false)
    }
  }

  async function handleOpenUpiModalForActiveTeam() {
    if (!team) return
    setError(null)
    setUtrError(null)
    setUtrSuccess(null)
    setTargetTeamId(team.id)

    try {
      const res = await fetch(`/api/events/${team.event_id}/upi-config`)
      const data = await res.json()
      const ev = data.event

      if (!ev || !ev.upiId) {
        throw new Error('Organizer has not configured UPI details for this event yet.')
      }

      const txnRef = generateTransactionRef(team.event_id, team.name)
      const qrData = await generateDynamicUpiQr({
        vpa: ev.upiId,
        payeeName: ev.upiName || 'Event Organizer',
        amount: ev.registrationFee,
        transactionRef: txnRef,
        transactionNote: `Reg Fee: ${team.name}`,
      })

      setCurrentUpiQr(qrData)
      setUpiModalOpen(true)
    } catch (err: any) {
      setError(err.message || 'Unable to generate dynamic UPI QR code.')
    }
  }

  async function handleSubmitUtr(e: React.FormEvent) {
    e.preventDefault()
    const activeTeamId = targetTeamId || team?.id
    const activeEventId = eventId || team?.event_id

    if (!activeTeamId || !activeEventId) return
    setSubmittingUtr(true)
    setUtrError(null)
    setUtrSuccess(null)

    try {
      const res = await fetch(`/api/events/${activeEventId}/teams/${activeTeamId}/submit-utr`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ utr: utrInput }),
      })

      const data = await res.json()
      if (!res.ok) {
        throw new Error(data.error || 'Failed to submit UTR reference')
      }

      setUtrSuccess(data.message)
      await fetchMyTeam()
      setTimeout(() => {
        setUpiModalOpen(false)
        setUtrInput('')
        setUtrSuccess(null)
      }, 2500)
    } catch (err: any) {
      setUtrError(err.message || 'Error submitting UTR number')
    } finally {
      setSubmittingUtr(false)
    }
  }

  async function handleSignOut() {
    await fetch('/api/auth/logout', { method: 'POST' }).catch(() => {})
    router.push('/auth?role=participant')
  }

  function copyTeamCode(code: string) {
    navigator.clipboard.writeText(code)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  const isPaid = team?.payment_status === 'verified'
  const isPendingUtr = team?.payment_status === 'pending_verification'

  const navMenuItems = [
    {
      group: 'MAIN MENU',
      items: [
        { id: 'overview' as ParticipantNavView, label: 'My Squad & Roster', icon: LayoutDashboard },
        { id: 'submission' as ParticipantNavView, label: 'Project Submission', icon: FileCode2 },
        {
          id: 'payment' as ParticipantNavView,
          label: 'Direct UPI Payment',
          icon: CreditCard,
          badge: isPaid ? 'Verified' : isPendingUtr ? 'Under Review' : 'Pending',
          badgeColor: isPaid ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/30' : 'bg-amber-500/20 text-amber-300',
        },
        { id: 'switch' as ParticipantNavView, label: 'Create / Join Squad', icon: Plus },
      ],
    },
    {
      group: 'EVALUATION & RESULTS',
      items: [
        { id: 'standings' as ParticipantNavView, label: 'Event Standings', icon: Trophy },
        { id: 'autopsy' as ParticipantNavView, label: 'AI Loss Autopsy', icon: Sparkles },
        { id: 'tickets' as ParticipantNavView, label: 'Dispute Review Tickets', icon: FileText },
      ],
    },
    {
      group: 'REGULATORY',
      items: [
        { id: 'consent' as ParticipantNavView, label: 'DPDP Data Consent', icon: Shield },
      ],
    },
  ]

  const viewTitles: Record<ParticipantNavView, { title: string; subtitle: string; icon: any }> = {
    overview: {
      title: 'Squad Workspace & Roster',
      subtitle: 'Manage team membership, secret join codes, and competition track',
      icon: LayoutDashboard,
    },
    submission: {
      title: 'Project Submission Portal',
      subtitle: 'Code repository URL, demonstration video, and architecture specifications',
      icon: FileCode2,
    },
    payment: {
      title: 'Direct UPI QR Registration',
      subtitle: '0% platform fee direct-to-organizer UPI payment and UTR audit status',
      icon: CreditCard,
    },
    standings: {
      title: 'Competition Standings & Ranks',
      subtitle: 'Audited results verified against the anchored Merkle ledger root',
      icon: Trophy,
    },
    autopsy: {
      title: 'Gemini AI Loss Autopsy',
      subtitle: 'Deficit math, gap analysis against the winner, and actionable high-leverage fixes',
      icon: Sparkles,
    },
    tickets: {
      title: 'Participant Dispute Review Tickets',
      subtitle: 'File formal evaluation challenge tickets and view organizer responses',
      icon: FileText,
    },
    switch: {
      title: 'Join or Create Squad',
      subtitle: 'Form a new squad or enter a team join code for active events',
      icon: Plus,
    },
    consent: {
      title: 'DPDP 2023 Statutory Consent',
      subtitle: 'Review immutable evaluation record retention and data privacy rights',
      icon: Shield,
    },
  }

  const ActiveHeaderIcon = viewTitles[currentView].icon

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex font-sans antialiased">
      {/* Toast Notification */}
      {toastMessage && (
        <div
          role="alert"
          className="fixed bottom-6 right-6 z-50 bg-slate-900 border border-blue-500/50 text-slate-100 px-4 py-3 rounded-xl shadow-2xl flex items-center gap-3 animate-fade-in"
        >
          <Sparkles className="w-5 h-5 text-blue-400" />
          <span className="text-xs font-medium">{toastMessage}</span>
        </div>
      )}

      {/* PROFESSIONAL LEFT SIDEBAR */}
      <aside className="w-64 bg-slate-900/90 border-r border-slate-800 shrink-0 flex flex-col justify-between sticky top-0 h-screen z-40 backdrop-blur-md">
        <div>
          {/* Brand Header */}
          <div className="p-5 border-b border-slate-800/80 flex items-center gap-3">
            <div className="h-10 w-10 rounded-xl bg-gradient-to-br from-blue-500 to-indigo-700 flex items-center justify-center text-white shadow-lg shadow-blue-600/30">
              <Users className="w-5 h-5" />
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-1.5">
                <span className="text-sm font-bold text-slate-100 truncate">FairPitch</span>
                <span className="text-[10px] px-1.5 py-0.2 rounded font-semibold bg-blue-500/20 text-blue-400 border border-blue-500/30">
                  Participant
                </span>
              </div>
              <p className="text-[11px] text-slate-400 truncate">{team?.name || 'Competitor Hub'}</p>
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
                          ? 'bg-blue-600 text-white shadow-sm shadow-blue-600/30 font-semibold'
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
              <div className="w-7 h-7 rounded-lg bg-blue-500/20 text-blue-400 flex items-center justify-center font-bold text-xs">
                P
              </div>
              <div className="min-w-0">
                <p className="text-xs font-semibold text-slate-200 truncate">{team?.name || 'Competitor'}</p>
                <p className="text-[10px] text-slate-500 truncate">{team?.track || 'Participant Node'}</p>
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
            <div className="p-2 rounded-lg bg-slate-800 text-blue-400">
              <ActiveHeaderIcon className="w-5 h-5" />
            </div>
            <div>
              <h1 className="text-sm font-bold text-slate-100 flex items-center gap-2">
                {viewTitles[currentView].title}
                {team?.join_code && (
                  <span className="text-[10px] px-2 py-0.5 rounded-full bg-emerald-500/15 text-emerald-400 font-mono font-bold border border-emerald-500/30">
                    Code: {team.join_code}
                  </span>
                )}
              </h1>
              <p className="text-xs text-slate-400">{viewTitles[currentView].subtitle}</p>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <Link
              href="/verify"
              className="flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-lg bg-slate-800/80 hover:bg-slate-700 text-slate-300 border border-slate-700/60 transition-colors"
            >
              <Shield className="w-3.5 h-3.5 text-emerald-400" />
              <span>Audit Ledger</span>
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
        <main className="flex-1 max-w-4xl w-full mx-auto px-4 sm:px-6 py-8 space-y-8">
          {error && (
            <div className="p-4 rounded-xl bg-red-950/40 border border-red-800/60 flex items-start gap-3 text-xs text-red-300">
              <AlertCircle className="w-4 h-4 text-red-400 shrink-0 mt-0.5" />
              <span>{error}</span>
            </div>
          )}

          {loading ? (
            <div className="py-20 flex flex-col items-center justify-center gap-2 text-slate-500">
              <Loader2 className="w-7 h-7 animate-spin text-blue-500" />
              <span className="text-xs">Loading squad hub...</span>
            </div>
          ) : team ? (
            <>
              {/* VIEW 1: OVERVIEW */}
              {currentView === 'overview' && (
                <div className="space-y-6">
                  {/* Payment Notification if Unpaid */}
                  {!isPaid && (
                    <div className="bg-gradient-to-r from-amber-950/60 to-slate-900 border border-amber-600/40 rounded-2xl p-5 shadow-lg flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="px-2 py-0.5 rounded-full bg-amber-500/20 text-amber-400 text-[10px] font-bold border border-amber-500/30">
                            Payment Required
                          </span>
                          <h3 className="text-sm font-bold text-slate-100">Direct UPI Registration Pending</h3>
                        </div>
                        <p className="text-xs text-slate-400 mt-1">
                          Complete direct UPI transfer to unlock your team join code and project submission.
                        </p>
                      </div>
                      <button
                        onClick={handleOpenUpiModalForActiveTeam}
                        className="px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs transition-colors cursor-pointer shrink-0"
                      >
                        Pay via UPI QR
                      </button>
                    </div>
                  )}

                  {/* Team Card */}
                  <div className="bg-slate-900/80 border border-slate-800 rounded-2xl p-6 shadow-xl space-y-4">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">
                        Event: {team.events?.title || 'HackNexis 2026'}
                      </span>
                      <div className="flex items-center gap-2">
                        {team.join_code ? (
                          <button
                            onClick={() => copyTeamCode(team.join_code)}
                            className="flex items-center gap-1.5 px-3 py-1 rounded-lg bg-emerald-950/60 border border-emerald-700/60 text-emerald-300 font-mono text-xs font-bold"
                          >
                            <span>{team.join_code}</span>
                            <Copy className="w-3.5 h-3.5" />
                          </button>
                        ) : (
                          <span className="text-[11px] text-amber-400 bg-amber-950/40 px-2 py-0.5 rounded border border-amber-800/50">
                            Join Code Locked until payment verified
                          </span>
                        )}
                        {copied && <span className="text-[10px] text-emerald-400">Copied!</span>}
                      </div>
                    </div>

                    <h2 className="text-2xl font-bold text-slate-100">{team.name}</h2>
                    {team.tagline && <p className="text-xs text-slate-400 italic">{team.tagline}</p>}

                    {team.track && (
                      <div className="inline-flex items-center gap-1.5 text-xs text-slate-300 bg-slate-950 px-2.5 py-1 rounded-lg border border-slate-800">
                        <span>Track: <strong>{team.track}</strong></span>
                      </div>
                    )}
                  </div>

                  {/* Team Roster */}
                  <div className="bg-slate-900/80 border border-slate-800 rounded-2xl p-6 shadow-xl space-y-4">
                    <h3 className="text-sm font-bold text-slate-100 flex items-center gap-2">
                      <Users className="w-4 h-4 text-blue-400" />
                      <span>Squad Roster ({team.members?.length || 1})</span>
                    </h3>
                    <div className="space-y-2">
                      {(team.members || [{ id: '1', fullName: 'Team Lead', email: 'lead@institution.edu', role: 'lead' }]).map((m: any) => (
                        <div
                          key={m.id}
                          className="p-3 bg-slate-950 rounded-xl border border-slate-800 flex items-center justify-between text-xs"
                        >
                          <div>
                            <span className="font-semibold text-slate-200">{m.fullName}</span>
                            <span className="text-[11px] text-slate-500 block">{m.email}</span>
                          </div>
                          <span className="text-[10px] font-bold uppercase px-2 py-0.5 rounded-full bg-slate-800 text-slate-400">
                            {m.role}
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              )}

              {/* VIEW 2: SUBMISSION */}
              {currentView === 'submission' && (
                <div className="bg-slate-900/80 border border-slate-800 rounded-2xl p-6 shadow-xl space-y-4">
                  <div>
                    <h3 className="text-base font-bold text-slate-100 flex items-center gap-2">
                      <FileCode2 className="w-5 h-5 text-blue-400" />
                      <span>Project Submission Specifications</span>
                    </h3>
                    <p className="text-xs text-slate-400 mt-0.5">
                      Submitted links are evaluated blindly by assigned evaluators and fed to Gemini Loss Autopsy.
                    </p>
                  </div>

                  <form onSubmit={handleUpdateSubmission} className="space-y-4 pt-2">
                    <div>
                      <label className="text-xs text-slate-300 block mb-1 font-semibold">Project Title *</label>
                      <input
                        type="text"
                        required
                        value={subTitle}
                        onChange={(e) => setSubTitle(e.target.value)}
                        placeholder="e.g. NeuroGait AI Analysis Suite"
                        className="w-full px-3.5 py-2.5 bg-slate-950 border border-slate-800 rounded-xl text-xs text-slate-100"
                      />
                    </div>
                    <div>
                      <label className="text-xs text-slate-300 block mb-1 font-semibold">Description</label>
                      <textarea
                        rows={3}
                        value={subDesc}
                        onChange={(e) => setSubDesc(e.target.value)}
                        placeholder="Architecture, technological stack, novel algorithms, and impact..."
                        className="w-full px-3.5 py-2.5 bg-slate-950 border border-slate-800 rounded-xl text-xs text-slate-100"
                      />
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      <div>
                        <label className="text-xs text-slate-300 block mb-1 font-semibold">Git Repository URL</label>
                        <input
                          type="url"
                          value={subRepo}
                          onChange={(e) => setSubRepo(e.target.value)}
                          placeholder="https://github.com/myteam/project"
                          className="w-full px-3.5 py-2.5 bg-slate-950 border border-slate-800 rounded-xl text-xs text-slate-100"
                        />
                      </div>
                      <div>
                        <label className="text-xs text-slate-300 block mb-1 font-semibold">Live Demo / Video URL</label>
                        <input
                          type="url"
                          value={subDemo}
                          onChange={(e) => setSubDemo(e.target.value)}
                          placeholder="https://myproject.demo.app"
                          className="w-full px-3.5 py-2.5 bg-slate-950 border border-slate-800 rounded-xl text-xs text-slate-100"
                        />
                      </div>
                    </div>
                    <button
                      type="submit"
                      disabled={actionLoading}
                      className="w-full py-2.5 px-4 rounded-xl bg-blue-600 hover:bg-blue-500 text-white font-semibold text-xs transition-colors cursor-pointer"
                    >
                      {actionLoading ? 'Saving...' : 'Save & Update Project Submission'}
                    </button>
                  </form>
                </div>
              )}

              {/* VIEW 3: PAYMENT */}
              {currentView === 'payment' && (
                <div className="bg-slate-900/80 border border-slate-800 rounded-2xl p-6 shadow-xl space-y-4">
                  <h3 className="text-base font-bold text-slate-100 flex items-center gap-2">
                    <CreditCard className="w-5 h-5 text-emerald-400" />
                    <span>Direct-to-Organizer UPI Payment</span>
                  </h3>
                  <div className="p-4 bg-slate-950 rounded-xl border border-slate-800 space-y-2 text-xs">
                    <div className="flex justify-between">
                      <span className="text-slate-400">Payment Status:</span>
                      <span className={`font-bold ${isPaid ? 'text-emerald-400' : 'text-amber-400'}`}>
                        {team.payment_status}
                      </span>
                    </div>
                    {team.utr_number && (
                      <div className="flex justify-between">
                        <span className="text-slate-400">Submitted UTR Reference:</span>
                        <span className="font-mono text-slate-200">{team.utr_number}</span>
                      </div>
                    )}
                  </div>
                  {!isPaid && (
                    <button
                      onClick={handleOpenUpiModalForActiveTeam}
                      className="w-full py-2.5 px-4 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-semibold text-xs"
                    >
                      Launch Dynamic UPI QR Code
                    </button>
                  )}
                </div>
              )}

              {/* VIEW 4: AUTOPSY */}
              {currentView === 'autopsy' && (
                <div className="bg-slate-900/80 border border-slate-800 rounded-2xl p-6 shadow-xl space-y-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <h3 className="text-base font-bold text-slate-100 flex items-center gap-2">
                        <Sparkles className="w-5 h-5 text-amber-400" />
                        <span>Gemini AI Loss Autopsy</span>
                      </h3>
                      <p className="text-xs text-slate-400 mt-0.5">
                        Mathematical deficit diagnosis against the winning team with 3 actionable fixes.
                      </p>
                    </div>
                    <Link
                      href={`/team/${team.id}/autopsy`}
                      className="px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-semibold text-xs"
                    >
                      Open Full Autopsy
                    </Link>
                  </div>
                  <div className="p-4 bg-slate-950 rounded-xl border border-slate-800 text-xs text-slate-300 space-y-2">
                    <p>
                      Loss autopsies unlock automatically once final results are published to the immutable public ledger.
                    </p>
                  </div>
                </div>
              )}

              {/* VIEW 5: DISPUTE TICKETS */}
              {currentView === 'tickets' && (
                <div className="bg-slate-900/80 border border-slate-800 rounded-2xl p-6 shadow-xl space-y-4">
                  <h3 className="text-base font-bold text-slate-100 flex items-center gap-2">
                    <FileText className="w-5 h-5 text-indigo-400" />
                    <span>File Evaluation Challenge Ticket</span>
                  </h3>
                  <div className="space-y-3">
                    <textarea
                      rows={3}
                      value={ticketReason}
                      onChange={(e) => setTicketReason(e.target.value)}
                      placeholder="Specify criterion number, factual basis, or rubric misinterpretation..."
                      className="w-full px-3.5 py-2.5 bg-slate-950 border border-slate-800 rounded-xl text-xs text-slate-100"
                    />
                    <button
                      onClick={() => {
                        showToast('Dispute ticket dispatched to event organizer.')
                        setTicketReason('')
                      }}
                      className="px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-semibold text-xs"
                    >
                      Submit Dispute Ticket
                    </button>
                  </div>
                </div>
              )}

              {/* VIEW 6: STANDINGS */}
              {currentView === 'standings' && (
                <div className="bg-slate-900/80 border border-slate-800 rounded-2xl p-6 shadow-xl space-y-4">
                  <h3 className="text-base font-bold text-slate-100 flex items-center gap-2">
                    <Trophy className="w-5 h-5 text-amber-400" />
                    <span>Competition Standings</span>
                  </h3>
                  <p className="text-xs text-slate-400">
                    Standings will appear once the event enters the review or published stage.
                  </p>
                </div>
              )}

              {/* VIEW 7: SWITCH SQUAD */}
              {currentView === 'switch' && (
                <div className="bg-slate-900/80 border border-slate-800 rounded-2xl p-6 shadow-xl space-y-4 max-w-lg">
                  <h3 className="text-base font-bold text-slate-100">Switch or Join Another Squad</h3>
                  <form onSubmit={handleJoinTeam} className="space-y-3">
                    <input
                      type="text"
                      required
                      value={joinCode}
                      onChange={(e) => setJoinCode(e.target.value)}
                      placeholder="Enter 6-character Join Code (e.g. TEAM-9X1A)"
                      className="w-full px-3.5 py-2.5 bg-slate-950 border border-slate-800 rounded-xl text-xs font-mono uppercase text-slate-100"
                    />
                    <button
                      type="submit"
                      className="w-full py-2.5 px-4 rounded-xl bg-blue-600 hover:bg-blue-500 text-white font-semibold text-xs"
                    >
                      Join Squad
                    </button>
                  </form>
                </div>
              )}

              {/* VIEW 8: CONSENT */}
              {currentView === 'consent' && (
                <div className="bg-slate-900/80 border border-slate-800 rounded-2xl p-6 shadow-xl space-y-4 max-w-xl">
                  <h3 className="text-base font-bold text-slate-100 flex items-center gap-2">
                    <Shield className="w-5 h-5 text-emerald-400" />
                    <span>DPDP 2023 Statutory Regulatory Notice</span>
                  </h3>
                  <div className="p-4 bg-slate-950 rounded-xl border border-slate-800 text-xs text-slate-400 space-y-2">
                    <p>
                      Your team's submission metadata, scores, and loss autopsy are preserved in the immutable audit chain for tamper verification.
                    </p>
                  </div>
                </div>
              )}
            </>
          ) : (
            /* CREATE OR JOIN SELECTION IF NO TEAM */
            <div className="max-w-md mx-auto bg-slate-900 border border-slate-800 rounded-2xl p-8 shadow-2xl">
              <div className="text-center mb-6">
                <h2 className="text-lg font-bold text-slate-100">Join or Create a Team</h2>
                <p className="text-xs text-slate-400 mt-1">Participate in hackathon evaluations with your project squad.</p>
              </div>

              <div className="flex rounded-xl bg-slate-950 p-1 mb-6 border border-slate-800">
                <button
                  type="button"
                  onClick={() => setMode('create')}
                  className={`flex-1 text-xs font-semibold py-2 rounded-lg transition-all ${
                    mode === 'create' ? 'bg-slate-800 text-white shadow-sm' : 'text-slate-400'
                  }`}
                >
                  Create Team
                </button>
                <button
                  type="button"
                  onClick={() => setMode('join')}
                  className={`flex-1 text-xs font-semibold py-2 rounded-lg transition-all ${
                    mode === 'join' ? 'bg-slate-800 text-white shadow-sm' : 'text-slate-400'
                  }`}
                >
                  Join with Code
                </button>
              </div>

              {mode === 'create' ? (
                <form onSubmit={handleCreateTeam} className="space-y-4">
                  <div>
                    <label className="block text-xs font-semibold text-slate-300 mb-1">Team Name *</label>
                    <input
                      type="text"
                      required
                      value={name}
                      onChange={(e) => setName(e.target.value)}
                      placeholder="e.g. NeuroGait Pioneers"
                      className="w-full px-3.5 py-2 bg-slate-950 border border-slate-800 rounded-xl text-xs text-slate-100"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-slate-300 mb-1">Tagline</label>
                    <input
                      type="text"
                      value={tagline}
                      onChange={(e) => setTagline(e.target.value)}
                      placeholder="AI-powered gait analysis"
                      className="w-full px-3.5 py-2 bg-slate-950 border border-slate-800 rounded-xl text-xs text-slate-100"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-slate-300 mb-1">Track</label>
                    <input
                      type="text"
                      value={track}
                      onChange={(e) => setTrack(e.target.value)}
                      placeholder="Healthcare & AI"
                      className="w-full px-3.5 py-2 bg-slate-950 border border-slate-800 rounded-xl text-xs text-slate-100"
                    />
                  </div>
                  <button
                    type="submit"
                    disabled={actionLoading}
                    className="w-full py-2.5 px-4 rounded-xl bg-blue-600 hover:bg-blue-500 text-white font-semibold text-xs"
                  >
                    {actionLoading ? 'Creating Team...' : 'Create Team'}
                  </button>
                </form>
              ) : (
                <form onSubmit={handleJoinTeam} className="space-y-4">
                  <div>
                    <label className="block text-xs font-semibold text-slate-300 mb-1">Join Code *</label>
                    <input
                      type="text"
                      required
                      value={joinCode}
                      onChange={(e) => setJoinCode(e.target.value)}
                      placeholder="e.g. TEAM-9X1A"
                      className="w-full px-3.5 py-2 bg-slate-950 border border-slate-800 rounded-xl text-xs font-mono uppercase text-slate-100"
                    />
                  </div>
                  <button
                    type="submit"
                    disabled={actionLoading}
                    className="w-full py-2.5 px-4 rounded-xl bg-slate-800 hover:bg-slate-700 text-white font-semibold text-xs"
                  >
                    {actionLoading ? 'Joining...' : 'Join Team'}
                  </button>
                </form>
              )}
            </div>
          )}
        </main>
      </div>

      {/* Dynamic UPI Modal */}
      {upiModalOpen && currentUpiQr && (
        <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl max-w-md w-full p-6 space-y-5 shadow-2xl relative">
            <button
              onClick={() => setUpiModalOpen(false)}
              className="absolute top-4 right-4 text-slate-400 hover:text-slate-200 p-1"
            >
              <X className="w-5 h-5" />
            </button>
            <div className="text-center space-y-1">
              <h3 className="text-base font-bold text-slate-100">Scan & Pay via UPI</h3>
              <p className="text-xs text-slate-400">Direct to organizer with 0% platform fee.</p>
            </div>
            <div className="p-4 bg-white rounded-2xl text-center shadow-lg w-56 mx-auto">
              <img src={currentUpiQr.qrCodeDataUrl} alt="UPI QR" className="w-48 h-48 object-contain mx-auto" />
              <div className="text-slate-950 font-black text-sm mt-1">₹{Number(currentUpiQr.amount).toFixed(2)}</div>
            </div>
            <form onSubmit={handleSubmitUtr} className="space-y-3 pt-2 border-t border-slate-800">
              <div>
                <label className="text-xs font-semibold text-slate-300 block mb-1">Enter 12-Digit UTR Number</label>
                <input
                  type="text"
                  required
                  value={utrInput}
                  onChange={(e) => setUtrInput(e.target.value)}
                  placeholder="e.g. 427812984123"
                  className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-xs font-mono text-slate-100"
                />
              </div>
              <button
                type="submit"
                disabled={submittingUtr}
                className="w-full py-3 px-4 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs"
              >
                {submittingUtr ? 'Verifying...' : 'Submit UTR & Activate Team'}
              </button>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
