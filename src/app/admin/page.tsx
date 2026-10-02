'use client'

import React, { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import {
  ShieldCheck,
  Building2,
  Users,
  CheckCircle,
  XCircle,
  LogOut,
  Calendar,
  Loader2,
  AlertCircle
} from 'lucide-react'

interface Organizer {
  id: string
  full_name: string
  email: string
  organizer_approval_status: string
  created_at: string
}

export default function AdminDashboardPage() {
  const router = useRouter()
  const [organizers, setOrganizers] = useState<Organizer[]>([])
  const [loading, setLoading] = useState(true)
  const [actionLoading, setActionLoading] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  async function fetchOrganizers() {
    try {
      const res = await fetch('/api/admin/organizers')
      if (res.ok) {
        const data = await res.json()
        setOrganizers(data.organizers || [])
      } else {
        const err = await res.json()
        setError(err.error || 'Failed to fetch organizers')
      }
    } catch {
      setError('Error communicating with server')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchOrganizers()
  }, [])

  async function handleApprove(userId: string) {
    setActionLoading(userId)
    try {
      const res = await fetch('/api/admin/organizers/approve', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId }),
      })
      if (res.ok) {
        await fetchOrganizers()
      } else {
        const data = await res.json()
        alert(data.error || 'Failed to approve organizer')
      }
    } finally {
      setActionLoading(null)
    }
  }

  async function handleReject(userId: string) {
    if (!confirm('Are you sure you want to decline this organizer application?')) return
    setActionLoading(userId)
    try {
      const res = await fetch('/api/admin/organizers/reject', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId }),
      })
      if (res.ok) {
        await fetchOrganizers()
      } else {
        const data = await res.json()
        alert(data.error || 'Failed to reject organizer')
      }
    } finally {
      setActionLoading(null)
    }
  }

  async function handleSignOut() {
    await fetch('/api/auth/logout', { method: 'POST' })
    router.push('/login')
  }

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col">
      {/* Header */}
      <header className="border-b border-slate-800 bg-slate-900/60 backdrop-blur-md px-6 py-4 flex items-center justify-between sticky top-0 z-20">
        <div className="flex items-center gap-3">
          <div className="h-9 w-9 rounded-lg bg-indigo-600 flex items-center justify-center text-white shadow-md shadow-indigo-600/30">
            <Building2 className="w-5 h-5" />
          </div>
          <div>
            <h1 className="text-sm font-bold text-slate-100 flex items-center gap-2">
              Institution Administration
              <span className="text-[10px] px-2 py-0.5 rounded-full bg-indigo-500/20 text-indigo-400 font-semibold border border-indigo-500/30">
                Tenant Portal
              </span>
            </h1>
            <p className="text-[11px] text-slate-400">FairPitch Multi-Tenant Governance</p>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <Link
            href="/org"
            className="text-xs px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 transition-colors"
          >
            Organizer View
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

      {/* Main Content */}
      <main className="flex-1 max-w-6xl w-full mx-auto px-6 py-8">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
          <div className="bg-slate-900/80 border border-slate-800 rounded-2xl p-5 shadow-lg">
            <div className="flex items-center justify-between text-slate-400 mb-2">
              <span className="text-xs font-medium">Pending Approvals</span>
              <Users className="w-4 h-4 text-amber-400" />
            </div>
            <div className="text-2xl font-bold text-slate-100">
              {organizers.filter(o => o.organizer_approval_status === 'pending').length}
            </div>
            <p className="text-[11px] text-slate-500 mt-1">Organizers awaiting admin verification</p>
          </div>

          <div className="bg-slate-900/80 border border-slate-800 rounded-2xl p-5 shadow-lg">
            <div className="flex items-center justify-between text-slate-400 mb-2">
              <span className="text-xs font-medium">Approved Organizers</span>
              <CheckCircle className="w-4 h-4 text-emerald-400" />
            </div>
            <div className="text-2xl font-bold text-slate-100">
              {organizers.filter(o => o.organizer_approval_status === 'approved').length}
            </div>
            <p className="text-[11px] text-slate-500 mt-1">Active hackathon managers</p>
          </div>

          <div className="bg-slate-900/80 border border-slate-800 rounded-2xl p-5 shadow-lg">
            <div className="flex items-center justify-between text-slate-400 mb-2">
              <span className="text-xs font-medium">Platform Fee</span>
              <Calendar className="w-4 h-4 text-indigo-400" />
            </div>
            <div className="text-2xl font-bold text-slate-100">&#8377;5 <span className="text-xs font-normal text-slate-400">/ participant</span></div>
            <p className="text-[11px] text-slate-500 mt-1">Metered billing upon event publication</p>
          </div>
        </div>

        {/* Organizer Verification Management */}
        <div className="bg-slate-900/80 border border-slate-800 rounded-2xl p-6 shadow-xl">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h2 className="text-base font-semibold text-slate-100">
                Organizer Applications & Roster
              </h2>
              <p className="text-xs text-slate-400">
                Approve or revoke organizer permissions in compliance with institutional judging policies.
              </p>
            </div>
          </div>

          {error && (
            <div className="p-3 mb-4 rounded-lg bg-red-950/40 border border-red-800/60 text-xs text-red-300 flex items-center gap-2">
              <AlertCircle className="w-4 h-4 text-red-400" />
              <span>{error}</span>
            </div>
          )}

          {loading ? (
            <div className="py-12 flex flex-col items-center gap-2 text-slate-500">
              <Loader2 className="w-6 h-6 animate-spin text-indigo-500" />
              <span className="text-xs">Loading organizer roster...</span>
            </div>
          ) : organizers.length === 0 ? (
            <div className="py-12 text-center text-xs text-slate-500">
              No organizer registrations found for your institution yet.
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead>
                  <tr className="border-b border-slate-800 text-slate-400">
                    <th className="pb-3 font-semibold">Organizer</th>
                    <th className="pb-3 font-semibold">Email</th>
                    <th className="pb-3 font-semibold">Registered</th>
                    <th className="pb-3 font-semibold">Status</th>
                    <th className="pb-3 font-semibold text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/60">
                  {organizers.map((org) => (
                    <tr key={org.id} className="hover:bg-slate-850/30 transition-colors">
                      <td className="py-3.5 font-medium text-slate-200">
                        {org.full_name}
                      </td>
                      <td className="py-3.5 text-slate-400">
                        {org.email}
                      </td>
                      <td className="py-3.5 text-slate-500">
                        {new Date(org.created_at).toLocaleDateString()}
                      </td>
                      <td className="py-3.5">
                        <span
                          className={`px-2 py-0.5 rounded-full text-[10px] font-semibold border ${
                            org.organizer_approval_status === 'approved'
                              ? 'bg-emerald-950/40 text-emerald-400 border-emerald-800/60'
                              : org.organizer_approval_status === 'pending'
                              ? 'bg-amber-950/40 text-amber-400 border-amber-800/60'
                              : 'bg-red-950/40 text-red-400 border-red-800/60'
                          }`}
                        >
                          {org.organizer_approval_status}
                        </span>
                      </td>
                      <td className="py-3.5 text-right space-x-2">
                        {org.organizer_approval_status === 'pending' && (
                          <>
                            <button
                              onClick={() => handleApprove(org.id)}
                              disabled={actionLoading === org.id}
                              className="px-2.5 py-1 rounded-md bg-emerald-600 hover:bg-emerald-500 text-white font-medium text-[11px] transition-colors disabled:opacity-50 cursor-pointer"
                            >
                              Approve
                            </button>
                            <button
                              onClick={() => handleReject(org.id)}
                              disabled={actionLoading === org.id}
                              className="px-2.5 py-1 rounded-md bg-slate-800 hover:bg-red-900/60 text-red-300 font-medium text-[11px] transition-colors disabled:opacity-50 cursor-pointer"
                            >
                              Decline
                            </button>
                          </>
                        )}
                        {org.organizer_approval_status === 'approved' && (
                          <button
                            onClick={() => handleReject(org.id)}
                            disabled={actionLoading === org.id}
                            className="px-2.5 py-1 rounded-md bg-slate-800 hover:bg-red-900/50 text-slate-400 hover:text-red-300 font-medium text-[11px] transition-colors cursor-pointer"
                          >
                            Revoke
                          </button>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </main>
    </div>
  )
}
