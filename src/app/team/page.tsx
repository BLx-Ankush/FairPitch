'use client'

import React, { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import {
  Users,
  Plus,
  KeyRound,
  FileCode2,
  LogOut,
  CheckCircle2,
  Sparkles,
  Loader2,
  AlertCircle,
  Copy,
  Clock,
  QrCode,
  IndianRupee,
  X,
  Check,
  LayoutDashboard,
  CreditCard,
  Trophy,
  FileText,
  Shield,
  ArrowRight,
  ArrowLeft,
  Share2,
  ExternalLink,
  Ticket,
  MessageCircle,
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

type OnboardingStep = 'select' | 'event_code' | 'create' | 'join' | 'payment' | 'ready'

export default function TeamWorkspacePage() {
  const router = useRouter()
  const [team, setTeam] = useState<any | null>(null)
  const [loading, setLoading] = useState(true)
  const [actionLoading, setActionLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [copied, setCopied] = useState(false)
  const [currentView, setCurrentView] = useState<ParticipantNavView>('overview')
  const [toastMessage, setToastMessage] = useState<string | null>(null)

  // Dedicated Onboarding State (when !team)
  const [onboardingStep, setOnboardingStep] = useState<OnboardingStep>('select')
  const [createdTeam, setCreatedTeam] = useState<any | null>(null)

  // Flyer Event Code State
  const [eventCodeInput, setEventCodeInput] = useState('')
  const [verifiedEvent, setVerifiedEvent] = useState<any | null>(null)
  const [verifyingEvent, setVerifyingEvent] = useState(false)
  const [eventVerifyError, setEventVerifyError] = useState<string | null>(null)

  // Creation form state
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

  // Dynamic UPI Payment state
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

      // Fetch open events
      const evRes = await fetch('/api/events')
      if (evRes.ok) {
        const evData = await evRes.json()
        const evList = evData.events || []
        setAvailableEvents(evList)
        if (evList.length > 0 && !eventId) {
          setEventId(evList[0].id)
        }
      }
    } finally {
      setLoading(false)
    }
  }

  async function handleVerifyEventCode(codeToVerify?: string) {
    const code = (codeToVerify || eventCodeInput).trim().toUpperCase()
    if (!code) {
      setEventVerifyError('Please enter an event code from your flyer')
      return
    }

    setVerifyingEvent(true)
    setEventVerifyError(null)

    try {
      const res = await fetch(`/api/events/verify-code?code=${encodeURIComponent(code)}`)
      const data = await res.json()

      if (!res.ok) {
        throw new Error(data.error || 'Event not found')
      }

      setVerifiedEvent(data.event)
      setEventId(data.event.id)
      if (data.event.tracks?.length > 0 && !track) {
        setTrack(data.event.tracks[0])
      }
      setOnboardingStep('create')
    } catch (err: any) {
      setEventVerifyError(err.message || 'Failed to verify event code')
    } finally {
      setVerifyingEvent(false)
    }
  }

  useEffect(() => {
    fetchMyTeam()
    if (typeof window !== 'undefined') {
      const params = new URLSearchParams(window.location.search)
      const evParam = params.get('event')
      if (evParam) {
        const clean = evParam.toUpperCase()
        setEventCodeInput(clean)
        handleVerifyEventCode(clean)
      }
    }
  }, [])

  const selectedEvent = verifiedEvent || availableEvents.find((e) => e.id === eventId) || availableEvents[0]
  const selectedEventFee = Number(selectedEvent?.registrationFee ?? selectedEvent?.registration_fee) || 0

  async function handleCreateTeam(e: React.FormEvent) {
    const targetEventId = verifiedEvent?.id || eventId || availableEvents[0]?.id
    if (!targetEventId) {
      setError('Please verify a valid event code before creating your team.')
      return
    }

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

      setCreatedTeam(data.team)

      if (data.requiresPayment && data.upiQr) {
        setCurrentUpiQr(data.upiQr)
        setTargetTeamId(data.team.id)
        setOnboardingStep('payment')
      } else {
        setOnboardingStep('ready')
      }
    } catch (err: any) {
      setError(err.message || 'Failed to create team')
    } finally {
      setActionLoading(false)
    }
  }

  async function handleJoinTeam(e: React.FormEvent) {
    e.preventDefault()
    setActionLoading(true)
    setError(null)

    try {
      const res = await fetch('/api/team/join-by-code', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          teamCode: joinCode.trim().toUpperCase(),
        }),
      })

      const data = await res.json()
      if (!res.ok) {
        throw new Error(data.error || 'Failed to join team')
      }

      showToast('Joined squad successfully!')
      await fetchMyTeam()
      setCurrentView('overview')
    } catch (err: any) {
      setError(err.message || 'Failed to join team with the provided code')
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
    const activeTeamId = targetTeamId || createdTeam?.id || team?.id
    const activeEventId = eventId || createdTeam?.event_id || team?.event_id

    if (!activeTeamId || !activeEventId) return
    setSubmittingUtr(true)
    setUtrError(null)
    setUtrSuccess(null)

    try {
      const res = await fetch(`/api/events/${activeEventId}/teams/${activeTeamId}/submit-utr`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ utr: utrInput.trim() }),
      })

      const data = await res.json()
      if (!res.ok) {
        throw new Error(data.error || 'Failed to submit UTR reference')
      }

      setUtrSuccess(data.message)
      if (onboardingStep === 'payment') {
        setTimeout(() => {
          setOnboardingStep('ready')
        }, 1200)
      } else {
        await fetchMyTeam()
        setTimeout(() => {
          setUpiModalOpen(false)
          setUtrInput('')
          setUtrSuccess(null)
        }, 2000)
      }
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

  // =========================================================================
  // 1. LOADING SCREEN
  // =========================================================================
  if (loading) {
    return (
      <div className="min-h-screen bg-slate-950 flex flex-col items-center justify-center gap-3 text-slate-400">
        <Loader2 className="w-8 h-8 animate-spin text-blue-500" />
        <p className="text-xs font-medium">Loading participant workspace...</p>
      </div>
    )
  }

  // =========================================================================
  // 2. DEDICATED PARTICIPANT ONBOARDING FLOW (WHEN USER HAS NO TEAM YET)
  // Clean, focused, zero-sidebar onboarding experience
  // =========================================================================
  if (!team) {
    return (
      <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col font-sans antialiased relative overflow-hidden">
        {/* Subtle background glow */}
        <div className="absolute top-1/4 left-1/2 -translate-x-1/2 -translate-y-1/2 w-96 h-96 bg-blue-500/10 rounded-full blur-3xl pointer-events-none" />

        {/* Top Header */}
        <header className="border-b border-slate-800 bg-slate-900/80 backdrop-blur-md px-6 py-4 flex items-center justify-between sticky top-0 z-30">
          <div className="flex items-center gap-3">
            <Link href="/" className="h-10 w-10 rounded-xl bg-gradient-to-tr from-blue-600 to-indigo-600 flex items-center justify-center text-white shadow-lg shadow-blue-600/30">
              <Users className="w-5 h-5" />
            </Link>
            <div>
              <div className="flex items-center gap-2">
                <span className="text-base font-bold text-slate-100">FairPitch</span>
                <span className="text-[10px] px-2 py-0.5 rounded-full bg-blue-500/15 text-blue-400 font-semibold border border-blue-500/30">
                  Participant Setup
                </span>
              </div>
              <p className="text-xs text-slate-400">Squad Formation &amp; Registration Portal</p>
            </div>
          </div>
          <button
            onClick={handleSignOut}
            className="flex items-center gap-1.5 text-xs px-3.5 py-2 rounded-xl bg-slate-900 hover:bg-slate-800 text-slate-400 hover:text-slate-200 border border-slate-800 transition-colors cursor-pointer"
          >
            <LogOut className="w-3.5 h-3.5" />
            <span>Sign Out</span>
          </button>
        </header>

        {/* Main Onboarding Body */}
        <main className="flex-1 flex items-center justify-center p-4 sm:p-6 z-10">
          <div className="max-w-xl w-full">
            {error && (
              <div className="mb-4 p-4 rounded-xl bg-red-950/40 border border-red-800/60 flex items-start gap-3 text-xs text-red-300">
                <AlertCircle className="w-4 h-4 text-red-400 shrink-0 mt-0.5" />
                <span>{error}</span>
              </div>
            )}

            {/* STEP 1: SELECT CREATE OR JOIN */}
            {onboardingStep === 'select' && (
              <div className="bg-slate-900/90 border border-slate-800 rounded-3xl p-6 sm:p-8 shadow-2xl backdrop-blur-xl space-y-6">
                <div className="text-center space-y-2">
                  <div className="w-12 h-12 rounded-2xl bg-blue-500/10 border border-blue-500/30 flex items-center justify-center text-blue-400 mx-auto">
                    <Sparkles className="w-6 h-6" />
                  </div>
                  <h2 className="text-2xl font-black tracking-tight text-white">Join or Create a Team</h2>
                  <p className="text-xs sm:text-sm text-slate-400 max-w-sm mx-auto">
                    To access the project submission portal, standings, and loss autopsies, you must be part of an active squad.
                  </p>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-2">
                  {/* Option 1: Create Team */}
                  <div
                    onClick={() => {
                      setError(null)
                      if (verifiedEvent) {
                        setOnboardingStep('create')
                      } else {
                        setOnboardingStep('event_code')
                      }
                    }}
                    className="p-5 rounded-2xl bg-slate-950 border border-slate-800 hover:border-blue-500/60 transition-all cursor-pointer group flex flex-col justify-between space-y-4 hover:shadow-xl hover:shadow-blue-500/10"
                  >
                    <div className="space-y-3">
                      <div className="flex items-center justify-between">
                        <div className="w-10 h-10 rounded-xl bg-blue-500/10 text-blue-400 flex items-center justify-center group-hover:scale-105 transition-transform">
                          <Plus className="w-5 h-5" />
                        </div>
                        <span className="text-[10px] uppercase font-bold tracking-wider px-2 py-0.5 rounded-full bg-blue-500/15 text-blue-400 border border-blue-500/30">
                          Team Lead
                        </span>
                      </div>
                      <div>
                        <h3 className="text-base font-bold text-white group-hover:text-blue-400 transition-colors">
                          Create a Team
                        </h3>
                        <p className="text-xs text-slate-400 mt-1 leading-relaxed">
                          Enter your flyer Event Code, form your squad, pay via UPI, and generate your team invite code.
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center text-xs font-semibold text-blue-400 gap-1.5 pt-2">
                      <span>Start Team</span>
                      <ArrowRight className="w-3.5 h-3.5 group-hover:translate-x-1 transition-transform" />
                    </div>
                  </div>

                  {/* Option 2: Join Team */}
                  <div
                    onClick={() => {
                      setError(null)
                      setOnboardingStep('join')
                    }}
                    className="p-5 rounded-2xl bg-slate-950 border border-slate-800 hover:border-violet-500/60 transition-all cursor-pointer group flex flex-col justify-between space-y-4 hover:shadow-xl hover:shadow-violet-500/10"
                  >
                    <div className="space-y-3">
                      <div className="flex items-center justify-between">
                        <div className="w-10 h-10 rounded-xl bg-violet-500/10 text-violet-400 flex items-center justify-center group-hover:scale-105 transition-transform">
                          <KeyRound className="w-5 h-5" />
                        </div>
                        <span className="text-[10px] uppercase font-bold tracking-wider px-2 py-0.5 rounded-full bg-violet-500/15 text-violet-400 border border-violet-500/30">
                          Team Member
                        </span>
                      </div>
                      <div>
                        <h3 className="text-base font-bold text-white group-hover:text-violet-400 transition-colors">
                          Join with Code
                        </h3>
                        <p className="text-xs text-slate-400 mt-1 leading-relaxed">
                          Have a Squad Code from your team captain? Enter it to instantly join their roster with no fee.
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center text-xs font-semibold text-violet-400 gap-1.5 pt-2">
                      <span>Enter Squad Code</span>
                      <ArrowRight className="w-3.5 h-3.5 group-hover:translate-x-1 transition-transform" />
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* STEP 1.5: ENTER EVENT CODE FROM FLYER */}
            {onboardingStep === 'event_code' && (
              <div className="bg-slate-900/90 border border-slate-800 rounded-3xl p-6 sm:p-8 shadow-2xl backdrop-blur-xl space-y-6">
                <button
                  type="button"
                  onClick={() => {
                    setEventVerifyError(null)
                    setOnboardingStep('select')
                  }}
                  className="inline-flex items-center gap-1.5 text-xs text-slate-400 hover:text-white transition-colors cursor-pointer"
                >
                  <ArrowLeft className="w-3.5 h-3.5" />
                  <span>Back to options</span>
                </button>

                <div className="space-y-1">
                  <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-blue-500/10 text-blue-400 border border-blue-500/30 text-[10px] font-bold uppercase tracking-wider mb-2">
                    <Ticket className="w-3.5 h-3.5" />
                    <span>Flyer Event Verification</span>
                  </div>
                  <h2 className="text-xl font-bold text-white">Enter Hackathon Event Code</h2>
                  <p className="text-xs text-slate-400">
                    Enter the code printed on your event poster, flyer, or announcement (e.g. <code className="text-blue-400 font-bold">HACK-2026</code>)
                  </p>
                </div>

                {eventVerifyError && (
                  <div className="p-3.5 rounded-xl bg-red-950/40 border border-red-800/60 text-xs text-red-300 flex items-center gap-2">
                    <AlertCircle className="w-4 h-4 text-red-400 shrink-0" />
                    <span>{eventVerifyError}</span>
                  </div>
                )}

                <form
                  onSubmit={(e) => {
                    e.preventDefault()
                    handleVerifyEventCode()
                  }}
                  className="space-y-4"
                >
                  <div>
                    <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                      Flyer Event Code *
                    </label>
                    <div className="relative">
                      <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none">
                        <Ticket className="h-4 w-4 text-slate-500" />
                      </div>
                      <input
                        type="text"
                        required
                        value={eventCodeInput}
                        onChange={(e) => setEventCodeInput(e.target.value.toUpperCase())}
                        placeholder="e.g. HACK-2026"
                        className="w-full pl-10 pr-4 py-3 bg-slate-950 border border-slate-800 rounded-xl text-sm font-mono font-bold tracking-widest text-blue-300 placeholder-slate-600 focus:outline-none focus:ring-2 focus:ring-blue-500/50 uppercase"
                      />
                    </div>
                  </div>

                  <button
                    type="submit"
                    disabled={verifyingEvent || !eventCodeInput.trim()}
                    className="w-full py-3 px-4 rounded-xl bg-blue-600 hover:bg-blue-500 text-white font-bold text-xs transition-all shadow-md shadow-blue-600/30 flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
                  >
                    {verifyingEvent ? (
                      <>
                        <Loader2 className="w-4 h-4 animate-spin" />
                        <span>Verifying Hackathon Event...</span>
                      </>
                    ) : (
                      <>
                        <span>Verify &amp; Continue to Squad Details</span>
                        <ArrowRight className="w-4 h-4" />
                      </>
                    )}
                  </button>

                  {/* Active Events Quick Chips */}
                  {availableEvents.length > 0 && (
                    <div className="pt-3 border-t border-slate-800/80 space-y-2">
                      <span className="text-[11px] text-slate-400 font-medium">Or select an active hackathon:</span>
                      <div className="flex flex-wrap gap-2">
                        {availableEvents.map((ev) => {
                          const code = ev.event_code || ev.slug?.toUpperCase() || 'HACK-2026'
                          return (
                            <button
                              key={ev.id}
                              type="button"
                              onClick={() => {
                                setEventCodeInput(code)
                                handleVerifyEventCode(code)
                              }}
                              className="px-3 py-1.5 rounded-lg bg-slate-950 hover:bg-slate-800 border border-slate-800 hover:border-blue-500/40 text-xs text-slate-300 transition-colors flex items-center gap-1.5 cursor-pointer text-left"
                            >
                              <span className="font-semibold text-white">{ev.title}</span>
                              <span className="text-[10px] font-mono text-blue-400 font-bold bg-blue-950/60 px-1.5 py-0.5 rounded border border-blue-800/40">
                                {code}
                              </span>
                            </button>
                          )
                        })}
                      </div>
                    </div>
                  )}
                </form>
              </div>
            )}

            {/* STEP 2A: JOIN WITH CODE */}
            {onboardingStep === 'join' && (
              <div className="bg-slate-900/90 border border-slate-800 rounded-3xl p-6 sm:p-8 shadow-2xl backdrop-blur-xl space-y-6">
                <button
                  type="button"
                  onClick={() => {
                    setError(null)
                    setOnboardingStep('select')
                  }}
                  className="inline-flex items-center gap-1.5 text-xs text-slate-400 hover:text-white transition-colors cursor-pointer"
                >
                  <ArrowLeft className="w-3.5 h-3.5" />
                  <span>Back to options</span>
                </button>

                <div className="space-y-1">
                  <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-violet-500/10 text-violet-400 border border-violet-500/30 text-[10px] font-bold uppercase tracking-wider mb-2">
                    <KeyRound className="w-3.5 h-3.5" />
                    <span>Teammate Quick Join</span>
                  </div>
                  <h2 className="text-xl font-bold text-white">Enter Squad Join Code</h2>
                  <p className="text-xs text-slate-400">
                    Paste the 6-character squad code provided by your team captain (e.g. <code className="text-violet-400 font-bold">TEAM-A7K2</code>).
                  </p>
                </div>

                <form onSubmit={handleJoinTeam} className="space-y-4">
                  <div>
                    <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                      Squad Code *
                    </label>
                    <div className="relative">
                      <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none">
                        <KeyRound className="h-4 w-4 text-slate-500" />
                      </div>
                      <input
                        type="text"
                        required
                        value={joinCode}
                        onChange={(e) => setJoinCode(e.target.value.toUpperCase())}
                        placeholder="TEAM-XXXX"
                        className="w-full pl-10 pr-4 py-3 bg-slate-950 border border-slate-800 rounded-xl text-sm font-mono tracking-widest text-violet-300 placeholder-slate-600 focus:outline-none focus:ring-2 focus:ring-violet-500/50"
                      />
                    </div>
                  </div>

                  <button
                    type="submit"
                    disabled={actionLoading || !joinCode.trim()}
                    className="w-full py-3 px-4 rounded-xl bg-violet-600 hover:bg-violet-500 text-white font-bold text-xs transition-all shadow-md shadow-violet-600/30 flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
                  >
                    {actionLoading ? (
                      <>
                        <Loader2 className="w-4 h-4 animate-spin" />
                        <span>Verifying &amp; Joining Squad...</span>
                      </>
                    ) : (
                      <>
                        <span>Join Squad &amp; Enter Workspace</span>
                        <ArrowRight className="w-4 h-4" />
                      </>
                    )}
                  </button>
                </form>
              </div>
            )}

            {/* STEP 2B: CREATE SQUAD FORM */}
            {onboardingStep === 'create' && (
              <div className="bg-slate-900/90 border border-slate-800 rounded-3xl p-6 sm:p-8 shadow-2xl backdrop-blur-xl space-y-6">
                <button
                  type="button"
                  onClick={() => {
                    setError(null)
                    setOnboardingStep('event_code')
                  }}
                  className="inline-flex items-center gap-1.5 text-xs text-slate-400 hover:text-white transition-colors cursor-pointer"
                >
                  <ArrowLeft className="w-3.5 h-3.5" />
                  <span>Change Event Code</span>
                </button>

                {/* Verified Event Badge */}
                <div className="p-4 rounded-2xl bg-blue-950/30 border border-blue-800/60 flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="w-9 h-9 rounded-xl bg-blue-500/20 text-blue-400 flex items-center justify-center font-bold">
                      <CheckCircle2 className="w-5 h-5" />
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-bold text-white">{selectedEvent?.title}</span>
                        <span className="text-[10px] font-mono font-bold text-blue-400 bg-blue-900/50 px-2 py-0.5 rounded border border-blue-700/60">
                          {selectedEvent?.eventCode || selectedEvent?.event_code || 'HACK-2026'}
                        </span>
                      </div>
                      <p className="text-xs text-slate-400 mt-0.5">
                        {selectedEvent?.institutionName || (selectedEvent?.institutions as any)?.name || 'FairPitch Partner'} &middot;{' '}
                        <strong className="text-emerald-400">
                          {selectedEventFee > 0 ? `₹${selectedEventFee} Registration Fee` : 'Free Event'}
                        </strong>
                      </p>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => setOnboardingStep('event_code')}
                    className="text-xs font-semibold text-blue-400 hover:text-blue-300 underline cursor-pointer"
                  >
                    Change
                  </button>
                </div>

                <div className="space-y-1">
                  <h2 className="text-xl font-bold text-white">Create Your Project Squad</h2>
                  <p className="text-xs text-slate-400">
                    Form your team, select your competition track, and proceed to event activation.
                  </p>
                </div>

                <form onSubmit={handleCreateTeam} className="space-y-4">
                  <div>
                    <label className="block text-xs font-semibold text-slate-300 mb-1">
                      Team / Project Name *
                    </label>
                    <input
                      type="text"
                      required
                      value={name}
                      onChange={(e) => setName(e.target.value)}
                      placeholder="e.g. NeuroGait Pioneers"
                      className="w-full px-3.5 py-2.5 bg-slate-950 border border-slate-800 rounded-xl text-xs text-slate-100 placeholder-slate-600 focus:outline-none focus:ring-2 focus:ring-blue-500/50"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-slate-300 mb-1">
                      Tagline / One-Liner
                    </label>
                    <input
                      type="text"
                      value={tagline}
                      onChange={(e) => setTagline(e.target.value)}
                      placeholder="AI-powered mobile gait analysis for clinical rehab"
                      className="w-full px-3.5 py-2.5 bg-slate-950 border border-slate-800 rounded-xl text-xs text-slate-100 placeholder-slate-600 focus:outline-none focus:ring-2 focus:ring-blue-500/50"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                      Competition Track
                    </label>
                    {/* Suggested track chips */}
                    {selectedEvent?.tracks && selectedEvent.tracks.length > 0 && (
                      <div className="flex flex-wrap gap-1.5 mb-2">
                        {selectedEvent.tracks.map((t: string) => (
                          <button
                            key={t}
                            type="button"
                            onClick={() => setTrack(t)}
                            className={`px-2.5 py-1 rounded-lg text-xs font-medium transition-colors cursor-pointer border ${
                              track === t
                                ? 'bg-blue-600 text-white border-blue-500 font-semibold'
                                : 'bg-slate-950 text-slate-400 border-slate-800 hover:border-slate-700'
                            }`}
                          >
                            {t}
                          </button>
                        ))}
                      </div>
                    )}
                    <input
                      type="text"
                      value={track}
                      onChange={(e) => setTrack(e.target.value)}
                      placeholder="Choose track above or enter custom track"
                      className="w-full px-3.5 py-2.5 bg-slate-950 border border-slate-800 rounded-xl text-xs text-slate-100 placeholder-slate-600 focus:outline-none focus:ring-2 focus:ring-blue-500/50"
                    />
                  </div>

                  <button
                    type="submit"
                    disabled={actionLoading || !name}
                    className="w-full py-3 px-4 rounded-xl bg-blue-600 hover:bg-blue-500 text-white font-bold text-xs transition-all shadow-md shadow-blue-600/30 flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
                  >
                    {actionLoading ? (
                      <>
                        <Loader2 className="w-4 h-4 animate-spin" />
                        <span>Registering Squad...</span>
                      </>
                    ) : selectedEventFee > 0 ? (
                      <>
                        <span>Continue to UPI Payment (₹{selectedEventFee})</span>
                        <ArrowRight className="w-4 h-4" />
                      </>
                    ) : (
                      <>
                        <span>Create Squad &amp; Get Join Code</span>
                        <ArrowRight className="w-4 h-4" />
                      </>
                    )}
                  </button>
                </form>
              </div>
            )}

            {/* STEP 2C: DIRECT UPI PAYMENT (WHEN REQUIRED) */}
            {onboardingStep === 'payment' && currentUpiQr && (
              <div className="bg-slate-900/90 border border-slate-800 rounded-3xl p-6 sm:p-8 shadow-2xl backdrop-blur-xl space-y-6">
                <div className="text-center space-y-1">
                  <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/30 text-[10px] font-bold uppercase tracking-wider mb-2">
                    <CreditCard className="w-3.5 h-3.5" />
                    <span>Direct-to-Organizer UPI</span>
                  </div>
                  <h2 className="text-xl font-bold text-white">Scan &amp; Pay via UPI</h2>
                  <p className="text-xs text-slate-400">
                    Step 2 of 2 &middot; 0% platform transaction fee. Settle directly to event merchant.
                  </p>
                </div>

                {/* Scannable Dynamic QR Container */}
                <div className="p-4 bg-white rounded-2xl text-center shadow-xl w-60 mx-auto">
                  <img
                    src={currentUpiQr.qrCodeDataUrl}
                    alt="UPI QR Code"
                    className="w-52 h-52 object-contain mx-auto"
                  />
                  <div className="text-slate-950 font-black text-base mt-2 flex items-center justify-center gap-1">
                    <IndianRupee className="w-4 h-4" />
                    <span>{Number(currentUpiQr.amount).toFixed(2)}</span>
                  </div>
                  <p className="text-[10px] text-slate-500 font-mono mt-0.5">{currentUpiQr.vpa}</p>
                </div>

                {utrSuccess ? (
                  <div className="p-4 rounded-xl bg-emerald-950/40 border border-emerald-800/60 text-center space-y-2">
                    <CheckCircle2 className="w-8 h-8 text-emerald-400 mx-auto" />
                    <h4 className="text-sm font-bold text-emerald-300">Payment Submitted for Verification</h4>
                    <p className="text-xs text-slate-400">Entering your workspace...</p>
                  </div>
                ) : (
                  <form onSubmit={handleSubmitUtr} className="space-y-4 pt-2">
                    {utrError && (
                      <div className="p-3 rounded-xl bg-red-950/40 border border-red-800/60 text-xs text-red-300">
                        {utrError}
                      </div>
                    )}

                    <div>
                      <label className="block text-xs font-semibold text-slate-300 mb-1">
                        Enter 12-Digit Bank UTR / Transaction ID *
                      </label>
                      <input
                        type="text"
                        required
                        value={utrInput}
                        onChange={(e) => setUtrInput(e.target.value.replace(/[^0-9]/g, ''))}
                        maxLength={12}
                        placeholder="e.g. 427812984123"
                        className="w-full px-3.5 py-2.5 bg-slate-950 border border-slate-800 rounded-xl text-sm font-mono tracking-wider text-slate-100 placeholder-slate-600 focus:outline-none focus:ring-2 focus:ring-emerald-500/50"
                      />
                      <p className="text-[11px] text-slate-500 mt-1">
                        Check your GPay / PhonePe / Paytm receipt for the 12-digit numeric reference.
                      </p>
                    </div>

                    <div className="flex flex-col sm:flex-row gap-2.5">
                      <button
                        type="submit"
                        disabled={submittingUtr || utrInput.length < 6}
                        className="flex-1 py-3 px-4 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs transition-all shadow-md shadow-emerald-600/30 flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
                      >
                        {submittingUtr ? (
                          <>
                            <Loader2 className="w-4 h-4 animate-spin" />
                            <span>Verifying UTR...</span>
                          </>
                        ) : (
                          <>
                            <span>Confirm Payment &amp; Activate</span>
                            <ArrowRight className="w-4 h-4" />
                          </>
                        )}
                      </button>

                      <button
                        type="button"
                        onClick={() => setOnboardingStep('ready')}
                        className="py-3 px-4 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 font-semibold text-xs transition-colors cursor-pointer"
                      >
                        Complete Later
                      </button>
                    </div>
                  </form>
                )}
              </div>
            )}

            {/* STEP 3: READY / SUCCESS CONFIRMATION & JOIN CODE REVEAL */}
            {onboardingStep === 'ready' && (
              <div className="bg-slate-900/90 border border-slate-800 rounded-3xl p-6 sm:p-8 shadow-2xl backdrop-blur-xl text-center space-y-6">
                <div className="w-16 h-16 rounded-2xl bg-emerald-500/10 border border-emerald-500/30 flex items-center justify-center text-emerald-400 mx-auto">
                  <CheckCircle2 className="w-8 h-8" />
                </div>

                <div className="space-y-1">
                  <h2 className="text-2xl font-black text-white">Squad Activated!</h2>
                  <p className="text-xs sm:text-sm text-slate-300">
                    <strong className="text-white">{createdTeam?.name || name}</strong> is now registered in the event.
                  </p>
                </div>

                {/* Team Join Code Card */}
                {(createdTeam?.team_code || createdTeam?.join_code) && (
                  <div className="p-5 rounded-2xl bg-slate-950 border border-slate-800 text-left space-y-3">
                    <div className="flex items-center justify-between">
                      <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">
                        Your Squad Join Code
                      </span>
                      <span className="text-[10px] px-2 py-0.5 rounded-full bg-emerald-500/15 text-emerald-400 font-semibold border border-emerald-500/30">
                        Share with Teammates
                      </span>
                    </div>

                    <div className="flex items-center justify-between gap-3 p-3 rounded-xl bg-slate-900 border border-slate-700/80">
                      <span className="text-xl font-mono font-black tracking-widest text-emerald-400">
                        {createdTeam?.team_code || createdTeam?.join_code}
                      </span>
                      <button
                        type="button"
                        onClick={() => copyTeamCode(createdTeam?.team_code || createdTeam?.join_code)}
                        className="px-3 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs flex items-center gap-1.5 transition-colors cursor-pointer"
                      >
                        {copied ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
                        <span>{copied ? 'Copied!' : 'Copy Code'}</span>
                      </button>
                    </div>

                    <div className="pt-1">
                      <a
                        href={`https://wa.me/?text=${encodeURIComponent(`Join our hackathon squad "${createdTeam?.name || name}" on FairPitch! Team Join Code: ${createdTeam?.team_code || createdTeam?.join_code}\nRegister at https://fair-pitch.vercel.app/team`)}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="w-full py-2.5 px-3 rounded-xl bg-emerald-500/15 hover:bg-emerald-500/25 text-emerald-400 border border-emerald-500/30 font-bold text-xs flex items-center justify-center gap-2 transition-colors cursor-pointer"
                      >
                        <MessageCircle className="w-3.5 h-3.5" />
                        <span>Share Invite Code on WhatsApp</span>
                      </a>
                    </div>

                    <p className="text-xs text-slate-400 leading-relaxed">
                      Share this code with your teammates. When they log in and select <strong>&quot;Join with Code&quot;</strong>, they will instantly be added to your roster without paying fees again.
                    </p>
                  </div>
                )}

                <button
                  type="button"
                  onClick={async () => {
                    await fetchMyTeam()
                    setCurrentView('overview')
                  }}
                  className="w-full py-3.5 px-4 rounded-xl bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white font-bold text-sm shadow-xl shadow-blue-600/30 flex items-center justify-center gap-2 cursor-pointer transition-all"
                >
                  <span>Launch Participant Workspace</span>
                  <ArrowRight className="w-4 h-4" />
                </button>
              </div>
            )}
          </div>
        </main>
      </div>
    )
  }

  // =========================================================================
  // 3. FULL PARTICIPANT WORKSPACE DASHBOARD (WHEN USER BELONGS TO A SQUAD)
  // Complete sidebar with all tools, project submission, standings & autopsies
  // =========================================================================
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

        {/* User Footer Profile */}
        <div className="p-4 border-t border-slate-800/80 bg-slate-950/40">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2.5 min-w-0">
              <div className="w-8 h-8 rounded-lg bg-blue-500/10 border border-blue-500/20 text-blue-400 flex items-center justify-center font-bold text-xs shrink-0">
                {team?.name ? team.name[0].toUpperCase() : 'P'}
              </div>
              <div className="min-w-0">
                <p className="text-xs font-semibold text-slate-200 truncate">{team?.name || 'Competitor'}</p>
                <p className="text-[10px] text-slate-400 truncate">Participant Squad</p>
              </div>
            </div>
            <button
              onClick={handleSignOut}
              title="Sign Out"
              className="p-1.5 rounded-lg text-slate-400 hover:text-red-400 hover:bg-slate-800 transition-colors cursor-pointer"
            >
              <LogOut className="w-4 h-4" />
            </button>
          </div>
        </div>
      </aside>

      {/* MAIN CONTENT AREA */}
      <div className="flex-1 flex flex-col min-w-0 overflow-y-auto">
        {/* TOP BAR */}
        <header className="h-16 border-b border-slate-800 px-6 flex items-center justify-between bg-slate-900/60 backdrop-blur-md sticky top-0 z-30">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-xl bg-blue-500/10 border border-blue-500/20 text-blue-400">
              <ActiveHeaderIcon className="w-5 h-5" />
            </div>
            <div>
              <h1 className="text-sm font-bold text-slate-100 flex items-center gap-2">
                {viewTitles[currentView].title}
              </h1>
              <p className="text-[11px] text-slate-400">{viewTitles[currentView].subtitle}</p>
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
                    Event: {team.events?.title || 'Registered Event'}
                  </span>
                  <div className="flex items-center gap-2">
                    {team.join_code ? (
                      <button
                        onClick={() => copyTeamCode(team.join_code)}
                        className="flex items-center gap-1.5 px-3 py-1 rounded-lg bg-emerald-950/60 border border-emerald-700/60 text-emerald-300 font-mono text-xs font-bold cursor-pointer"
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
            <div className="bg-slate-900/80 border border-slate-800 rounded-2xl p-6 shadow-xl space-y-6">
              <div>
                <h3 className="text-base font-bold text-slate-100">Project Artifacts &amp; Architecture</h3>
                <p className="text-xs text-slate-400 mt-1">
                  Submitted links are anchored in the immutable audit log for double-blind jury evaluation.
                </p>
              </div>

              <form onSubmit={handleUpdateSubmission} className="space-y-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1">Project Title *</label>
                  <input
                    type="text"
                    required
                    value={subTitle}
                    onChange={(e) => setSubTitle(e.target.value)}
                    placeholder="e.g. NeuroGait AI"
                    className="w-full px-3.5 py-2.5 bg-slate-950 border border-slate-800 rounded-xl text-xs text-slate-100 focus:outline-none focus:ring-2 focus:ring-blue-500/50"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1">Short Description</label>
                  <textarea
                    rows={3}
                    value={subDesc}
                    onChange={(e) => setSubDesc(e.target.value)}
                    placeholder="Provide a high-level summary of your problem statement and technical architecture..."
                    className="w-full px-3.5 py-2.5 bg-slate-950 border border-slate-800 rounded-xl text-xs text-slate-100 focus:outline-none focus:ring-2 focus:ring-blue-500/50"
                  />
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-semibold text-slate-300 mb-1">Source Code Repository URL</label>
                    <input
                      type="url"
                      value={subRepo}
                      onChange={(e) => setSubRepo(e.target.value)}
                      placeholder="https://github.com/org/repo"
                      className="w-full px-3.5 py-2 bg-slate-950 border border-slate-800 rounded-xl text-xs text-slate-100"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-slate-300 mb-1">Live Demo / Video URL</label>
                    <input
                      type="url"
                      value={subDemo}
                      onChange={(e) => setSubDemo(e.target.value)}
                      placeholder="https://demo.app or https://youtu.be/..."
                      className="w-full px-3.5 py-2 bg-slate-950 border border-slate-800 rounded-xl text-xs text-slate-100"
                    />
                  </div>
                </div>

                <button
                  type="submit"
                  disabled={actionLoading}
                  className="px-5 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-500 text-white font-semibold text-xs shadow-md shadow-blue-600/30 transition-all cursor-pointer"
                >
                  {actionLoading ? 'Saving...' : 'Save & Lock Submission'}
                </button>
              </form>
            </div>
          )}

          {/* VIEW 3: PAYMENT */}
          {currentView === 'payment' && (
            <div className="bg-slate-900/80 border border-slate-800 rounded-2xl p-6 shadow-xl space-y-6">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-base font-bold text-slate-100">Direct-to-Organizer UPI Status</h3>
                  <p className="text-xs text-slate-400 mt-1">100% peer-to-peer verification with zero intermediate fees.</p>
                </div>
                <span
                  className={`text-xs font-bold px-3 py-1 rounded-full border ${
                    isPaid
                      ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40'
                      : isPendingUtr
                      ? 'bg-amber-500/20 text-amber-300 border-amber-500/40'
                      : 'bg-red-500/20 text-red-300 border-red-500/40'
                  }`}
                >
                  {isPaid ? 'Payment Verified' : isPendingUtr ? 'UTR Under Audit' : 'Payment Required'}
                </span>
              </div>

              {!isPaid && (
                <div className="p-4 bg-slate-950 rounded-xl border border-slate-800 space-y-4">
                  <p className="text-xs text-slate-300">
                    Your team requires event fee payment to complete registration.
                  </p>
                  <button
                    onClick={handleOpenUpiModalForActiveTeam}
                    className="px-4 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs flex items-center gap-2 cursor-pointer"
                  >
                    <QrCode className="w-4 h-4" />
                    <span>Generate Dynamic UPI QR &amp; Pay</span>
                  </button>
                </div>
              )}
            </div>
          )}

          {/* VIEW 4: AUTOPSY */}
          {currentView === 'autopsy' && (
            <div className="bg-slate-900/80 border border-slate-800 rounded-2xl p-6 shadow-xl space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-base font-bold text-slate-100 flex items-center gap-2">
                    <Sparkles className="w-5 h-5 text-indigo-400" />
                    <span>AI Loss Autopsy &amp; Gap Diagnostics</span>
                  </h3>
                  <p className="text-xs text-slate-400 mt-1">
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
                  className="px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-semibold text-xs cursor-pointer"
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
                  className="w-full py-2.5 px-4 rounded-xl bg-blue-600 hover:bg-blue-500 text-white font-semibold text-xs cursor-pointer"
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
                  Your team&apos;s submission metadata, scores, and loss autopsy are preserved in the immutable audit chain for tamper verification.
                </p>
              </div>
            </div>
          )}
        </main>
      </div>

      {/* Dynamic UPI Modal for Active Team */}
      {upiModalOpen && currentUpiQr && (
        <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl max-w-md w-full p-6 space-y-5 shadow-2xl relative">
            <button
              onClick={() => setUpiModalOpen(false)}
              className="absolute top-4 right-4 text-slate-400 hover:text-slate-200 p-1 cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>
            <div className="text-center space-y-1">
              <h3 className="text-base font-bold text-slate-100">Scan &amp; Pay via UPI</h3>
              <p className="text-xs text-slate-400">Direct to organizer with 0% platform fee.</p>
            </div>
            <div className="p-4 bg-white rounded-2xl text-center shadow-lg w-56 mx-auto">
              <img src={currentUpiQr.qrCodeDataUrl} alt="UPI QR" className="w-48 h-48 object-contain mx-auto" />
              <div className="text-slate-950 font-black text-sm mt-1">₹{Number(currentUpiQr.amount).toFixed(2)}</div>
            </div>
            <form onSubmit={handleSubmitUtr} className="space-y-3 pt-2 border-t border-slate-800">
              {utrError && <p className="text-xs text-red-400">{utrError}</p>}
              {utrSuccess && <p className="text-xs text-emerald-400">{utrSuccess}</p>}
              <div>
                <label className="text-xs font-semibold text-slate-300 block mb-1">Enter 12-Digit UTR Number</label>
                <input
                  type="text"
                  required
                  value={utrInput}
                  onChange={(e) => setUtrInput(e.target.value.replace(/[^0-9]/g, ''))}
                  maxLength={12}
                  placeholder="e.g. 427812984123"
                  className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-xs font-mono text-slate-100"
                />
              </div>
              <button
                type="submit"
                disabled={submittingUtr}
                className="w-full py-3 px-4 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs cursor-pointer"
              >
                {submittingUtr ? 'Verifying...' : 'Submit UTR &amp; Activate Team'}
              </button>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
