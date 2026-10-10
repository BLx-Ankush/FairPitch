'use client'

import React, { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import {
  ShieldCheck,
  Building2,
  Users,
  CheckCircle2,
  XCircle,
  LogOut,
  Calendar,
  Loader2,
  AlertCircle,
  ExternalLink,
  Lock,
  Copy,
  Check,
  ArrowRight,
  TrendingUp,
  Clock,
  Sparkles,
  RefreshCw,
  Award,
  ChevronRight,
  FileCheck2,
  DollarSign,
  LayoutDashboard,
  CalendarDays,
  UserCheck,
  Scale,
  BarChart3,
  FileText,
  CreditCard,
  Settings,
  Bell,
  Search,
  Filter,
  SlidersHorizontal,
  ChevronDown
} from 'lucide-react'
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  Cell
} from 'recharts'

interface EventTimeline {
  draft: { date: string; completed: boolean; active?: boolean }
  open: { date: string; completed: boolean; active?: boolean }
  judging: { date: string; completed: boolean; active?: boolean }
  review: { date: string; completed: boolean; active?: boolean }
  published: { date: string; completed: boolean; active?: boolean }
}

interface AdminEvent {
  id: string
  title: string
  status: string
  timeline: EventTimeline
  merkleRoot: string
  chainVerified: boolean
  totalBlocks: number
}

interface JudgeProgress {
  id: string
  name: string
  email: string
  assignedCount: number
  scoredCount: number
  completionPct: number
}

interface PendingOrganizer {
  id: string
  fullName: string
  email: string
  appliedAt: string
}

interface EditRequest {
  id: string
  judgeName: string
  teamName: string
  reason: string
  createdAt: string
}

interface ReviewRequest {
  id: string
  teamName: string
  reason: string
  status: string
  createdAt: string
}

interface DashboardData {
  institution: {
    id: string
    name: string
  }
  events: AdminEvent[]
  registrations: {
    totalTeams: number
    totalParticipants: number
    pendingApprovals: number
    trackBreakdown: { track: string; teams: number }[]
  }
  judgesProgress: JudgeProgress[]
  approvalsQueue: {
    pendingOrganizers: PendingOrganizer[]
    editRequests: EditRequest[]
    reviewRequests: ReviewRequest[]
  }
  billingSummary: {
    totalCollected: number
    currency: string
    verifiedCount: number
    pendingCount: number
    feePerTeam: number
  }
}

type AdminNavView =
  | 'overview'
  | 'timeline'
  | 'organizers'
  | 'judging'
  | 'analytics'
  | 'disputes'
  | 'ledger'
  | 'billing'
  | 'settings'

