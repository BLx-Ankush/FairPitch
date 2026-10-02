'use client'

import React, { useState, useEffect, use } from 'react'
import Link from 'next/link'
import {
  QrCode,
  ArrowLeft,
  CheckCircle2,
  AlertCircle,
  Clock,
  IndianRupee,
  ShieldCheck,
  Users,
  Copy,
  Check,
  ExternalLink,
  Loader2,
  RefreshCw,
  Save,
  Sparkles,
  XCircle,
  HelpCircle,
} from 'lucide-react'
import { generateDynamicUpiQr } from '@/lib/payments/upi'

interface TeamRegistration {
  id: string
  name: string
  team_code: string
  join_code: string | null
  tagline: string | null
  status: string
  payment_status: 'unpaid' | 'pending_verification' | 'verified' | 'waived'
  utr_number: string | null
  amount_paid: number
  payment_submitted_at: string | null
  payment_verified_at: string | null
  created_at: string
  team_members: Array<{
    id: string
    role: string
    user_id: string
    profiles: {
      full_name: string
      email: string
    }
  }>
}

export default function EventUpiPaymentsPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id: eventId } = use(params)

  const [loading, setLoading] = useState(true)
  const [savingConfig, setSavingConfig] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [successMsg, setSuccessMsg] = useState<string | null>(null)
  const [copiedKey, setCopiedKey] = useState<string | null>(null)

  // UPI Config Form State
  const [registrationFee, setRegistrationFee] = useState<number>(0)
  const [upiId, setUpiId] = useState<string>('')
  const [upiName, setUpiName] = useState<string>('')
  const [autoVerifyUpi, setAutoVerifyUpi] = useState<boolean>(false)
  const [previewQrDataUrl, setPreviewQrDataUrl] = useState<string | null>(null)

  // Registrations state
  const [teams, setTeams] = useState<TeamRegistration[]>([])
  const [stats, setStats] = useState<any>(null)
  const [filter, setFilter] = useState<'all' | 'pending_verification' | 'verified' | 'unpaid'>('all')
  const [actionLoadingId, setActionLoadingId] = useState<string | null>(null)

  async function fetchAllData() {
    setLoading(true)
    setError(null)
    try {
      const [configRes, regRes] = await Promise.all([
        fetch(`/api/events/${eventId}/upi-config`),
        fetch(`/api/org/events/${eventId}/registrations`),
      ])

      if (configRes.ok) {
        const cData = await configRes.json()
        const ev = cData.event || {}
        setRegistrationFee(ev.registrationFee || 0)
        setUpiId(ev.upiId || '')
        setUpiName(ev.upiName || '')
        setAutoVerifyUpi(Boolean(ev.autoVerifyUpi))

        if (ev.upiId && ev.registrationFee > 0) {
          generatePreviewQr(ev.upiId, ev.upiName || 'Organizer', ev.registrationFee)
        }
      }

      if (regRes.ok) {
        const rData = await regRes.json()
        setTeams(rData.teams || [])
        setStats(rData.stats || null)
      }
    } catch (err: any) {
      setError(err.message || 'Failed to load registration and UPI data.')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    if (eventId) {
      fetchAllData()
    }
  }, [eventId])

  async function generatePreviewQr(vpa: string, name: string, fee: number) {
    if (!vpa || fee <= 0) {
      setPreviewQrDataUrl(null)
      return
    }
    try {
      const res = await generateDynamicUpiQr({
        vpa,
        payeeName: name || 'FairPitch Event Organizer',
        amount: fee,
        transactionRef: 'PREVIEW-TEST-SCAN',
        transactionNote: 'Sample Registration Fee',
      })
      setPreviewQrDataUrl(res.qrCodeDataUrl)
    } catch (qrErr) {
      console.error('Failed to generate preview QR:', qrErr)
    }
  }

  async function handleSaveConfig(e: React.FormEvent) {
    e.preventDefault()
    setSavingConfig(true)
    setError(null)
    setSuccessMsg(null)

    try {
      const res = await fetch(`/api/events/${eventId}/upi-config`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          registrationFee,
          upiId,
          upiName,
          autoVerifyUpi,
        }),
      })

      const data = await res.json()
      if (!res.ok) {
        throw new Error(data.error || 'Failed to update UPI settings')
      }

      setSuccessMsg('UPI account settings & registration fee updated successfully!')
      if (upiId && registrationFee > 0) {
        generatePreviewQr(upiId, upiName, registrationFee)
      } else {
        setPreviewQrDataUrl(null)
      }
      setTimeout(() => setSuccessMsg(null), 3000)
    } catch (err: any) {
      setError(err.message || 'Error updating settings')
    } finally {
      setSavingConfig(false)
    }
  }

  async function handleVerifyTeam(teamId: string, action: 'approve' | 'reject') {
    setActionLoadingId(teamId)
    setError(null)

    try {
      const res = await fetch(`/api/org/events/${eventId}/registrations/${teamId}/verify`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action }),
      })

      const data = await res.json()
      if (!res.ok) {
        throw new Error(data.error || 'Failed to update payment status')
      }

      await fetchAllData()
    } catch (err: any) {
      setError(err.message || 'Action failed')
    } finally {
      setActionLoadingId(null)
    }
  }

  function copyText(text: string, key: string) {
    navigator.clipboard.writeText(text)
    setCopiedKey(key)
    setTimeout(() => setCopiedKey(null), 2000)
  }

  const filteredTeams = teams.filter((t) => {
    if (filter === 'all') return true
    return t.payment_status === filter
  })

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-950 flex items-center justify-center text-slate-500">
        <Loader2 className="w-8 h-8 animate-spin text-emerald-500" />
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
            className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-slate-200 transition-colors"
          >
            <ArrowLeft className="w-4 h-4" />
          </Link>
          <div className="h-9 w-9 rounded-lg bg-emerald-600 flex items-center justify-center text-white shadow-md shadow-emerald-600/30">
            <QrCode className="w-5 h-5" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-sm font-bold text-slate-100">
                Dynamic UPI QR & Team Registrations
              </h1>
              <span className="text-[10px] px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-400 font-semibold border border-emerald-500/30">
                0% Gateway Fees
              </span>
            </div>
            <p className="text-[11px] text-slate-400">
              Direct-to-bank UPI transfers with automatic join code allocation
            </p>
          </div>
        </div>

        <button
          onClick={fetchAllData}
          className="p-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 transition-colors cursor-pointer"
          title="Refresh Registrations"
        >
          <RefreshCw className="w-4 h-4" />
        </button>
      </header>

      {/* Main Content */}
      <main className="flex-1 max-w-6xl w-full mx-auto px-6 py-8 space-y-8">
        {/* Alerts */}
        {error && (
          <div className="p-4 rounded-xl bg-red-950/60 border border-red-800/80 text-xs text-red-300 flex items-center gap-3">
            <AlertCircle className="w-5 h-5 shrink-0 text-red-400" />
            <span>{error}</span>
          </div>
        )}

        {successMsg && (
          <div className="p-4 rounded-xl bg-emerald-950/60 border border-emerald-800/80 text-xs text-emerald-300 flex items-center gap-3">
            <CheckCircle2 className="w-5 h-5 shrink-0 text-emerald-400" />
            <span>{successMsg}</span>
          </div>
        )}

        {/* Stats Summary Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 shadow-lg">
            <span className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider block">
              Total Direct Collections
            </span>
            <div className="mt-2 flex items-baseline gap-1 text-2xl font-black text-emerald-400">
              <span>₹{(stats?.totalCollectedAmount || 0).toLocaleString()}</span>
              <span className="text-xs text-slate-500 font-normal">INR</span>
            </div>
            <span className="text-[10px] text-slate-500 mt-1 block">
              Credited directly to your bank VPA
            </span>
          </div>

          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 shadow-lg">
            <span className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider block">
              Pending UTR Approvals
            </span>
            <div className="mt-2 flex items-baseline gap-2 text-2xl font-black text-amber-400">
              <span>{stats?.pendingVerificationTeams || 0}</span>
              {stats?.pendingVerificationTeams > 0 && (
                <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-amber-500/20 text-amber-400 border border-amber-500/30">
                  Action Required
                </span>
              )}
            </div>
            <span className="text-[10px] text-slate-500 mt-1 block">
              Awaiting your banking confirmation
            </span>
          </div>

          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 shadow-lg">
            <span className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider block">
              Verified / Joined Teams
            </span>
            <div className="mt-2 text-2xl font-black text-slate-100">
              {stats?.verifiedTeams || 0}
            </div>
            <span className="text-[10px] text-slate-500 mt-1 block">
              Join code unlocked & roster open
            </span>
          </div>

          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 shadow-lg">
            <span className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider block">
              Current Registration Fee
            </span>
            <div className="mt-2 text-2xl font-black text-indigo-400">
              {registrationFee === 0 ? 'Free' : `₹${registrationFee.toLocaleString()}`}
            </div>
            <span className="text-[10px] text-slate-500 mt-1 block">
              Per participating team
            </span>
          </div>
        </div>

        {/* UPI Setup & QR Preview Section */}
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-xl space-y-6">
          <div className="flex items-center justify-between border-b border-slate-800 pb-4">
            <div className="flex items-center gap-3">
              <div className="p-2.5 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-400">
                <QrCode className="w-5 h-5" />
              </div>
              <div>
                <h2 className="text-sm font-bold text-slate-100">
                  Organizer UPI Account & Fee Configuration
                </h2>
                <p className="text-[11px] text-slate-400">
                  Provide your UPI VPA to allocate dynamic, prefilled QR codes to registering teams
                </p>
              </div>
            </div>

            <span className="text-xs font-semibold text-slate-400">
              {registrationFee === 0 ? 'Free Event' : 'Paid Event'}
            </span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 items-start">
            {/* Form */}
            <form onSubmit={handleSaveConfig} className="md:col-span-2 space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="text-xs font-semibold text-slate-300 block mb-1.5">
                    Registration Fee per Team (₹ INR)
                  </label>
                  <div className="relative">
                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500 font-bold text-xs">
                      ₹
                    </span>
                    <input
                      type="number"
                      min="0"
                      step="1"
                      value={registrationFee}
                      onChange={(e) => setRegistrationFee(Number(e.target.value))}
                      placeholder="0 for Free Event"
                      className="w-full pl-8 pr-4 py-2 bg-slate-950 border border-slate-800 rounded-xl text-xs text-slate-100 focus:outline-hidden focus:border-emerald-500"
                    />
                  </div>
                  <span className="text-[10px] text-slate-500 mt-1 block">
                    Set to 0 if participation is free.
                  </span>
                </div>

                <div>
                  <label className="text-xs font-semibold text-slate-300 block mb-1.5">
                    Organizer UPI ID / VPA
                  </label>
                  <input
                    type="text"
                    value={upiId}
                    onChange={(e) => setUpiId(e.target.value)}
                    placeholder="e.g. hackathon@oksbi"
                    required={registrationFee > 0}
                    className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-xs text-slate-100 focus:outline-hidden focus:border-emerald-500 font-mono"
                  />
                  <span className="text-[10px] text-slate-500 mt-1 block">
                    Payments credit directly to this bank account.
                  </span>
                </div>
              </div>

              <div>
                <label className="text-xs font-semibold text-slate-300 block mb-1.5">
                  Organizer / Event Payee Display Name
                </label>
                <input
                  type="text"
                  value={upiName}
                  onChange={(e) => setUpiName(e.target.value)}
                  placeholder="e.g. Stanford AI Summit Organizers"
                  required={registrationFee > 0}
                  className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-xs text-slate-100 focus:outline-hidden focus:border-emerald-500"
                />
                <span className="text-[10px] text-slate-500 mt-1 block">
                  Displayed in participant UPI apps (GPay, PhonePe, Paytm).
                </span>
              </div>

              {/* Auto Verify Toggle */}
              <div className="p-3.5 bg-slate-950 rounded-xl border border-slate-800 flex items-center justify-between">
                <div>
                  <div className="text-xs font-semibold text-slate-200">
                    Auto-Approve Upon UTR Submission
                  </div>
                  <div className="text-[11px] text-slate-500">
                    Immediately unlocks the event join code when the participant enters a valid 12-digit UTR.
                  </div>
                </div>
                <input
                  type="checkbox"
                  checked={autoVerifyUpi}
                  onChange={(e) => setAutoVerifyUpi(e.target.checked)}
                  className="w-4 h-4 rounded text-emerald-600 focus:ring-emerald-500 cursor-pointer"
                />
              </div>

              <button
                type="submit"
                disabled={savingConfig}
                className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs shadow-lg shadow-emerald-600/30 transition-all cursor-pointer"
              >
                {savingConfig ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    <span>Saving Account Settings...</span>
                  </>
                ) : (
                  <>
                    <Save className="w-4 h-4" />
                    <span>Save UPI Account Settings</span>
                  </>
                )}
              </button>
            </form>

            {/* Live QR Preview */}
            <div className="bg-slate-950 border border-slate-800 rounded-xl p-5 text-center flex flex-col items-center justify-center space-y-3">
              <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400">
                Live Dynamic QR Preview
              </span>

              {previewQrDataUrl ? (
                <div className="space-y-2">
                  <div className="p-2 bg-white rounded-xl shadow-md inline-block">
                    <img
                      src={previewQrDataUrl}
                      alt="UPI Dynamic QR Preview"
                      className="w-40 h-40 object-contain mx-auto"
                    />
                  </div>
                  <div className="text-xs font-bold text-emerald-400">
                    ₹{registrationFee.toLocaleString()} INR
                  </div>
                  <div className="text-[10px] font-mono text-slate-400 truncate max-w-xs">
                    {upiId}
                  </div>
                  <p className="text-[10px] text-slate-500">
                    Test scan with GPay, PhonePe or Paytm to preview.
                  </p>
                </div>
              ) : (
                <div className="p-8 text-center text-xs text-slate-500">
                  <QrCode className="w-12 h-12 text-slate-700 mx-auto mb-2" />
                  <span>Configure a non-zero fee & UPI VPA to generate live QR</span>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Team Registrations & UTR Verification Desk */}
        <div className="space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div>
              <h2 className="text-sm font-bold text-slate-100 flex items-center gap-2">
                <Users className="w-4 h-4 text-emerald-400" />
                Team Registrations & UTR Approvals ({teams.length})
              </h2>
              <p className="text-xs text-slate-400">
                Verify incoming UPI UTR reference numbers and issue event join codes
              </p>
            </div>

            {/* Filter Tabs */}
            <div className="flex items-center gap-1.5 p-1 bg-slate-900 border border-slate-800 rounded-xl text-xs">
              <button
                onClick={() => setFilter('all')}
                className={`px-3 py-1 rounded-lg font-semibold transition-colors cursor-pointer ${
                  filter === 'all'
                    ? 'bg-slate-800 text-slate-100'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                All ({teams.length})
              </button>
              <button
                onClick={() => setFilter('pending_verification')}
                className={`px-3 py-1 rounded-lg font-semibold transition-colors cursor-pointer ${
                  filter === 'pending_verification'
                    ? 'bg-amber-500/20 text-amber-400 border border-amber-500/30'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                Pending ({teams.filter((t) => t.payment_status === 'pending_verification').length})
              </button>
              <button
                onClick={() => setFilter('verified')}
                className={`px-3 py-1 rounded-lg font-semibold transition-colors cursor-pointer ${
                  filter === 'verified'
                    ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                Verified ({teams.filter((t) => t.payment_status === 'verified').length})
              </button>
              <button
                onClick={() => setFilter('unpaid')}
                className={`px-3 py-1 rounded-lg font-semibold transition-colors cursor-pointer ${
                  filter === 'unpaid'
                    ? 'bg-red-500/20 text-red-400 border border-red-500/30'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                Unpaid ({teams.filter((t) => t.payment_status === 'unpaid').length})
              </button>
            </div>
          </div>

          <div className="bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden shadow-xl">
            {filteredTeams.length === 0 ? (
              <div className="p-8 text-center text-xs text-slate-400">
                No team registrations found matching this filter.
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs text-slate-300">
                  <thead className="bg-slate-950/60 border-b border-slate-800 text-[11px] uppercase tracking-wider text-slate-400">
                    <tr>
                      <th className="py-3.5 px-4 font-bold">Team Name</th>
                      <th className="py-3.5 px-4 font-bold">Team Lead</th>
                      <th className="py-3.5 px-4 font-bold">12-Digit UTR Number</th>
                      <th className="py-3.5 px-4 font-bold text-center">Status</th>
                      <th className="py-3.5 px-4 font-bold text-center">Join Code</th>
                      <th className="py-3.5 px-4 font-bold text-right">Verification Action</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-800/60 font-medium">
                    {filteredTeams.map((team) => {
                      const leadMember = team.team_members?.find((m) => m.role === 'lead')
                      const isPending = team.payment_status === 'pending_verification'
                      const isVerified = team.payment_status === 'verified'
                      const isUnpaid = team.payment_status === 'unpaid'
                      const isActionLoading = actionLoadingId === team.id

                      return (
                        <tr
                          key={team.id}
                          className="hover:bg-slate-800/40 transition-colors"
                        >
                          <td className="py-3.5 px-4">
                            <div className="font-bold text-slate-100">{team.name}</div>
                            {team.tagline && (
                              <div className="text-[11px] text-slate-500 truncate max-w-xs">
                                {team.tagline}
                              </div>
                            )}
                          </td>

                          <td className="py-3.5 px-4">
                            <div className="text-slate-200">
                              {leadMember?.profiles?.full_name || 'Team Lead'}
                            </div>
                            <div className="text-[10px] text-slate-500 font-mono">
                              {leadMember?.profiles?.email || 'N/A'}
                            </div>
                          </td>

                          <td className="py-3.5 px-4 font-mono">
                            {team.utr_number ? (
                              <div className="flex items-center gap-1.5">
                                <span className="text-indigo-300 font-bold bg-slate-950 px-2 py-0.5 rounded-md border border-slate-800">
                                  {team.utr_number}
                                </span>
                                <button
                                  onClick={() => copyText(team.utr_number!, `utr-${team.id}`)}
                                  className="text-slate-500 hover:text-slate-300 p-0.5 cursor-pointer"
                                  title="Copy UTR"
                                >
                                  {copiedKey === `utr-${team.id}` ? (
                                    <Check className="w-3 h-3 text-emerald-400" />
                                  ) : (
                                    <Copy className="w-3 h-3" />
                                  )}
                                </button>
                              </div>
                            ) : (
                              <span className="text-slate-600 italic">No UTR submitted</span>
                            )}
                          </td>

                          <td className="py-3.5 px-4 text-center">
                            {isVerified ? (
                              <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/30 text-[10px] font-bold">
                                <CheckCircle2 className="w-3 h-3" /> VERIFIED
                              </span>
                            ) : isPending ? (
                              <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-amber-500/10 text-amber-400 border border-amber-500/30 text-[10px] font-bold animate-pulse">
                                <Clock className="w-3 h-3" /> PENDING REVIEW
                              </span>
                            ) : (
                              <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-slate-800 text-slate-400 border border-slate-700 text-[10px] font-bold">
                                UNPAID
                              </span>
                            )}
                          </td>

                          <td className="py-3.5 px-4 text-center font-mono">
                            {isVerified && team.join_code ? (
                              <div className="flex items-center justify-center gap-1">
                                <span className="font-bold text-emerald-400 bg-emerald-950/40 px-2 py-0.5 rounded-md border border-emerald-800/60">
                                  {team.join_code}
                                </span>
                                <button
                                  onClick={() => copyText(team.join_code!, `join-${team.id}`)}
                                  className="text-slate-500 hover:text-slate-300 p-0.5 cursor-pointer"
                                  title="Copy Join Code"
                                >
                                  {copiedKey === `join-${team.id}` ? (
                                    <Check className="w-3 h-3 text-emerald-400" />
                                  ) : (
                                    <Copy className="w-3 h-3" />
                                  )}
                                </button>
                              </div>
                            ) : (
                              <span className="text-slate-600 text-[11px] italic">
                                Locked until verified
                              </span>
                            )}
                          </td>

                          <td className="py-3.5 px-4 text-right">
                            {isPending ? (
                              <div className="flex items-center justify-end gap-1.5">
                                <button
                                  onClick={() => handleVerifyTeam(team.id, 'approve')}
                                  disabled={isActionLoading}
                                  className="flex items-center gap-1 px-2.5 py-1 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white font-semibold text-[11px] shadow-sm transition-colors cursor-pointer"
                                >
                                  {isActionLoading ? (
                                    <Loader2 className="w-3 h-3 animate-spin" />
                                  ) : (
                                    <CheckCircle2 className="w-3 h-3" />
                                  )}
                                  <span>Verify & Unlock</span>
                                </button>
                                <button
                                  onClick={() => handleVerifyTeam(team.id, 'reject')}
                                  disabled={isActionLoading}
                                  className="flex items-center gap-1 px-2 py-1 rounded-lg bg-slate-800 hover:bg-red-950/60 text-slate-400 hover:text-red-300 font-semibold text-[11px] transition-colors cursor-pointer"
                                  title="Reject UTR"
                                >
                                  <XCircle className="w-3 h-3" />
                                </button>
                              </div>
                            ) : isUnpaid ? (
                              <button
                                onClick={() => handleVerifyTeam(team.id, 'approve')}
                                disabled={isActionLoading}
                                className="px-2.5 py-1 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 text-[11px] font-semibold transition-colors cursor-pointer"
                              >
                                Mark Paid Offline
                              </button>
                            ) : (
                              <span className="text-[10px] text-emerald-400/80 font-mono">
                                Verified {team.payment_verified_at ? new Date(team.payment_verified_at).toLocaleDateString() : ''}
                              </span>
                            )}
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      </main>
    </div>
  )
}
