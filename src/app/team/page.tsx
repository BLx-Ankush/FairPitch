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
} from 'lucide-react'
import { generateDynamicUpiQr, generateTransactionRef } from '@/lib/payments/upi'

export default function TeamWorkspacePage() {
  const router = useRouter()
  const [team, setTeam] = useState<any | null>(null)
  const [loading, setLoading] = useState(true)
  const [actionLoading, setActionLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [copied, setCopied] = useState(false)

  // Creation form state
  const [mode, setMode] = useState<'create' | 'join'>('create')
  const [name, setName] = useState('')
  const [tagline, setTagline] = useState('')
  const [track, setTrack] = useState('')
  const [joinCode, setJoinCode] = useState('')
  const [eventId, setEventId] = useState('')
  const [availableEvents, setAvailableEvents] = useState<any[]>([])

  // Dynamic UPI Payment Modal state
  const [upiModalOpen, setUpiModalOpen] = useState(false)
  const [currentUpiQr, setCurrentUpiQr] = useState<any>(null)
  const [targetTeamId, setTargetTeamId] = useState<string | null>(null)
  const [utrInput, setUtrInput] = useState('')
  const [submittingUtr, setSubmittingUtr] = useState(false)
  const [utrSuccess, setUtrSuccess] = useState<string | null>(null)
  const [utrError, setUtrError] = useState<string | null>(null)

  async function fetchMyTeam() {
    try {
      const res = await fetch('/api/team/my-team')
      if (res.ok) {
        const data = await res.json()
        setTeam(data.team)
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

      await fetchMyTeam()

      // If event requires payment, immediately open dynamic UPI QR modal
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

      await fetchMyTeam()
    } catch (err: any) {
      setError(err.message)
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
    await fetch('/api/auth/logout', { method: 'POST' })
    router.push('/login')
  }

  function copyTeamCode(code: string) {
    navigator.clipboard.writeText(code)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col">
      {/* Top Header */}
      <header className="border-b border-slate-800 bg-slate-900/60 backdrop-blur-md px-6 py-4 flex items-center justify-between sticky top-0 z-20">
        <div className="flex items-center gap-3">
          <div className="h-9 w-9 rounded-lg bg-blue-600 flex items-center justify-center text-white shadow-md shadow-blue-600/30">
            <Users className="w-5 h-5" />
          </div>
          <div>
            <h1 className="text-sm font-bold text-slate-100 flex items-center gap-2">
              Participant Team Workspace
              <span className="text-[10px] px-2 py-0.5 rounded-full bg-blue-500/20 text-blue-400 font-semibold border border-blue-500/30">
                Participant
              </span>
            </h1>
            <p className="text-[11px] text-slate-400">Team Roster & Direct UPI Verification</p>
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

      {/* Main Content */}
      <main className="flex-1 max-w-4xl w-full mx-auto px-6 py-8">
        {error && (
          <div className="mb-6 p-4 rounded-xl bg-red-950/40 border border-red-800/60 flex items-start gap-3 text-xs text-red-300">
            <AlertCircle className="w-4 h-4 text-red-400 shrink-0 mt-0.5" />
            <span>{error}</span>
          </div>
        )}

        {loading ? (
          <div className="py-20 flex flex-col items-center justify-center gap-2 text-slate-500">
            <Loader2 className="w-7 h-7 animate-spin text-indigo-500" />
            <span className="text-xs">Loading team workspace...</span>
          </div>
        ) : team ? (
          /* Active Team View */
          <div className="space-y-6">
            {/* Payment Status Notification Banners */}
            {team.payment_status === 'unpaid' && (
              <div className="bg-gradient-to-r from-amber-950/60 to-slate-900 border border-amber-600/40 rounded-2xl p-5 shadow-lg flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <span className="px-2 py-0.5 rounded-full bg-amber-500/20 text-amber-400 text-[10px] font-bold border border-amber-500/30">
                      Payment Required
                    </span>
                    <h3 className="text-sm font-bold text-slate-100">
                      Event Registration Fee Pending
                    </h3>
                  </div>
                  <p className="text-xs text-slate-400">
                    This event requires a team registration fee. Pay directly to the organizer via Dynamic UPI QR to unlock your Join Code and project submission portal.
                  </p>
                </div>
                <button
                  onClick={handleOpenUpiModalForActiveTeam}
                  className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs shadow-md shadow-emerald-600/30 transition-colors cursor-pointer shrink-0"
                >
                  <QrCode className="w-4 h-4" />
                  <span>Pay via UPI QR</span>
                </button>
              </div>
            )}

            {team.payment_status === 'pending_verification' && (
              <div className="bg-slate-900/90 border border-amber-500/40 rounded-2xl p-5 shadow-lg flex items-center gap-3">
                <Clock className="w-6 h-6 text-amber-400 shrink-0 animate-pulse" />
                <div>
                  <h4 className="text-xs font-bold text-slate-100 flex items-center gap-2">
                    Payment Submitted for Review
                    <span className="font-mono text-[10px] text-amber-300 bg-amber-950/60 px-2 py-0.5 rounded border border-amber-800/60">
                      UTR: {team.utr_number}
                    </span>
                  </h4>
                  <p className="text-[11px] text-slate-400 mt-0.5">
                    The organizer is reviewing your 12-digit transaction reference. Once confirmed, your official Event Join Code will be unlocked so your teammates can join.
                  </p>
                </div>
              </div>
            )}

            {/* Team Header Card */}
            <div className="bg-slate-900/80 border border-slate-800 rounded-2xl p-6 shadow-xl">
              <div className="flex items-center justify-between mb-3">
                <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">
                  Event: {team.events?.title}
                </span>

                <div className="flex items-center gap-2">
                  <span className="text-xs text-slate-400">
                    {team.join_code ? 'Join Code (Share with Teammates):' : 'Invite Code:'}
                  </span>
                  {team.join_code ? (
                    <button
                      onClick={() => copyTeamCode(team.join_code)}
                      className="flex items-center gap-1.5 px-3 py-1 rounded-lg bg-emerald-950/60 border border-emerald-700/60 text-emerald-300 font-mono text-xs font-bold hover:bg-emerald-900/60 transition-colors cursor-pointer"
                    >
                      <span>{team.join_code}</span>
                      <Copy className="w-3.5 h-3.5" />
                    </button>
                  ) : (
                    <span className="text-[11px] text-amber-400 italic bg-amber-950/40 px-2 py-0.5 rounded border border-amber-800/50">
                      Locked until payment verified
                    </span>
                  )}
                  {copied && <span className="text-[10px] text-emerald-400 font-medium">Copied!</span>}
                </div>
              </div>

              <h2 className="text-2xl font-bold text-slate-100">{team.name}</h2>
              {team.tagline && <p className="text-xs text-slate-400 mt-1 italic">{team.tagline}</p>}

              {team.track && (
                <div className="mt-3 inline-flex items-center gap-1.5 text-xs text-slate-300 bg-slate-950 px-2.5 py-1 rounded-lg border border-slate-800">
                  <span>Track: <strong>{team.track}</strong></span>
                </div>
              )}
            </div>

            {/* Submissions Card */}
            <div className="bg-slate-900/80 border border-slate-800 rounded-2xl p-6 shadow-xl flex items-start justify-between gap-4">
              <div className="flex-1">
                <div className="flex items-center gap-2.5 mb-2">
                  <div className="p-2 rounded-xl bg-indigo-500/10 text-indigo-400 border border-indigo-500/20">
                    <FileCode2 className="w-5 h-5" />
                  </div>
                  <div>
                    <h3 className="text-sm font-bold text-slate-100">Project Submission</h3>
                    <p className="text-[11px] text-slate-400">
                      Evaluated by peer-calibrated jury and AI Loss Autopsy
                    </p>
                  </div>
                </div>

                {team.submission ? (
                  <div className="mt-3 p-4 rounded-xl bg-slate-950 border border-slate-800 space-y-2 text-xs">
                    <div className="font-semibold text-slate-200 text-sm">
                      {team.submission.title}
                    </div>
                    {team.submission.description && (
                      <p className="text-slate-400 leading-relaxed">
                        {team.submission.description}
                      </p>
                    )}
                    <div className="flex items-center gap-4 pt-2">
                      {team.submission.repo_url && (
                        <a
                          href={team.submission.repo_url}
                          target="_blank"
                          rel="noreferrer"
                          className="flex items-center gap-1 text-indigo-400 hover:text-indigo-300 font-medium"
                        >
                          <GitBranch className="w-3.5 h-3.5" />
                          <span>Code Repository</span>
                        </a>
                      )}
                      {team.submission.demo_url && (
                        <a
                          href={team.submission.demo_url}
                          target="_blank"
                          rel="noreferrer"
                          className="flex items-center gap-1 text-emerald-400 hover:text-emerald-300 font-medium"
                        >
                          <ExternalLink className="w-3.5 h-3.5" />
                          <span>Live Demo URL</span>
                        </a>
                      )}
                    </div>
                  </div>
                ) : (
                  <p className="text-xs text-slate-500 mt-2">
                    No project submitted yet. Submit your repository and demo links before judging begins.
                  </p>
                )}
              </div>

              <Link
                href={`/team/${team.id}/submission`}
                className="px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-semibold text-xs transition-colors shrink-0"
              >
                {team.submission ? 'Update Submission' : 'Submit Project'}
              </Link>
            </div>

            {/* AI Loss Autopsy Link (Available Once Published) */}
            <div className="bg-slate-900/60 border border-slate-800 rounded-2xl p-6 flex items-center justify-between">
              <div>
                <h3 className="text-sm font-bold text-slate-100 flex items-center gap-2">
                  <Sparkles className="w-4 h-4 text-amber-400" />
                  Gemini AI Loss Autopsy
                </h3>
                <p className="text-xs text-slate-400">
                  Deficit math, gap analysis against the winner, and actionable fixes
                </p>
              </div>

              <Link
                href={`/team/${team.id}/autopsy`}
                className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold transition-colors"
              >
                View Autopsy
              </Link>
            </div>

            {/* Team Roster List */}
            <div className="bg-slate-900/80 border border-slate-800 rounded-2xl p-6 shadow-xl">
              <h3 className="text-sm font-bold text-slate-100 mb-4 flex items-center gap-2">
                <Users className="w-4 h-4 text-blue-400" />
                Team Roster ({team.members?.length || 0})
              </h3>

              <div className="space-y-2">
                {(team.members || []).map((m: any) => (
                  <div
                    key={m.id}
                    className="p-3 bg-slate-950 rounded-xl border border-slate-800 flex items-center justify-between text-xs"
                  >
                    <div>
                      <span className="font-semibold text-slate-200">
                        {m.fullName || 'Anonymous Member'}
                      </span>
                      <span className="text-[11px] text-slate-500 block">{m.email}</span>
                    </div>

                    <span className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full bg-slate-800 text-slate-400">
                      {m.role}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        ) : (
          /* Create or Join Team Selection View */
          <div className="max-w-md mx-auto bg-slate-900 border border-slate-800 rounded-2xl p-8 shadow-2xl">
            <div className="text-center mb-6">
              <h2 className="text-lg font-bold text-slate-100">Join or Create a Team</h2>
              <p className="text-xs text-slate-400 mt-1">
                Participate in hackathon evaluations with your project squad.
              </p>
            </div>

            <div className="flex rounded-xl bg-slate-950 p-1 mb-6 border border-slate-800">
              <button
                type="button"
                onClick={() => setMode('create')}
                className={`flex-1 text-xs font-semibold py-2 rounded-lg transition-all ${
                  mode === 'create'
                    ? 'bg-slate-800 text-white shadow-sm'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                Create Team
              </button>
              <button
                type="button"
                onClick={() => setMode('join')}
                className={`flex-1 text-xs font-semibold py-2 rounded-lg transition-all ${
                  mode === 'join'
                    ? 'bg-slate-800 text-white shadow-sm'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                Join with Code
              </button>
            </div>

            {/* Event Selector */}
            <div className="mb-4">
              <div className="flex items-center justify-between mb-1">
                <label className="text-xs font-semibold text-slate-300">
                  Select Event
                </label>
                {selectedEventFee > 0 ? (
                  <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/30">
                    ₹{selectedEventFee} Entry Fee (Direct UPI)
                  </span>
                ) : (
                  <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-blue-500/10 text-blue-400 border border-blue-500/30">
                    Free Registration
                  </span>
                )}
              </div>
              <select
                value={eventId || (availableEvents[0]?.id ?? 'e0000000-0000-0000-0000-000000000001')}
                onChange={(e) => setEventId(e.target.value)}
                className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-xs text-slate-100 focus:outline-hidden focus:border-indigo-500"
              >
                {availableEvents.length > 0 ? (
                  availableEvents.map((ev) => (
                    <option key={ev.id} value={ev.id}>
                      {ev.title} ({ev.status})
                    </option>
                  ))
                ) : (
                  <option value="e0000000-0000-0000-0000-000000000001">
                    HackNexis 2026 (registration)
                  </option>
                )}
              </select>
            </div>

            {mode === 'create' ? (
              <form onSubmit={handleCreateTeam} className="space-y-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1">
                    Team Name *
                  </label>
                  <input
                    type="text"
                    required
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="e.g. NeuroGait Pioneers"
                    className="w-full px-3.5 py-2 bg-slate-950 border border-slate-800 rounded-xl text-xs text-slate-100 focus:outline-hidden focus:border-indigo-500"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1">
                    Tagline (Optional)
                  </label>
                  <input
                    type="text"
                    value={tagline}
                    onChange={(e) => setTagline(e.target.value)}
                    placeholder="AI-powered cerebral palsy gait analysis"
                    className="w-full px-3.5 py-2 bg-slate-950 border border-slate-800 rounded-xl text-xs text-slate-100 focus:outline-hidden focus:border-indigo-500"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1">
                    Track / Category
                  </label>
                  <input
                    type="text"
                    value={track}
                    onChange={(e) => setTrack(e.target.value)}
                    placeholder="e.g. Healthcare & Neural AI"
                    className="w-full px-3.5 py-2 bg-slate-950 border border-slate-800 rounded-xl text-xs text-slate-100 focus:outline-hidden focus:border-indigo-500"
                  />
                </div>

                <button
                  type="submit"
                  disabled={actionLoading}
                  className="w-full py-2.5 px-4 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-semibold text-xs shadow-lg shadow-indigo-600/30 transition-all cursor-pointer flex items-center justify-center gap-2"
                >
                  {actionLoading ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      <span>Creating Team...</span>
                    </>
                  ) : (
                    <>
                      <Plus className="w-4 h-4" />
                      <span>Create Team</span>
                    </>
                  )}
                </button>
              </form>
            ) : (
              <form onSubmit={handleJoinTeam} className="space-y-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1">
                    Event Join Code *
                  </label>
                  <input
                    type="text"
                    required
                    value={joinCode}
                    onChange={(e) => setJoinCode(e.target.value)}
                    placeholder="e.g. TEAM-A7K2"
                    className="w-full px-3.5 py-2 bg-slate-950 border border-slate-800 rounded-xl text-xs text-slate-100 font-mono uppercase focus:outline-hidden focus:border-indigo-500"
                  />
                  <span className="text-[10px] text-slate-500 mt-1 block">
                    Get this code from your team lead after their registration is verified.
                  </span>
                </div>

                <button
                  type="submit"
                  disabled={actionLoading}
                  className="w-full py-2.5 px-4 rounded-xl bg-slate-800 hover:bg-slate-700 text-white font-semibold text-xs transition-colors cursor-pointer flex items-center justify-center gap-2"
                >
                  {actionLoading ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      <span>Joining...</span>
                    </>
                  ) : (
                    <>
                      <KeyRound className="w-4 h-4" />
                      <span>Join Team</span>
                    </>
                  )}
                </button>
              </form>
            )}
          </div>
        )}
      </main>

      {/* Dynamic UPI Payment Modal */}
      {upiModalOpen && currentUpiQr && (
        <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl max-w-md w-full p-6 space-y-5 shadow-2xl relative animate-in fade-in zoom-in-95">
            <button
              onClick={() => setUpiModalOpen(false)}
              className="absolute top-4 right-4 text-slate-400 hover:text-slate-200 p-1 cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>

            <div className="text-center space-y-1">
              <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-[10px] font-bold uppercase tracking-wider">
                <QrCode className="w-3.5 h-3.5" /> Direct Organizer UPI Transfer
              </div>
              <h3 className="text-base font-bold text-slate-100">
                Complete Team Registration Payment
              </h3>
              <p className="text-xs text-slate-400">
                Scan with GPay, PhonePe, Paytm, or BHIM. 100% direct to organizer with 0% platform fees.
              </p>
            </div>

            {/* QR Code Card */}
            <div className="p-4 bg-white rounded-2xl text-center shadow-lg w-56 mx-auto">
              <img
                src={currentUpiQr.qrCodeDataUrl}
                alt="UPI Dynamic QR"
                className="w-48 h-48 object-contain mx-auto"
              />
              <div className="text-slate-950 font-black text-sm mt-1">
                ₹{Number(currentUpiQr.amount).toFixed(2)} INR
              </div>
            </div>

            <div className="p-3 bg-slate-950 rounded-xl border border-slate-800 space-y-1.5 text-xs">
              <div className="flex justify-between text-slate-400">
                <span>Payee Name:</span>
                <span className="font-semibold text-slate-200">{currentUpiQr.payeeName}</span>
              </div>
              <div className="flex justify-between text-slate-400">
                <span>Payee UPI ID:</span>
                <span className="font-mono text-emerald-400 font-semibold">{currentUpiQr.vpa}</span>
              </div>
              <div className="flex justify-between text-slate-400">
                <span>Ref ID:</span>
                <span className="font-mono text-slate-300">{currentUpiQr.transactionRef}</span>
              </div>
            </div>

            {/* Mobile Pay Link */}
            <a
              href={currentUpiQr.upiUri}
              className="w-full py-2.5 px-4 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-bold text-center block transition-colors"
            >
              Open in UPI App (GPay / PhonePe / Paytm)
            </a>

            {/* UTR Submission Form */}
            <form onSubmit={handleSubmitUtr} className="space-y-3 pt-2 border-t border-slate-800">
              <div>
                <label className="text-xs font-semibold text-slate-300 block mb-1">
                  Enter 12-Digit UPI Reference / UTR Number *
                </label>
                <input
                  type="text"
                  required
                  value={utrInput}
                  onChange={(e) => setUtrInput(e.target.value)}
                  placeholder="e.g. 427812984123"
                  className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-xs text-slate-100 font-mono focus:outline-hidden focus:border-emerald-500"
                />
                <span className="text-[10px] text-slate-500 mt-1 block">
                  Found in your UPI transaction receipt under "UPI Ref No" or "UTR".
                </span>
              </div>

              {utrError && (
                <div className="p-2.5 bg-red-950/60 border border-red-900/60 text-xs text-red-300 rounded-xl">
                  {utrError}
                </div>
              )}

              {utrSuccess && (
                <div className="p-2.5 bg-emerald-950/60 border border-emerald-900/60 text-xs text-emerald-300 rounded-xl flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
                  <span>{utrSuccess}</span>
                </div>
              )}

              <button
                type="submit"
                disabled={submittingUtr}
                className="w-full py-3 px-4 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs shadow-lg shadow-emerald-600/30 flex items-center justify-center gap-2 cursor-pointer transition-colors"
              >
                {submittingUtr ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    <span>Verifying UTR Reference...</span>
                  </>
                ) : (
                  <>
                    <CheckCircle2 className="w-4 h-4" />
                    <span>Submit UTR & Activate Registration</span>
                  </>
                )}
              </button>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