export default function AdminDashboardPage() {
  const router = useRouter()
  const [data, setData] = useState<DashboardData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [actionLoading, setActionLoading] = useState<string | null>(null)
  const [currentView, setCurrentView] = useState<AdminNavView>('overview')
  const [activeQueueTab, setActiveQueueTab] = useState<'organizers' | 'edits' | 'reviews'>('organizers')
  const [copiedRoot, setCopiedRoot] = useState(false)
  const [toastMessage, setToastMessage] = useState<string | null>(null)
  const [isClient, setIsClient] = useState(false)

  useEffect(() => {
    setIsClient(true)
    fetchDashboardData()
  }, [])

  function showToast(msg: string) {
    setToastMessage(msg)
    setTimeout(() => setToastMessage(null), 4000)
  }

  async function fetchDashboardData() {
    setLoading(true)
    setError(null)
    try {
      const res = await fetch('/api/admin/dashboard')
      if (res.ok) {
        const json = await res.json()
        setData(json)
      } else {
        const err = await res.json().catch(() => ({}))
        if (res.status === 401 || res.status === 403) {
          router.push('/auth?role=admin')
          return
        }
        setError(err.error || 'Failed to load institution administration data')
      }
    } catch {
      setError('Unable to reach server. Please check your network connection.')
    } finally {
      setLoading(false)
    }
  }

  async function handleApproveOrganizer(userId: string) {
    setActionLoading(userId)
    try {
      const res = await fetch('/api/admin/organizers/approve', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId }),
      })
      if (res.ok) {
        showToast('Organizer approved successfully!')
        await fetchDashboardData()
      } else {
        const d = await res.json().catch(() => ({}))
        showToast(d.error || 'Failed to approve organizer')
      }
    } catch {
      showToast('Network error while approving organizer')
    } finally {
      setActionLoading(null)
    }
  }

  async function handleRejectOrganizer(userId: string) {
    if (!confirm('Are you sure you want to decline this organizer application?')) return
    setActionLoading(userId)
    try {
      const res = await fetch('/api/admin/organizers/reject', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId }),
      })
      if (res.ok) {
        showToast('Organizer application declined')
        await fetchDashboardData()
      } else {
        const d = await res.json().catch(() => ({}))
        showToast(d.error || 'Failed to decline organizer')
      }
    } catch {
      showToast('Network error while declining organizer')
    } finally {
      setActionLoading(null)
    }
  }

  async function handleSignOut() {
    await fetch('/api/auth/logout', { method: 'POST' }).catch(() => {})
    router.push('/auth?role=admin')
  }

  function handleCopyMerkleRoot(root: string) {
    navigator.clipboard.writeText(root)
    setCopiedRoot(true)
    setTimeout(() => setCopiedRoot(false), 2000)
  }

  const primaryEvent = data?.events?.[0]
  const isReviewOrPublished = primaryEvent?.status === 'review' || primaryEvent?.status === 'published'
  const totalPendingApprovals =
    (data?.approvalsQueue.pendingOrganizers.length || 0) + (data?.registrations.pendingApprovals || 0)

  const chartColors = ['#6366f1', '#10b981', '#f59e0b', '#ec4899', '#8b5cf6']

  const navMenuItems = [
    {
      group: 'MAIN MENU',
      items: [
        { id: 'overview' as AdminNavView, label: 'Dashboard Overview', icon: LayoutDashboard },
        { id: 'timeline' as AdminNavView, label: 'Event Stage Timeline', icon: CalendarDays },
        {
          id: 'organizers' as AdminNavView,
          label: 'Organizer Vetting',
          icon: UserCheck,
          badge: data?.approvalsQueue.pendingOrganizers.length
            ? `${data.approvalsQueue.pendingOrganizers.length}`
            : undefined,
          badgeColor: 'bg-amber-500/20 text-amber-300 border-amber-500/30',
        },
        { id: 'judging' as AdminNavView, label: 'Judging Progress', icon: Scale },
        { id: 'analytics' as AdminNavView, label: 'Track Distribution', icon: BarChart3 },
      ],
    },
    {
      group: 'GOVERNANCE & FINANCE',
      items: [
        {
          id: 'disputes' as AdminNavView,
          label: 'Approvals & Tickets',
          icon: FileText,
          badge: totalPendingApprovals > 0 ? `${totalPendingApprovals}` : undefined,
          badgeColor: 'bg-indigo-500/20 text-indigo-300 border-indigo-500/30',
        },
        { id: 'ledger' as AdminNavView, label: 'Cryptographic Ledger', icon: ShieldCheck },
        { id: 'billing' as AdminNavView, label: 'Metered Platform Tariff', icon: CreditCard },
      ],
    },
    {
      group: 'SYSTEM',
      items: [
        { id: 'settings' as AdminNavView, label: 'Tenant Governance & DPDP', icon: Settings },
      ],
    },
  ]

  const viewTitles: Record<AdminNavView, { title: string; subtitle: string; icon: any }> = {
    overview: {
      title: 'Institutional Overview',
      subtitle: 'Tenant KPIs, pipeline velocity and multi-tenant security status',
      icon: LayoutDashboard,
    },
    timeline: {
      title: 'Event Stage Progression',
      subtitle: 'Forward-only lifecycle enforcement across all registered hackathons',
      icon: CalendarDays,
    },
    organizers: {
      title: 'Organizer Vetting & Roster',
      subtitle: 'Approve or revoke organizer permissions in compliance with institutional judging policy',
      icon: UserCheck,
    },
    judging: {
      title: 'Judging Panel Progress (Blind)',
      subtitle: 'Real-time completion telemetry per judge with absolute scores sealed',
      icon: Scale,
    },
    analytics: {
      title: 'Registration & Track Analytics',
      subtitle: 'Participant enrollment breakdown and track distribution across events',
      icon: BarChart3,
    },
    disputes: {
      title: 'Approvals & Dispute Tickets',
      subtitle: 'Manage score revision requests, organizer applications, and participant tickets',
      icon: FileText,
    },
    ledger: {
      title: 'Cryptographic Audit Trail',
      subtitle: 'SHA-256 Merkle root verification and tamper-evident sealed blocks',
      icon: ShieldCheck,
    },
    billing: {
      title: 'Metered Platform Tariff',
      subtitle: 'Settlement tracking for metered participation fees (₹500 / team)',
      icon: CreditCard,
    },
    settings: {
      title: 'Tenant Governance & DPDP 2023',
      subtitle: 'Multi-tenant statutory data protection, key management, and institutional profile',
      icon: Settings,
    },
  }

  const ActiveHeaderIcon = viewTitles[currentView].icon

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex font-sans antialiased">
      {/* Toast Notification */}
      {toastMessage && (
        <div
          role="alert"
          className="fixed bottom-6 right-6 z-50 bg-slate-900 border border-indigo-500/50 text-slate-100 px-4 py-3 rounded-xl shadow-2xl flex items-center gap-3 animate-fade-in"
        >
          <Sparkles className="w-5 h-5 text-indigo-400" />
          <span className="text-xs font-medium">{toastMessage}</span>
        </div>
      )}

      {/* PROFESSIONAL LEFT SIDEBAR */}
      <aside className="w-64 bg-slate-900/90 border-r border-slate-800 shrink-0 flex flex-col justify-between sticky top-0 h-screen z-40 backdrop-blur-md">
        <div>
          {/* Brand & Institution Header */}
          <div className="p-5 border-b border-slate-800/80 flex items-center gap-3">
            <div className="h-10 w-10 rounded-xl bg-gradient-to-br from-indigo-500 to-indigo-700 flex items-center justify-center text-white shadow-lg shadow-indigo-600/30">
              <Building2 className="w-5 h-5" />
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-1.5">
                <span className="text-sm font-bold text-slate-100 truncate">FairPitch</span>
                <span className="text-[10px] px-1.5 py-0.2 rounded font-semibold bg-indigo-500/20 text-indigo-400 border border-indigo-500/30">
                  Admin
                </span>
              </div>
              <p className="text-[11px] text-slate-400 truncate">
                {data?.institution?.name || 'Institution Admin'}
              </p>
            </div>
          </div>

          {/* Navigation Links */}
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
                          ? 'bg-indigo-600 text-white shadow-sm shadow-indigo-600/30 font-semibold'
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
              <div className="w-7 h-7 rounded-lg bg-indigo-500/20 text-indigo-400 flex items-center justify-center font-bold text-xs">
                A
              </div>
              <div className="min-w-0">
                <p className="text-xs font-semibold text-slate-200 truncate">Tenant Admin</p>
                <p className="text-[10px] text-slate-500 truncate">Governance Node</p>
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
            <div className="p-2 rounded-lg bg-slate-800 text-indigo-400">
              <ActiveHeaderIcon className="w-5 h-5" />
            </div>
            <div>
              <h1 className="text-sm font-bold text-slate-100 flex items-center gap-2">
                {viewTitles[currentView].title}
                <span className="text-[10px] px-2 py-0.5 rounded-full bg-emerald-500/15 text-emerald-400 font-semibold border border-emerald-500/30">
                  {data?.institution?.name || 'Assigned Institution'}
                </span>
              </h1>
              <p className="text-xs text-slate-400">{viewTitles[currentView].subtitle}</p>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <Link
              href="/verify"
              className="hidden md:flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-lg bg-slate-800/80 hover:bg-slate-700 text-slate-300 border border-slate-700/60 transition-colors"
            >
              <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" />
              <span>Public Ledger</span>
            </Link>

            <Link
              href="/org"
              className="text-xs px-3 py-1.5 rounded-lg bg-indigo-600/20 hover:bg-indigo-600/30 text-indigo-300 border border-indigo-500/30 transition-colors"
            >
              Switch to Organizer View
            </Link>

            {/* Notification Bell */}
            <button
              onClick={() => setCurrentView('disputes')}
              className="relative p-2 rounded-lg bg-slate-800/80 hover:bg-slate-700 text-slate-400 hover:text-slate-100 transition-colors cursor-pointer"
            >
              <Bell className="w-4 h-4" />
              {totalPendingApprovals > 0 && (
                <span className="absolute top-1 right-1 w-2 h-2 rounded-full bg-amber-400 animate-pulse" />
              )}
            </button>
          </div>
        </header>

        {/* WORKSPACE BODY */}
        <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 py-8 space-y-8">
          {error && (
            <div
              role="alert"
              className="p-4 rounded-xl bg-red-950/40 border border-red-800/60 text-xs text-red-200 flex items-center justify-between shadow-lg"
            >
              <div className="flex items-center gap-3">
                <AlertCircle className="w-5 h-5 text-red-400 shrink-0" />
                <span>{error}</span>
              </div>
              <button
                onClick={fetchDashboardData}
                className="flex items-center gap-1.5 px-3 py-1 bg-red-900/50 hover:bg-red-900 text-red-100 rounded-md font-medium text-xs transition-colors cursor-pointer"
              >
                <RefreshCw className="w-3.5 h-3.5" />
                <span>Retry</span>
              </button>
            </div>
          )}

          {loading && (
            <div className="space-y-6 animate-pulse">
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                {[...Array(4)].map((_, i) => (
                  <div key={i} className="h-28 bg-slate-900/60 border border-slate-800 rounded-2xl p-5" />
                ))}
              </div>
              <div className="h-32 bg-slate-900/60 border border-slate-800 rounded-2xl" />
              <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                <div className="lg:col-span-2 h-80 bg-slate-900/60 border border-slate-800 rounded-2xl" />
                <div className="h-80 bg-slate-900/60 border border-slate-800 rounded-2xl" />
              </div>
            </div>
          )}

          {!loading && data && (
            <>
              {/* VIEW 1: OVERVIEW */}
              {currentView === 'overview' && (
                <div className="space-y-8">
                  {/* KPI Row */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                    <div
                      onClick={() => setCurrentView('analytics')}
                      className="bg-slate-900/80 border border-slate-800/80 rounded-2xl p-5 shadow-lg relative overflow-hidden group hover:border-slate-700 transition-all cursor-pointer"
                    >
                      <div className="flex items-center justify-between text-slate-400 mb-2">
                        <span className="text-xs font-semibold uppercase tracking-wider">Registered Teams</span>
                        <div className="p-2 rounded-lg bg-indigo-500/10 text-indigo-400">
                          <Users className="w-4 h-4" />
                        </div>
                      </div>
                      <div className="text-2xl font-bold text-slate-100">{data.registrations.totalTeams}</div>
                      <p className="text-xs text-slate-400 mt-1 flex items-center gap-1.5">
                        <span className="text-emerald-400 font-medium">{data.registrations.totalParticipants}</span>
                        <span>participants enrolled</span>
                      </p>
                    </div>

                    <div
                      onClick={() => setCurrentView('organizers')}
                      className="bg-slate-900/80 border border-slate-800/80 rounded-2xl p-5 shadow-lg relative overflow-hidden group hover:border-slate-700 transition-all cursor-pointer"
                    >
                      <div className="flex items-center justify-between text-slate-400 mb-2">
                        <span className="text-xs font-semibold uppercase tracking-wider">Pending Approvals</span>
                        <div className="p-2 rounded-lg bg-amber-500/10 text-amber-400">
                          <Clock className="w-4 h-4" />
                        </div>
                      </div>
                      <div className="text-2xl font-bold text-amber-400">
                        {data.approvalsQueue.pendingOrganizers.length + data.registrations.pendingApprovals}
                      </div>
                      <p className="text-xs text-slate-400 mt-1">
                        {data.approvalsQueue.pendingOrganizers.length} organizers, {data.registrations.pendingApprovals} teams
                      </p>
                    </div>

                    <div
                      onClick={() => setCurrentView('billing')}
                      className="bg-slate-900/80 border border-slate-800/80 rounded-2xl p-5 shadow-lg relative overflow-hidden group hover:border-slate-700 transition-all cursor-pointer"
                    >
                      <div className="flex items-center justify-between text-slate-400 mb-2">
                        <span className="text-xs font-semibold uppercase tracking-wider">Collections</span>
                        <div className="p-2 rounded-lg bg-emerald-500/10 text-emerald-400">
                          <DollarSign className="w-4 h-4" />
                        </div>
                      </div>
                      <div className="text-2xl font-bold text-slate-100">
                        &#8377;{data.billingSummary.totalCollected.toLocaleString()}
                      </div>
                      <p className="text-xs text-slate-400 mt-1">
                        {data.billingSummary.verifiedCount} verified &#183; &#8377;{data.billingSummary.feePerTeam}/team
                      </p>
                    </div>

                    <div
                      onClick={() => setCurrentView('ledger')}
                      className="bg-slate-900/80 border border-slate-800/80 rounded-2xl p-5 shadow-lg relative overflow-hidden group hover:border-slate-700 transition-all cursor-pointer"
                    >
                      <div className="flex items-center justify-between text-slate-400 mb-2">
                        <span className="text-xs font-semibold uppercase tracking-wider">Audit Security</span>
                        <div className="p-2 rounded-lg bg-emerald-500/10 text-emerald-400">
                          <ShieldCheck className="w-4 h-4" />
                        </div>
                      </div>
                      <div className="text-2xl font-bold text-emerald-400">Tamper-Proof</div>
                      <p className="text-xs text-slate-400 mt-1 flex items-center gap-1">
                        <span className="inline-block w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
                        <span>Chain verified ({primaryEvent?.totalBlocks || 0} blocks)</span>
                      </p>
                    </div>
                  </div>

                  {/* Primary Event Mini-Timeline Card */}
                  {primaryEvent ? (
                    <div className="bg-slate-900/80 border border-slate-800/80 rounded-2xl p-6 shadow-xl space-y-4">
                      <div className="flex items-center justify-between">
                        <div>
                          <h3 className="text-base font-semibold text-slate-100 flex items-center gap-2">
                            <span>{primaryEvent.title}</span>
                            <span className="px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-indigo-500/20 text-indigo-300 border border-indigo-500/30 capitalize">
                              Current: {primaryEvent.status}
                            </span>
                          </h3>
                          <p className="text-xs text-slate-400 mt-0.5">Active institutional judging cycle</p>
                        </div>
                        <button
                          onClick={() => setCurrentView('timeline')}
                          className="text-xs text-indigo-400 hover:text-indigo-300 font-medium flex items-center gap-1"
                        >
                          <span>Full Timeline View</span>
                          <ChevronRight className="w-4 h-4" />
                        </button>
                      </div>

                      <div className="grid grid-cols-2 sm:grid-cols-5 gap-3 pt-2">
                        {[
                          { key: 'draft', label: 'Draft', meta: primaryEvent.timeline.draft },
                          { key: 'open', label: 'Registration', meta: primaryEvent.timeline.open },
                          { key: 'judging', label: 'Blind Judging', meta: primaryEvent.timeline.judging },
                          { key: 'review', label: 'Review & Audit', meta: primaryEvent.timeline.review },
                          { key: 'published', label: 'Published', meta: primaryEvent.timeline.published },
                        ].map((step, idx) => (
                          <div
                            key={step.key}
                            className={`p-3 rounded-xl border text-xs ${
                              step.meta?.active
                                ? 'bg-indigo-950/40 border-indigo-500/60 ring-1 ring-indigo-500/30'
                                : step.meta?.completed
                                ? 'bg-slate-900/60 border-slate-700/60'
                                : 'bg-slate-950/40 border-slate-800/60 opacity-60'
                            }`}
                          >
                            <div className="flex items-center justify-between mb-1">
                              <span className="text-[10px] font-bold text-slate-500">0{idx + 1}</span>
                              {step.meta?.completed ? (
                                <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
                              ) : step.meta?.active ? (
                                <span className="w-2 h-2 rounded-full bg-indigo-400 animate-ping" />
                              ) : (
                                <span className="w-2 h-2 rounded-full border border-slate-700" />
                              )}
                            </div>
                            <div className="font-semibold text-slate-200">{step.label}</div>
                            <div className="text-[10px] text-slate-400 mt-0.5">{step.meta?.date || 'Scheduled'}</div>
                          </div>
                        ))}
                      </div>
                    </div>
                  ) : (
                    <div className="bg-slate-900/80 border border-slate-800/80 rounded-2xl p-6 shadow-xl flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                      <div className="flex items-center gap-3">
                        <div className="p-3 rounded-xl bg-indigo-500/10 text-indigo-400 shrink-0">
                          <CalendarDays className="w-5 h-5" />
                        </div>
                        <div>
                          <h4 className="text-sm font-bold text-slate-200">No Active Competition Cycles</h4>
                          <p className="text-xs text-slate-400 mt-0.5">
                            Create your first event from the organizer dashboard to launch judging tracks and rubric workflows.
                          </p>
                        </div>
                      </div>
                      <Link
                        href="/org"
                        className="text-xs px-3.5 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-semibold transition-colors flex items-center gap-1.5 self-start sm:self-auto shrink-0 shadow-md shadow-indigo-600/20"
                      >
                        <span>Create Event</span>
                        <ArrowRight className="w-3.5 h-3.5" />
                      </Link>
                    </div>
                  )}

                  {/* Two Column Quick Previews */}
                  <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                    {/* Quick Judging Progress */}
                    <div className="bg-slate-900/80 border border-slate-800/80 rounded-2xl p-6 shadow-xl space-y-4">
                      <div className="flex items-center justify-between">
                        <h4 className="text-sm font-bold text-slate-100 flex items-center gap-2">
                          <Scale className="w-4 h-4 text-indigo-400" />
                          <span>Judging Panel Progress</span>
                        </h4>
                        <button
                          onClick={() => setCurrentView('judging')}
                          className="text-xs text-indigo-400 hover:text-indigo-300"
                        >
                          View Roster
                        </button>
                      </div>

                      <div className="space-y-3">
                        {data.judgesProgress.slice(0, 3).map((judge) => (
                          <div key={judge.id} className="p-3 bg-slate-950/60 rounded-xl border border-slate-800 space-y-2">
                            <div className="flex justify-between text-xs">
                              <span className="font-semibold text-slate-200">{judge.name}</span>
                              <span className="font-mono text-indigo-400 font-bold">
                                {judge.scoredCount}/{judge.assignedCount} ({judge.completionPct}%)
                              </span>
                            </div>
                            <div className="w-full bg-slate-800 rounded-full h-1.5">
                              <div
                                className="bg-indigo-500 h-1.5 rounded-full"
                                style={{ width: `${judge.completionPct}%` }}
                              />
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>

                    {/* Quick Approvals Queue */}
                    <div className="bg-slate-900/80 border border-slate-800/80 rounded-2xl p-6 shadow-xl space-y-4">
                      <div className="flex items-center justify-between">
                        <h4 className="text-sm font-bold text-slate-100 flex items-center gap-2">
                          <UserCheck className="w-4 h-4 text-amber-400" />
                          <span>Pending Organizer Vetting</span>
                        </h4>
                        <button
                          onClick={() => setCurrentView('organizers')}
                          className="text-xs text-indigo-400 hover:text-indigo-300"
                        >
                          Manage All
                        </button>
                      </div>

                      {data.approvalsQueue.pendingOrganizers.length === 0 ? (
                        <div className="py-6 text-center text-xs text-slate-500">
                          All organizer applications verified.
                        </div>
                      ) : (
                        <div className="space-y-2">
                          {data.approvalsQueue.pendingOrganizers.slice(0, 2).map((org) => (
                            <div
                              key={org.id}
                              className="p-3 bg-slate-950/60 rounded-xl border border-slate-800 flex items-center justify-between text-xs"
                            >
                              <div>
                                <div className="font-semibold text-slate-200">{org.fullName}</div>
                                <div className="text-[11px] text-slate-400">{org.email}</div>
                              </div>
                              <button
                                onClick={() => handleApproveOrganizer(org.id)}
                                className="px-2.5 py-1 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white font-semibold text-[11px]"
                              >
                                Approve
                              </button>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              )}

              {/* VIEW 2: TIMELINE */}
              {currentView === 'timeline' && (
                primaryEvent ? (
                  <div className="space-y-6">
                    <div className="bg-slate-900/80 border border-slate-800 rounded-2xl p-6 shadow-xl space-y-6">
                      <div>
                        <h3 className="text-base font-bold text-slate-100">
                          Competition Stage Progression Policy
                        </h3>
                        <p className="text-xs text-slate-400 mt-1">
                          FairPitch enforces forward-only state transitions. Backward regressions are mathematically blocked.
                        </p>
                      </div>

                      <div className="space-y-4">
                        {[
                          {
                            stage: 'Draft Stage',
                            desc: 'Rubrics, criteria, and tracks configured. Total rubric weights must equal exactly 100%.',
                            status: 'draft',
                            date: primaryEvent.timeline.draft.date,
                            done: true,
                          },
                          {
                            stage: 'Registration (Open)',
                            desc: 'Teams register, pay direct-to-organizer via UPI, and receive verified join codes.',
                            status: 'open',
                            date: primaryEvent.timeline.open.date,
                            done: primaryEvent.timeline.open.completed,
                            active: primaryEvent.status === 'open',
                          },
                          {
                            stage: 'Blind Judging Phase',
                            desc: 'Judges evaluate anonymized projects. Individual scores sealed from admins. Rubrics frozen.',
                            status: 'judging',
                            date: primaryEvent.timeline.judging.date,
                            done: primaryEvent.timeline.judging.completed,
                            active: primaryEvent.status === 'scoring' || primaryEvent.status === 'judging',
                          },
                          {
                            stage: 'Review & Fairness Audit',
                            desc: 'Outlier detection, fatigue drift analysis, and winner-flip simulations unlocked.',
                            status: 'review',
                            date: primaryEvent.timeline.review.date,
                            done: primaryEvent.timeline.review.completed,
                            active: primaryEvent.status === 'review',
                          },
                          {
                            stage: 'Published & Merkle Anchored',
                            desc: 'Final standings sealed into binary Merkle tree root. Loss autopsies released to participants.',
                            status: 'published',
                            date: primaryEvent.timeline.published.date,
                            done: primaryEvent.timeline.published.completed,
                            active: primaryEvent.status === 'published',
                          },
                        ].map((s, idx) => (
                          <div
                            key={idx}
                            className={`p-4 rounded-xl border flex items-start gap-4 ${
                              s.active
                                ? 'bg-indigo-950/40 border-indigo-500/60 ring-1 ring-indigo-500/30'
                                : s.done
                                ? 'bg-slate-900/60 border-slate-800'
                                : 'bg-slate-950/40 border-slate-800/60 opacity-60'
                            }`}
                          >
                            <div className="w-8 h-8 rounded-full bg-slate-800 flex items-center justify-center font-bold text-xs shrink-0 mt-0.5">
                              {s.done ? (
                                <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                              ) : s.active ? (
                                <span className="w-2.5 h-2.5 rounded-full bg-indigo-400 animate-ping" />
                              ) : (
                                idx + 1
                              )}
                            </div>
                            <div className="flex-1">
                              <div className="flex items-center justify-between">
                                <h4 className="text-sm font-bold text-slate-100">{s.stage}</h4>
                                <span className="text-xs font-mono text-slate-400">{s.date}</span>
                              </div>
                              <p className="text-xs text-slate-400 mt-1">{s.desc}</p>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                ) : (
                  <div className="bg-slate-900/80 border border-slate-800 rounded-2xl p-12 text-center shadow-xl space-y-4">
                    <div className="w-12 h-12 rounded-xl bg-indigo-500/10 text-indigo-400 flex items-center justify-center mx-auto">
                      <CalendarDays className="w-6 h-6" />
                    </div>
                    <div>
                      <h3 className="text-base font-bold text-slate-100">No Competition Cycle Active</h3>
                      <p className="text-xs text-slate-400 mt-1 max-w-sm mx-auto">
                        There are currently no events registered for this institution. Initialize an event to govern its progression timeline.
                      </p>
                    </div>
                    <Link
                      href="/org"
                      className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-semibold text-xs transition-colors"
                    >
                      <span>Go to Organizer Console</span>
                      <ArrowRight className="w-4 h-4" />
                    </Link>
                  </div>
                )
              )}

              {/* VIEW 3: ORGANIZER VETTING */}
              {currentView === 'organizers' && (
                <div className="space-y-6">
                  <div className="bg-slate-900/80 border border-slate-800 rounded-2xl p-6 shadow-xl space-y-4">
                    <div className="flex items-center justify-between">
                      <div>
                        <h3 className="text-base font-bold text-slate-100">
                          Organizer Vetting & Roster Management
                        </h3>
                        <p className="text-xs text-slate-400 mt-0.5">
                          Review pending applications and govern active event organizers.
                        </p>
                      </div>
                      <span className="text-xs font-semibold px-2.5 py-1 rounded-full bg-amber-500/15 text-amber-300 border border-amber-500/30">
                        {data.approvalsQueue.pendingOrganizers.length} Pending Applications
                      </span>
                    </div>

                    {data.approvalsQueue.pendingOrganizers.length === 0 ? (
                      <div className="py-12 text-center text-xs text-slate-500">
                        No pending organizer registrations awaiting administrative review.
                      </div>
                    ) : (
                      <div className="overflow-x-auto">
                        <table className="w-full text-left text-xs">
                          <thead>
                            <tr className="border-b border-slate-800 text-slate-400">
                              <th className="pb-3 font-semibold">Applicant</th>
                              <th className="pb-3 font-semibold">Official Email</th>
                              <th className="pb-3 font-semibold">Submission Date</th>
                              <th className="pb-3 font-semibold text-right">Actions</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-slate-800/60">
                            {data.approvalsQueue.pendingOrganizers.map((org) => (
                              <tr key={org.id} className="hover:bg-slate-850/40">
                                <td className="py-3.5 font-semibold text-slate-200">{org.fullName}</td>
                                <td className="py-3.5 text-slate-400">{org.email}</td>
                                <td className="py-3.5 text-slate-500 font-mono">
                                  {new Date(org.appliedAt).toLocaleDateString()}
                                </td>
                                <td className="py-3.5 text-right space-x-2">
                                  <button
                                    onClick={() => handleApproveOrganizer(org.id)}
                                    disabled={actionLoading === org.id}
                                    className="px-3 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white font-semibold text-xs transition-colors cursor-pointer"
                                  >
                                    {actionLoading === org.id ? 'Approving...' : 'Approve'}
                                  </button>
                                  <button
                                    onClick={() => handleRejectOrganizer(org.id)}
                                    disabled={actionLoading === org.id}
                                    className="px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-red-950/60 text-red-300 font-semibold text-xs transition-colors cursor-pointer"
                                  >
                                    Decline
                                  </button>
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* VIEW 4: JUDGING PROGRESS */}
              {currentView === 'judging' && (
                <div className="space-y-6">
                  <div className="bg-slate-900/80 border border-slate-800 rounded-2xl p-6 shadow-xl space-y-4">
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                      <div>
                        <h3 className="text-base font-bold text-slate-100 flex items-center gap-2">
                          <span>Judging Panel Progress</span>
                          <span className="text-[10px] font-semibold px-2 py-0.5 rounded bg-emerald-500/15 text-emerald-300 border border-emerald-500/30">
                            Live Telemetry
                          </span>
                        </h3>
                        <p className="text-xs text-slate-400 mt-0.5">
                          Track evaluation progress per assigned evaluator.
                        </p>
                      </div>

                      <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-amber-500/10 border border-amber-500/30 text-amber-300 text-xs">
                        <Lock className="w-3.5 h-3.5 shrink-0" />
                        <span>Blind Judging Active &#183; Absolute Scores Sealed</span>
                      </div>
                    </div>

                    <div className="space-y-3 pt-2">
                      {data.judgesProgress.map((judge) => (
                        <div key={judge.id} className="p-4 bg-slate-950/60 rounded-xl border border-slate-800 space-y-2">
                          <div className="flex items-center justify-between">
                            <div>
                              <div className="text-xs font-bold text-slate-200">{judge.name}</div>
                              <div className="text-[11px] text-slate-400">{judge.email}</div>
                            </div>
                            <div className="text-right">
                              <span className="text-xs font-mono font-bold text-indigo-400">
                                {judge.scoredCount} / {judge.assignedCount}
                              </span>
                              <span className="text-[11px] text-slate-400 ml-1.5">
                                ({judge.completionPct}%)
                              </span>
                            </div>
                          </div>
                          <div className="w-full bg-slate-800 rounded-full h-2 overflow-hidden">
                            <div
                              className="bg-gradient-to-r from-indigo-500 to-emerald-400 h-2 rounded-full"
                              style={{ width: `${judge.completionPct}%` }}
                            />
                          </div>
                        </div>
                      ))}
                    </div>

                    <div className="p-3.5 rounded-xl bg-slate-950/40 border border-slate-800 text-[11px] text-slate-400 flex items-center gap-2.5">
                      <ShieldCheck className="w-4 h-4 text-indigo-400 shrink-0" />
                      <span>
                        <strong>Zero-Knowledge Invariant:</strong> Individual criteria score values are strictly omitted from administrative review before the Review stage to prevent halo effects and administrative bias.
                      </span>
                    </div>
                  </div>
                </div>
              )}

              {/* VIEW 5: TRACK ANALYTICS */}
              {currentView === 'analytics' && (
                <div className="space-y-6">
                  <div className="bg-slate-900/80 border border-slate-800 rounded-2xl p-6 shadow-xl space-y-4">
                    <div className="flex items-center justify-between">
                      <div>
                        <h3 className="text-base font-bold text-slate-100">
                          Registration & Track Distribution
                        </h3>
                        <p className="text-xs text-slate-400 mt-0.5">
                          Team enrollment across competition tracks
                        </p>
                      </div>
                      <span className="text-xs font-mono text-indigo-400 font-bold">
                        {data.registrations.totalTeams} Total Teams
                      </span>
                    </div>

                    <div className="h-72 w-full pt-4">
                      {isClient && (
                        <ResponsiveContainer width="100%" height="100%">
                          <BarChart data={data.registrations.trackBreakdown} margin={{ top: 10, right: 10, left: -20, bottom: 20 }}>
                            <XAxis dataKey="track" stroke="#64748b" fontSize={11} tickLine={false} axisLine={{ stroke: '#334155' }} />
                            <YAxis stroke="#64748b" fontSize={11} tickLine={false} axisLine={{ stroke: '#334155' }} allowDecimals={false} />
                            <Tooltip
                              contentStyle={{
                                backgroundColor: '#0f172a',
                                borderColor: '#334155',
                                borderRadius: '0.75rem',
                                color: '#f8fafc',
                                fontSize: '12px',
                              }}
                              itemStyle={{ color: '#818cf8' }}
                            />
                            <Bar dataKey="teams" radius={[6, 6, 0, 0]}>
                              {data.registrations.trackBreakdown.map((_, index) => (
                                <Cell key={`cell-${index}`} fill={chartColors[index % chartColors.length]} />
                              ))}
                            </Bar>
                          </BarChart>
                        </ResponsiveContainer>
                      )}
                    </div>
                  </div>
                </div>
              )}

              {/* VIEW 6: DISPUTES & APPROVALS */}
              {currentView === 'disputes' && (
                <div className="space-y-6">
                  <div className="bg-slate-900/80 border border-slate-800 rounded-2xl p-6 shadow-xl space-y-4">
                    <div className="flex border-b border-slate-800 text-xs">
                      <button
                        onClick={() => setActiveQueueTab('organizers')}
                        className={`pb-2.5 px-4 font-semibold border-b-2 cursor-pointer ${
                          activeQueueTab === 'organizers'
                            ? 'border-indigo-500 text-indigo-400'
                            : 'border-transparent text-slate-400 hover:text-slate-200'
                        }`}
                      >
                        Pending Organizers ({data.approvalsQueue.pendingOrganizers.length})
                      </button>
                      <button
                        onClick={() => setActiveQueueTab('edits')}
                        className={`pb-2.5 px-4 font-semibold border-b-2 cursor-pointer ${
                          activeQueueTab === 'edits'
                            ? 'border-indigo-500 text-indigo-400'
                            : 'border-transparent text-slate-400 hover:text-slate-200'
                        }`}
                      >
                        Score Edits ({data.approvalsQueue.editRequests.length})
                      </button>
                      <button
                        onClick={() => setActiveQueueTab('reviews')}
                        className={`pb-2.5 px-4 font-semibold border-b-2 cursor-pointer ${
                          activeQueueTab === 'reviews'
                            ? 'border-indigo-500 text-indigo-400'
                            : 'border-transparent text-slate-400 hover:text-slate-200'
                        }`}
                      >
                        Review Tickets ({data.approvalsQueue.reviewRequests.length})
                      </button>
                    </div>

                    <div className="space-y-3 pt-2">
                      {activeQueueTab === 'edits' && (
                        <>
                          {data.approvalsQueue.editRequests.length === 0 ? (
                            <div className="py-8 text-center text-xs text-slate-500">
                              No active judge score edit requests.
                            </div>
                          ) : (
                            data.approvalsQueue.editRequests.map((req) => (
                              <div key={req.id} className="p-3.5 rounded-xl bg-slate-950/60 border border-slate-800 space-y-2">
                                <div className="flex items-center justify-between text-xs font-semibold text-slate-200">
                                  <span>{req.judgeName}</span>
                                  <span className="text-[10px] text-amber-400 bg-amber-500/10 px-2 py-0.5 rounded border border-amber-500/20">
                                    {req.teamName}
                                  </span>
                                </div>
                                <p className="text-[11px] text-slate-400 italic">&ldquo;{req.reason}&rdquo;</p>
                              </div>
                            ))
                          )}
                        </>
                      )}

                      {activeQueueTab === 'reviews' && (
                        <>
                          {data.approvalsQueue.reviewRequests.length === 0 ? (
                            <div className="py-8 text-center text-xs text-slate-500">
                              No participant review tickets submitted.
                            </div>
                          ) : (
                            data.approvalsQueue.reviewRequests.map((rev) => (
                              <div key={rev.id} className="p-3.5 rounded-xl bg-slate-950/60 border border-slate-800 space-y-2">
                                <div className="flex items-center justify-between text-xs font-semibold text-slate-200">
                                  <span>{rev.teamName}</span>
                                  <span className="text-[10px] text-indigo-400 bg-indigo-500/10 px-2 py-0.5 rounded">
                                    {rev.status}
                                  </span>
                                </div>
                                <p className="text-[11px] text-slate-400">{rev.reason}</p>
                              </div>
                            ))
                          )}
                        </>
                      )}

                      {activeQueueTab === 'organizers' && (
                        <div className="space-y-3">
                          {data.approvalsQueue.pendingOrganizers.map((org) => (
                            <div key={org.id} className="p-3 bg-slate-950/60 rounded-xl border border-slate-800 flex items-center justify-between text-xs">
                              <div>
                                <div className="font-semibold text-slate-200">{org.fullName}</div>
                                <div className="text-[11px] text-slate-400">{org.email}</div>
                              </div>
                              <button
                                onClick={() => handleApproveOrganizer(org.id)}
                                className="px-3 py-1 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white font-semibold text-xs"
                              >
                                Approve
                              </button>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              )}

              {/* VIEW 7: LEDGER */}
              {currentView === 'ledger' && (
                primaryEvent ? (
                  <div className="space-y-6">
                    <div className="bg-slate-900/80 border border-slate-800 rounded-2xl p-6 shadow-xl space-y-4">
                      <div className="flex items-center justify-between">
                        <h3 className="text-base font-bold text-slate-100 flex items-center gap-2">
                          <ShieldCheck className="w-5 h-5 text-emerald-400" />
                          <span>Cryptographic Ledger Status</span>
                        </h3>
                        <span className="px-2.5 py-0.5 rounded-full text-xs font-bold bg-emerald-500/20 text-emerald-400 border border-emerald-500/30">
                          Anchored SHA-256
                        </span>
                      </div>

                      <div className="p-4 rounded-xl bg-slate-950 border border-slate-800 space-y-2">
                        <div className="flex items-center justify-between text-xs text-slate-400">
                          <span>Merkle Root Hash</span>
                          <button
                            onClick={() => handleCopyMerkleRoot(primaryEvent.merkleRoot)}
                            className="flex items-center gap-1 text-indigo-400 hover:text-indigo-300 font-semibold"
                          >
                            {copiedRoot ? 'Copied!' : 'Copy Hash'}
                          </button>
                        </div>
                        <div className="font-mono text-xs text-slate-300 break-all bg-slate-900 p-2.5 rounded border border-slate-800">
                          {primaryEvent.merkleRoot}
                        </div>
                      </div>

                      <Link
                        href="/verify"
                        className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-100 font-semibold text-xs border border-slate-700"
                      >
                        <span>Open Full Public Verification Ledger</span>
                        <ExternalLink className="w-4 h-4 text-slate-400" />
                      </Link>
                    </div>
                  </div>
                ) : (
                  <div className="bg-slate-900/80 border border-slate-800 rounded-2xl p-12 text-center shadow-xl space-y-4">
                    <div className="w-12 h-12 rounded-xl bg-emerald-500/10 text-emerald-400 flex items-center justify-center mx-auto">
                      <ShieldCheck className="w-6 h-6" />
                    </div>
                    <div>
                      <h3 className="text-base font-bold text-slate-100">Ledger Awaiting Event Initialization</h3>
                      <p className="text-xs text-slate-400 mt-1 max-w-sm mx-auto">
                        Cryptographic ledger blocks and Merkle roots will automatically anchor once an event is created and scoring begins.
                      </p>
                    </div>
                    <Link
                      href="/verify"
                      className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 font-semibold text-xs border border-slate-700 transition-colors"
                    >
                      <span>View Public Verification Ledger</span>
                      <ExternalLink className="w-4 h-4 text-slate-400" />
                    </Link>
                  </div>
                )
              )}

              {/* VIEW 8: BILLING */}
              {currentView === 'billing' && (
                <div className="space-y-6">
                  <div className="bg-slate-900/80 border border-slate-800 rounded-2xl p-6 shadow-xl space-y-4 max-w-2xl">
                    <h3 className="text-base font-bold text-slate-100 flex items-center gap-2">
                      <CreditCard className="w-5 h-5 text-emerald-400" />
                      <span>Metered Platform Tariff Breakdown</span>
                    </h3>

                    <div className="space-y-3 text-xs">
                      <div className="flex justify-between py-2 border-b border-slate-800">
                        <span className="text-slate-400">Platform Tariff Rate</span>
                        <span className="font-mono font-bold text-slate-200">&#8377;{data.billingSummary.feePerTeam} / team</span>
                      </div>
                      <div className="flex justify-between py-2 border-b border-slate-800">
                        <span className="text-slate-400">Verified Teams</span>
                        <span className="font-mono font-bold text-emerald-400">{data.billingSummary.verifiedCount}</span>
                      </div>
                      <div className="flex justify-between py-2 border-b border-slate-800">
                        <span className="text-slate-400">Pending Settlement</span>
                        <span className="font-mono font-bold text-amber-400">{data.billingSummary.pendingCount}</span>
                      </div>
                      <div className="flex justify-between py-2 font-bold text-sm text-slate-100">
                        <span>Total Invoiceable</span>
                        <span className="font-mono text-indigo-400">&#8377;{data.billingSummary.totalCollected.toLocaleString()}</span>
                      </div>
                    </div>

                    <p className="text-xs text-slate-400 leading-relaxed pt-2">
                      Direct-to-organizer registration fees are 0% commission. Metered platform charges settle automatically upon event conclusion.
                    </p>
                  </div>
                </div>
              )}

              {/* VIEW 9: SETTINGS */}
              {currentView === 'settings' && (
                <div className="space-y-6 max-w-2xl">
                  <div className="bg-slate-900/80 border border-slate-800 rounded-2xl p-6 shadow-xl space-y-4">
                    <h3 className="text-base font-bold text-slate-100 flex items-center gap-2">
                      <Settings className="w-5 h-5 text-indigo-400" />
                      <span>Tenant Policy & Statutory DPDP 2023 Compliance</span>
                    </h3>

                    <div className="space-y-3 text-xs text-slate-300">
                      <div className="p-3.5 bg-slate-950 rounded-xl border border-slate-800 space-y-1">
                        <div className="font-bold text-slate-100">Audit Record Retention (DPDP Section 8)</div>
                        <p className="text-slate-400">
                          All immutable scoring blocks, judge excusal logs, and Merkle tree roots are retained for 7 years in compliance with statutory audit standards.
                        </p>
                      </div>

                      <div className="p-3.5 bg-slate-950 rounded-xl border border-slate-800 space-y-1">
                        <div className="font-bold text-slate-100">Tenant Multi-Tenancy Key</div>
                        <p className="font-mono text-slate-400 text-[11px] break-all">
                          {data.institution.id}
                        </p>
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
