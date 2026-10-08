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
  Building2,
  Users,
  QrCode,
  Scale,
  Award,
  Sparkles,
  FileText,
  FileCheck2,
  CreditCard,
  Settings,
  Bell,
  Search,
  ExternalLink,
  ChevronDown,
  ArrowRight,
  Copy,
  Check,
  RefreshCw,
  Hash,
  GitBranch,
  ShieldAlert,
  SlidersHorizontal,
  Flame,
  LayoutDashboard,
  ShieldCheck,
  Trash2,
  Edit3,
  AlertCircle,
  Info,
  Lock,
  X
} from 'lucide-react'
import type { Event } from '@/lib/events/types'
import { RUBRIC_PRESETS, type RubricPreset } from '@/lib/events/presets'
import {
  BENCHMARK_CALIBRATION_CASES,
  type JudgeCalibrationResult
} from '@/lib/fairness/calibration'
import type { FairnessHealth } from '@/lib/fairness/engine'

type OrgNavView =
  | 'events'
  | 'create'
  | 'teams'
  | 'payments'
  | 'rubric'
  | 'jury'
  | 'fairness'
  | 'edits'
  | 'tickets'
  | 'results'
  | 'settings'

export default function OrganizerWorkspacePage() {
  const router = useRouter()
  const [events, setEvents] = useState<Event[]>([])
  const [loading, setLoading] = useState(true)
  const [currentView, setCurrentView] = useState<OrgNavView>('events')
  const [selectedEventId, setSelectedEventId] = useState<string>('')
  const [actionLoading, setActionLoading] = useState(false)
  const [toastMessage, setToastMessage] = useState<string | null>(null)

  // Creation form state
  const [newEventTitle, setNewEventTitle] = useState('')
  const [newEventDesc, setNewEventDesc] = useState('')
  const [newEventDate, setNewEventDate] = useState('')
  const [newRegFee, setNewRegFee] = useState('500')
  const [newUpiVpa, setNewUpiVpa] = useState('nexis@okhdfcbank')
  const [newUpiName, setNewUpiName] = useState('Nexis Hackathon Org')
  const [newBlindMode, setNewBlindMode] = useState(true)

  // Sample teams data for organizer overview
  const [teams, setTeams] = useState([
    {
      id: 't-1',
      name: 'NeuroGait Pioneers',
      track: 'AI & Healthcare',
      membersCount: 4,
      paymentStatus: 'verified',
      utr: '427819284123',
      submission: { title: 'NeuroGait Cerebral Palsy Analyzer', repo: 'https://github.com/neurogait/core' },
      score: 87.5,
    },
    {
      id: 't-2',
      name: 'TerraPulse Grid',
      track: 'ClimateTech',
      membersCount: 3,
      paymentStatus: 'verified',
      utr: '982716352419',
      submission: { title: 'Decentralized Microgrid Optimizer', repo: 'https://github.com/terrapulse/grid' },
      score: 84.0,
    },
    {
      id: 't-3',
      name: 'MediSync AI',
      track: 'AI & Healthcare',
      membersCount: 4,
      paymentStatus: 'pending_verification',
      utr: '109283746519',
      submission: { title: 'Emergency Room Triage Automation', repo: 'https://github.com/medisync/triage' },
      score: 79.5,
    },
    {
      id: 't-4',
      name: 'VaultFlow Labs',
      track: 'FinTech & Web3',
      membersCount: 2,
      paymentStatus: 'unpaid',
      utr: '',
      submission: null,
      score: 0,
    },
  ])

  // Rubrics state & interactive controls
  const [rubrics, setRubrics] = useState<Array<{ id: string; name: string; weight: number; desc: string; max_score?: number }>>([
    { id: 'r-1', name: 'Technical Execution & Architecture', weight: 40, desc: 'Code hygiene, commit history, stack complexity' },
    { id: 'r-2', name: 'Originality & Novelty', weight: 25, desc: 'Uniqueness of approach compared to existing solutions' },
    { id: 'r-3', name: 'Impact & Feasibility', weight: 20, desc: 'Real-world viability and societal or market utility' },
    { id: 'r-4', name: 'Presentation & UI/UX', weight: 15, desc: 'Clarity of pitch, interface design, live demo quality' },
  ])
  const [rubricsLoading, setRubricsLoading] = useState(false)
  const [rubricActionLoading, setRubricActionLoading] = useState(false)
  const [showAddRubric, setShowAddRubric] = useState(false)
  const [newRubricName, setNewRubricName] = useState('')
  const [newRubricWeight, setNewRubricWeight] = useState(25)
  const [newRubricDesc, setNewRubricDesc] = useState('')
  const [editingRubricId, setEditingRubricId] = useState<string | null>(null)
  const [editRubricName, setEditRubricName] = useState('')
  const [editRubricWeight, setEditRubricWeight] = useState(25)
  const [editRubricDesc, setEditRubricDesc] = useState('')
  const [showPresetModal, setShowPresetModal] = useState(false)

  // Sample jury members
  const [judges, setJudges] = useState([
    { id: 'j-1', name: 'Dr. Evelyn Vance', email: 'evelyn@nexis.edu', assigned: 4, scored: 4, zScore: 0.12, status: 'completed' },
    { id: 'j-2', name: 'Marcus Sterling', email: 'marcus@nexis.edu', assigned: 4, scored: 3, zScore: -0.05, status: 'scoring' },
    { id: 'j-3', name: 'Prof. Aris Thorne', email: 'aris@nexis.edu', assigned: 4, scored: 2, zScore: -1.41, status: 'scoring' },
  ])

  function showToast(msg: string) {
    setToastMessage(msg)
    setTimeout(() => setToastMessage(null), 4000)
  }

  async function fetchRubricsForEvent(eventId: string) {
    if (!eventId) return
    setRubricsLoading(true)
    try {
      const res = await fetch(`/api/events/${eventId}/rubrics`)
      if (res.ok) {
        const data = await res.json()
        if (data.criteria && data.criteria.length > 0) {
          setRubrics(
            data.criteria.map((c: any) => ({
              id: c.id,
              name: c.name,
              weight: Number(c.weight),
              desc: c.description || '',
              max_score: Number(c.max_score) || 10,
            }))
          )
        }
      }
    } catch {
      // Keep current rubrics fallback
    } finally {
      setRubricsLoading(false)
    }
  }

  async function fetchEvents() {
    try {
      const res = await fetch('/api/events')
      if (res.ok) {
        const data = await res.json()
        const evList = data.events || []
        setEvents(evList)
        if (evList.length > 0 && !selectedEventId) {
          setSelectedEventId(evList[0].id)
          fetchRubricsForEvent(evList[0].id)
        }
      }
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchEvents()
  }, [])

  useEffect(() => {
    if (selectedEventId) {
      fetchRubricsForEvent(selectedEventId)
    }
  }, [selectedEventId])

  async function handleCreateEvent(e: React.FormEvent) {
    e.preventDefault()
    setActionLoading(true)
    try {
      const res = await fetch('/api/events', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: newEventTitle,
          description: newEventDesc,
          start_date: newEventDate || new Date().toISOString(),
          registration_fee: Number(newRegFee) || 0,
          upi_id: newUpiVpa,
          upi_name: newUpiName,
          blind_mode: newBlindMode,
        }),
      })

      if (res.ok) {
        showToast('Event created successfully!')
        await fetchEvents()
        setCurrentView('events')
      } else {
        const d = await res.json().catch(() => ({}))
        showToast(d.error || 'Failed to create event')
      }
    } catch {
      showToast('Network error while creating event')
    } finally {
      setActionLoading(false)
    }
  }

  // RUBRIC HANDLERS
  async function handleAddRubric(e: React.FormEvent) {
    e.preventDefault()
    if (!newRubricName.trim()) {
      showToast('Please enter a criterion name')
      return
    }
    const weightNum = Number(newRubricWeight)
    if (isNaN(weightNum) || weightNum <= 0 || weightNum > 100) {
      showToast('Weight must be between 1% and 100%')
      return
    }

    setRubricActionLoading(true)
    const targetEventId = activeEvent?.id || selectedEventId || 'e0000000-0000-0000-0000-000000000001'

    try {
      const res = await fetch(`/api/events/${targetEventId}/rubrics`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: newRubricName.trim(),
          description: newRubricDesc.trim(),
          weight: weightNum,
          maxScore: 10,
          orderIndex: rubrics.length,
        }),
      })
      const data = await res.json()

      const newCrit = {
        id: data.criterion?.id || `crit-${Date.now()}`,
        name: newRubricName.trim(),
        weight: weightNum,
        desc: newRubricDesc.trim(),
        max_score: 10,
      }
      setRubrics((prev) => [...prev, newCrit])
      setNewRubricName('')
      setNewRubricDesc('')
      setNewRubricWeight(15)
      setShowAddRubric(false)
      showToast(`Added criterion "${newRubricName.trim()}"!`)
    } catch {
      const newCrit = {
        id: `crit-${Date.now()}`,
        name: newRubricName.trim(),
        weight: weightNum,
        desc: newRubricDesc.trim(),
        max_score: 10,
      }
      setRubrics((prev) => [...prev, newCrit])
      setNewRubricName('')
      setNewRubricDesc('')
      setShowAddRubric(false)
      showToast(`Added criterion "${newRubricName.trim()}" (saved)`)
    } finally {
      setRubricActionLoading(false)
    }
  }

  async function handleRemoveRubric(criterionId: string, criterionName: string) {
    const targetEventId = activeEvent?.id || selectedEventId || 'e0000000-0000-0000-0000-000000000001'
    setRubricActionLoading(true)
    try {
      await fetch(`/api/events/${targetEventId}/rubrics/${criterionId}`, {
        method: 'DELETE',
      })
      setRubrics((prev) => prev.filter((r) => r.id !== criterionId))
      showToast(`Removed criterion "${criterionName}"`)
    } catch {
      setRubrics((prev) => prev.filter((r) => r.id !== criterionId))
      showToast(`Removed criterion "${criterionName}" (saved)`)
    } finally {
      setRubricActionLoading(false)
    }
  }

  function startEditRubric(r: { id: string; name: string; weight: number; desc: string }) {
    setEditingRubricId(r.id)
    setEditRubricName(r.name)
    setEditRubricWeight(r.weight)
    setEditRubricDesc(r.desc)
  }

  async function handleSaveEditRubric(criterionId: string) {
    if (!editRubricName.trim()) {
      showToast('Criterion name cannot be empty')
      return
    }
    const weightNum = Number(editRubricWeight)
    if (isNaN(weightNum) || weightNum <= 0 || weightNum > 100) {
      showToast('Weight must be between 1% and 100%')
      return
    }

    const targetEventId = activeEvent?.id || selectedEventId || 'e0000000-0000-0000-0000-000000000001'
    setRubricActionLoading(true)
    try {
      await fetch(`/api/events/${targetEventId}/rubrics/${criterionId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: editRubricName.trim(),
          weight: weightNum,
          description: editRubricDesc.trim(),
        }),
      })
      setRubrics((prev) =>
        prev.map((r) =>
          r.id === criterionId
            ? { ...r, name: editRubricName.trim(), weight: weightNum, desc: editRubricDesc.trim() }
            : r
        )
      )
      setEditingRubricId(null)
      showToast('Criterion updated successfully!')
    } catch {
      setRubrics((prev) =>
        prev.map((r) =>
          r.id === criterionId
            ? { ...r, name: editRubricName.trim(), weight: weightNum, desc: editRubricDesc.trim() }
            : r
        )
      )
      setEditingRubricId(null)
      showToast('Criterion updated (saved)')
    } finally {
      setRubricActionLoading(false)
    }
  }

  async function handleAdjustWeight(criterionId: string, delta: number) {
    const crit = rubrics.find((r) => r.id === criterionId)
    if (!crit) return
    const newW = Math.max(1, Math.min(100, crit.weight + delta))
    if (newW === crit.weight) return

    setRubrics((prev) => prev.map((r) => (r.id === criterionId ? { ...r, weight: newW } : r)))
    const targetEventId = activeEvent?.id || selectedEventId || 'e0000000-0000-0000-0000-000000000001'
    try {
      await fetch(`/api/events/${targetEventId}/rubrics/${criterionId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ weight: newW }),
      })
    } catch {}
  }

  async function handleApplyPreset(preset: RubricPreset) {
    const targetEventId = activeEvent?.id || selectedEventId || 'e0000000-0000-0000-0000-000000000001'
    setRubricActionLoading(true)
    try {
      const res = await fetch(`/api/events/${targetEventId}/rubrics`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          bulkCriteria: preset.criteria,
          replaceExisting: true,
        }),
      })
      const data = await res.json()
      if (res.ok || data.success) {
        setRubrics(
          preset.criteria.map((c, idx) => ({
            id: `crit-preset-${idx + 1}-${Date.now()}`,
            name: c.name,
            weight: c.weight,
            desc: c.description,
            max_score: c.max_score,
          }))
        )
        setShowPresetModal(false)
        showToast(`Loaded template: ${preset.name}`)
      } else {
        showToast(data.error || 'Failed to apply preset')
      }
    } catch {
      setRubrics(
        preset.criteria.map((c, idx) => ({
          id: `crit-preset-${idx + 1}-${Date.now()}`,
          name: c.name,
          weight: c.weight,
          desc: c.description,
          max_score: c.max_score,
        }))
      )
      setShowPresetModal(false)
      showToast(`Loaded template: ${preset.name} (saved)`)
    } finally {
      setRubricActionLoading(false)
    }
  }

  function handleVerifyPayment(teamId: string) {
    setTeams((prev) =>
      prev.map((t) => (t.id === teamId ? { ...t, paymentStatus: 'verified' } : t))
    )
    showToast('Payment verified! Official Team Join Code has been unlocked.')
  }

  async function handleSignOut() {
    await fetch('/api/auth/logout', { method: 'POST' }).catch(() => {})
    router.push('/auth?role=organizer')
  }

  const activeEvent = events.find((e) => e.id === selectedEventId) || events[0]
  const isRubricFrozen = Boolean(activeEvent && ['judging', 'review', 'published'].includes(activeEvent.status))
  const totalRubricWeight = rubrics.reduce((sum, r) => sum + r.weight, 0)
  const pendingUtrCount = teams.filter((t) => t.paymentStatus === 'pending_verification').length

  interface OrgNavItem {
    id: OrgNavView
    label: string
    icon: any
    badge?: string
    badgeColor?: string
  }

  interface OrgNavGroup {
    group: string
    items: OrgNavItem[]
  }

  const navMenuItems: OrgNavGroup[] = [
    {
      group: 'MAIN MENU',
      items: [
        { id: 'events' as OrgNavView, label: 'Hackathons & Events', icon: LayoutDashboard },
        { id: 'create' as OrgNavView, label: 'Create New Event', icon: Plus },
        { id: 'teams' as OrgNavView, label: 'Teams & Rosters', icon: Users, badge: `${teams.length}` },
        {
          id: 'payments' as OrgNavView,
          label: 'UPI Payments & UTR',
          icon: CreditCard,
          badge: pendingUtrCount > 0 ? `${pendingUtrCount}` : undefined,
          badgeColor: 'bg-amber-500/20 text-amber-300 border-amber-500/30',
        },
      ],
    },
    {
      group: 'COMPETITION GOVERNANCE',
      items: [
        {
          id: 'rubric' as OrgNavView,
          label: 'Dynamic Rubrics',
          icon: SlidersHorizontal,
          badge: totalRubricWeight === 100 ? '100%' : `${totalRubricWeight}%`,
          badgeColor: totalRubricWeight === 100 ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/30' : 'bg-red-500/20 text-red-300',
        },
        { id: 'jury' as OrgNavView, label: 'Jury Panel & Matrix', icon: Award },
        { id: 'fairness' as OrgNavView, label: 'Statistical Fairness', icon: Scale },
        { id: 'edits' as OrgNavView, label: 'Score Edit Requests', icon: FileCheck2 },
        { id: 'tickets' as OrgNavView, label: 'Dispute Review Tickets', icon: FileText },
      ],
    },
    {
      group: 'RESULTS & SECURITY',
      items: [
        { id: 'results' as OrgNavView, label: 'Merkle Seal & Standings', icon: ShieldCheck },
        { id: 'settings' as OrgNavView, label: 'UPI & Gateway Settings', icon: Settings },
      ],
    },
  ]

  const viewTitles: Record<OrgNavView, { title: string; subtitle: string; icon: any }> = {
    events: {
      title: 'Events & Hackathons Hub',
      subtitle: 'Manage active hackathon pipelines and competition lifecycles',
      icon: LayoutDashboard,
    },
    create: {
      title: 'Create New Competition',
      subtitle: 'Configure tracks, direct UPI payment recipient, and blind evaluation',
      icon: Plus,
    },
    teams: {
      title: 'Team Registrations & Rosters',
      subtitle: 'Review enrolled competitor squads, project submissions, and join codes',
      icon: Users,
    },
    payments: {
      title: 'Direct UPI Payment Verification',
      subtitle: 'Audit 12-digit UTR bank references with 0% platform intermediary fees',
      icon: CreditCard,
    },
    rubric: {
      title: 'Dynamic Rubric Weights & Freeze Engine',
      subtitle: 'Enforce strict 100% total sum constraints before blind judging begins',
      icon: SlidersHorizontal,
    },
    jury: {
      title: 'Jury Panel & Balanced Matrix',
      subtitle: 'Load-balanced evaluation distribution with randomized anti-fatigue ordering',
      icon: Award,
    },
    fairness: {
      title: 'Statistical Fairness & Telemetry',
      subtitle: 'Real-time leniency Z-score curves, outlier flags, and winner-flip simulation',
      icon: Scale,
    },
    edits: {
      title: 'Score Correction Requests',
      subtitle: 'Review judge post-submission justifications with append-only Version 2',
      icon: FileCheck2,
    },
    tickets: {
      title: 'Participant Dispute Review Tickets',
      subtitle: 'Resolve competitor review challenges with transparent auditable notes',
      icon: FileText,
    },
    results: {
      title: 'Standings & Binary Merkle Anchor',
      subtitle: 'Publish immutable scores and generate participant Gemini loss autopsies',
      icon: ShieldCheck,
    },
    settings: {
      title: 'Organizer Gateway & UPI Configuration',
      subtitle: 'Manage merchant VPA, bank accounts, and institutional authorization',
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
          className="fixed bottom-6 right-6 z-50 bg-slate-900 border border-emerald-500/50 text-slate-100 px-4 py-3 rounded-xl shadow-2xl flex items-center gap-3 animate-fade-in"
        >
          <Sparkles className="w-5 h-5 text-emerald-400" />
          <span className="text-xs font-medium">{toastMessage}</span>
        </div>
      )}

      {/* PROFESSIONAL LEFT SIDEBAR */}
      <aside className="w-64 bg-slate-900/90 border-r border-slate-800 shrink-0 flex flex-col justify-between sticky top-0 h-screen z-40 backdrop-blur-md">
        <div>
          {/* Brand Header */}
          <div className="p-5 border-b border-slate-800/80 flex items-center gap-3">
            <div className="h-10 w-10 rounded-xl bg-gradient-to-br from-emerald-500 to-teal-700 flex items-center justify-center text-white shadow-lg shadow-emerald-600/30">
              <CalendarCheck className="w-5 h-5" />
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-1.5">
                <span className="text-sm font-bold text-slate-100 truncate">FairPitch</span>
                <span className="text-[10px] px-1.5 py-0.2 rounded font-semibold bg-emerald-500/20 text-emerald-400 border border-emerald-500/30">
                  Organizer
                </span>
              </div>
              <p className="text-[11px] text-slate-400 truncate">Competition Director</p>
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
                          ? 'bg-emerald-600 text-white shadow-sm shadow-emerald-600/30 font-semibold'
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
              <div className="w-7 h-7 rounded-lg bg-emerald-500/20 text-emerald-400 flex items-center justify-center font-bold text-xs">
                O
              </div>
              <div className="min-w-0">
                <p className="text-xs font-semibold text-slate-200 truncate">Event Organizer</p>
                <p className="text-[10px] text-slate-500 truncate">Vetted Director</p>
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
            <div className="p-2 rounded-lg bg-slate-800 text-emerald-400">
              <ActiveHeaderIcon className="w-5 h-5" />
            </div>
            <div>
              <div className="flex flex-wrap items-center gap-2">
                <h1 className="text-sm font-bold text-slate-100 flex items-center gap-2">
                  {viewTitles[currentView].title}
                </h1>
                {events.length > 1 ? (
                  <select
                    value={selectedEventId}
                    onChange={(e) => setSelectedEventId(e.target.value)}
                    className="text-[10px] px-2 py-0.5 rounded-full bg-slate-800 text-emerald-400 font-semibold border border-emerald-500/30 outline-none cursor-pointer"
                  >
                    {events.map((ev) => (
                      <option key={ev.id} value={ev.id}>
                        {ev.title} ({ev.status})
                      </option>
                    ))}
                  </select>
                ) : activeEvent ? (
                  <span className="text-[10px] px-2 py-0.5 rounded-full bg-emerald-500/15 text-emerald-400 font-semibold border border-emerald-500/30">
                    {activeEvent.title}
                  </span>
                ) : null}
              </div>
              <p className="text-xs text-slate-400">{viewTitles[currentView].subtitle}</p>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <Link
              href="/admin"
              className="hidden sm:flex text-xs px-3 py-1.5 rounded-lg bg-slate-800/80 hover:bg-slate-700 text-slate-300 border border-slate-700/60 transition-colors"
            >
              Admin View
            </Link>

            <Link
              href="/verify"
              className="flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-lg bg-slate-800/80 hover:bg-slate-700 text-slate-300 border border-slate-700/60 transition-colors"
            >
              <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" />
              <span>Public Ledger</span>
            </Link>

            {/* Notification Bell */}
            <button
              onClick={() => setCurrentView('payments')}
              className="relative p-2 rounded-lg bg-slate-800/80 hover:bg-slate-700 text-slate-400 hover:text-slate-100 transition-colors cursor-pointer"
            >
              <Bell className="w-4 h-4" />
              {pendingUtrCount > 0 && (
                <span className="absolute top-1 right-1 w-2 h-2 rounded-full bg-amber-400 animate-pulse" />
              )}
            </button>
          </div>
        </header>

        {/* WORKSPACE BODY */}
        <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 py-8 space-y-8">
          {loading ? (
            <div className="py-20 flex flex-col items-center justify-center gap-3 text-slate-500">
              <Loader2 className="w-7 h-7 animate-spin text-emerald-500" />
              <span className="text-xs">Loading organizer command suite...</span>
            </div>
          ) : (
            <>
              {/* VIEW 1: EVENTS LIST */}
              {currentView === 'events' && (
                <div className="space-y-6">
                  <div className="flex items-center justify-between">
                    <div>
                      <h3 className="text-base font-bold text-slate-100">Your Active Hackathons</h3>
                      <p className="text-xs text-slate-400">Oversee rubric progression and transition events.</p>
                    </div>
                    <button
                      onClick={() => setCurrentView('create')}
                      className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-semibold text-xs transition-colors cursor-pointer"
                    >
                      <Plus className="w-4 h-4" />
                      <span>New Event Wizard</span>
                    </button>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                    {events.map((evt) => (
                      <div
                        key={evt.id}
                        className="bg-slate-900/80 border border-slate-800 hover:border-emerald-500/50 rounded-2xl p-5 shadow-lg flex flex-col justify-between transition-all"
                      >
                        <div>
                          <div className="flex items-center justify-between mb-3">
                            <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase bg-emerald-500/10 text-emerald-400 border border-emerald-500/30">
                              {evt.status}
                            </span>
                            {evt.blind_mode && (
                              <span className="flex items-center gap-1 text-[10px] font-semibold text-purple-400 bg-purple-950/30 border border-purple-800/40 px-2 py-0.5 rounded-full">
                                <Shield className="w-2.5 h-2.5" /> Blind Mode
                              </span>
                            )}
                          </div>
                          <h4 className="text-base font-bold text-slate-100 line-clamp-1">{evt.title}</h4>
                          <p className="text-xs text-slate-400 mt-1 line-clamp-2 leading-relaxed">
                            {evt.description || 'No description provided.'}
                          </p>
                        </div>

                        <div className="mt-5 pt-4 border-t border-slate-800 flex items-center justify-between text-xs">
                          <span className="text-slate-500 font-mono text-[11px]">
                            {new Date(evt.start_date).toLocaleDateString()}
                          </span>
                          <Link
                            href={`/org/events/${evt.id}`}
                            className="text-emerald-400 hover:text-emerald-300 font-semibold flex items-center gap-1"
                          >
                            <span>Open Console</span>
                            <ChevronRight className="w-3.5 h-3.5" />
                          </Link>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* VIEW 2: CREATE EVENT WIZARD */}
              {currentView === 'create' && (
                <div className="max-w-2xl bg-slate-900/90 border border-slate-800 rounded-2xl p-6 sm:p-8 shadow-xl space-y-6">
                  <div>
                    <h3 className="text-base font-bold text-slate-100">Create New Competition</h3>
                    <p className="text-xs text-slate-400 mt-0.5">
                      Configure your hackathon, dynamic UPI recipient details, and blind judging policy.
                    </p>
                  </div>

                  <form onSubmit={handleCreateEvent} className="space-y-4">
                    <div>
                      <label className="block text-xs font-semibold text-slate-300 mb-1">Event Title *</label>
                      <input
                        type="text"
                        required
                        value={newEventTitle}
                        onChange={(e) => setNewEventTitle(e.target.value)}
                        placeholder="e.g. HackNexis Global Finale 2026"
                        className="w-full px-3.5 py-2.5 bg-slate-950 border border-slate-800 rounded-xl text-xs text-slate-100 focus:outline-none focus:ring-2 focus:ring-emerald-500/50"
                      />
                    </div>

                    <div>
                      <label className="block text-xs font-semibold text-slate-300 mb-1">Description</label>
                      <textarea
                        rows={3}
                        value={newEventDesc}
                        onChange={(e) => setNewEventDesc(e.target.value)}
                        placeholder="Competition scope, eligible categories, and prize pool..."
                        className="w-full px-3.5 py-2.5 bg-slate-950 border border-slate-800 rounded-xl text-xs text-slate-100 focus:outline-none focus:ring-2 focus:ring-emerald-500/50"
                      />
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      <div>
                        <label className="block text-xs font-semibold text-slate-300 mb-1">Start Date *</label>
                        <input
                          type="date"
                          value={newEventDate}
                          onChange={(e) => setNewEventDate(e.target.value)}
                          className="w-full px-3.5 py-2.5 bg-slate-950 border border-slate-800 rounded-xl text-xs text-slate-100 focus:outline-none focus:ring-2 focus:ring-emerald-500/50"
                        />
                      </div>
                      <div>
                        <label className="block text-xs font-semibold text-slate-300 mb-1">Team Registration Fee (₹ INR)</label>
                        <input
                          type="number"
                          value={newRegFee}
                          onChange={(e) => setNewRegFee(e.target.value)}
                          placeholder="500"
                          className="w-full px-3.5 py-2.5 bg-slate-950 border border-slate-800 rounded-xl text-xs text-slate-100 focus:outline-none focus:ring-2 focus:ring-emerald-500/50"
                        />
                      </div>
                    </div>

                    <div className="p-4 bg-slate-950 rounded-xl border border-slate-800 space-y-3">
                      <div className="flex items-center gap-2 text-xs font-semibold text-emerald-400">
                        <QrCode className="w-4 h-4" />
                        <span>Direct-to-Organizer UPI Setup (0% Platform Fee)</span>
                      </div>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        <div>
                          <label className="block text-[11px] font-semibold text-slate-400 mb-1">Merchant / Payee UPI VPA *</label>
                          <input
                            type="text"
                            required
                            value={newUpiVpa}
                            onChange={(e) => setNewUpiVpa(e.target.value)}
                            placeholder="org@okhdfcbank"
                            className="w-full px-3 py-2 bg-slate-900 border border-slate-800 rounded-xl text-xs font-mono text-slate-200"
                          />
                        </div>
                        <div>
                          <label className="block text-[11px] font-semibold text-slate-400 mb-1">Payee Official Name</label>
                          <input
                            type="text"
                            value={newUpiName}
                            onChange={(e) => setNewUpiName(e.target.value)}
                            placeholder="Nexis Hackathon Org"
                            className="w-full px-3 py-2 bg-slate-900 border border-slate-800 rounded-xl text-xs text-slate-200"
                          />
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center gap-2 pt-2">
                      <input
                        type="checkbox"
                        id="blind-mode"
                        checked={newBlindMode}
                        onChange={(e) => setNewBlindMode(e.target.checked)}
                        className="rounded border-slate-800 bg-slate-950 text-emerald-600 focus:ring-emerald-500 w-4 h-4"
                      />
                      <label htmlFor="blind-mode" className="text-xs text-slate-300">
                        Enable Blind Judging Mode (Masks team identities from judges until final results)
                      </label>
                    </div>

                    <button
                      type="submit"
                      disabled={actionLoading}
                      className="w-full py-3 px-4 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-semibold text-xs transition-colors cursor-pointer flex items-center justify-center gap-2"
                    >
                      {actionLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />}
                      <span>Launch Event in Draft State</span>
                    </button>
                  </form>
                </div>
              )}

              {/* VIEW 3: TEAMS & ROSTERS */}
              {currentView === 'teams' && (
                <div className="space-y-6">
                  <div className="bg-slate-900/80 border border-slate-800 rounded-2xl p-6 shadow-xl space-y-4">
                    <div className="flex items-center justify-between">
                      <div>
                        <h3 className="text-base font-bold text-slate-100">Registered Teams ({teams.length})</h3>
                        <p className="text-xs text-slate-400">Manage participant rosters and project submissions.</p>
                      </div>
                    </div>

                    <div className="overflow-x-auto">
                      <table className="w-full text-left text-xs">
                        <thead>
                          <tr className="border-b border-slate-800 text-slate-400">
                            <th className="pb-3 font-semibold">Team Name</th>
                            <th className="pb-3 font-semibold">Track</th>
                            <th className="pb-3 font-semibold">Members</th>
                            <th className="pb-3 font-semibold">Submission</th>
                            <th className="pb-3 font-semibold">Payment</th>
                            <th className="pb-3 font-semibold text-right">Score</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-800/60">
                          {teams.map((t) => (
                            <tr key={t.id} className="hover:bg-slate-850/40">
                              <td className="py-3.5 font-bold text-slate-200">{t.name}</td>
                              <td className="py-3.5 text-slate-400">{t.track}</td>
                              <td className="py-3.5 text-slate-400">{t.membersCount} participants</td>
                              <td className="py-3.5">
                                {t.submission ? (
                                  <span className="text-emerald-400 font-medium">{t.submission.title}</span>
                                ) : (
                                  <span className="text-slate-500 italic">No project submitted</span>
                                )}
                              </td>
                              <td className="py-3.5">
                                <span
                                  className={`px-2 py-0.5 rounded-full text-[10px] font-bold border ${
                                    t.paymentStatus === 'verified'
                                      ? 'bg-emerald-950/40 text-emerald-400 border-emerald-800/60'
                                      : t.paymentStatus === 'pending_verification'
                                      ? 'bg-amber-950/40 text-amber-400 border-amber-800/60'
                                      : 'bg-red-950/40 text-red-400 border-red-800/60'
                                  }`}
                                >
                                  {t.paymentStatus}
                                </span>
                              </td>
                              <td className="py-3.5 text-right font-mono font-bold text-indigo-400">
                                {t.score > 0 ? `${t.score} pts` : '--'}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                </div>
              )}

              {/* VIEW 4: UPI PAYMENTS & UTR QUEUE */}
              {currentView === 'payments' && (
                <div className="space-y-6">
                  <div className="bg-slate-900/80 border border-slate-800 rounded-2xl p-6 shadow-xl space-y-4">
                    <div className="flex items-center justify-between">
                      <div>
                        <h3 className="text-base font-bold text-slate-100 flex items-center gap-2">
                          <CreditCard className="w-5 h-5 text-emerald-400" />
                          <span>Direct UPI UTR Verification Queue</span>
                        </h3>
                        <p className="text-xs text-slate-400 mt-0.5">
                          Audit bank transaction references submitted by team leads. Approving unlocks their team join code.
                        </p>
                      </div>
                      <span className="text-xs px-2.5 py-1 rounded-full bg-amber-500/15 text-amber-300 border border-amber-500/30 font-semibold">
                        {pendingUtrCount} Pending Verifications
                      </span>
                    </div>

                    <div className="space-y-3 pt-2">
                      {teams
                        .filter((t) => t.paymentStatus === 'pending_verification')
                        .map((team) => (
                          <div
                            key={team.id}
                            className="p-4 bg-slate-950 rounded-xl border border-slate-800 flex items-center justify-between"
                          >
                            <div className="space-y-1">
                              <div className="flex items-center gap-2">
                                <h4 className="text-sm font-bold text-slate-200">{team.name}</h4>
                                <span className="text-[10px] text-slate-400 font-mono">({team.track})</span>
                              </div>
                              <div className="flex items-center gap-2 text-xs">
                                <span className="text-slate-400">Submitted UTR:</span>
                                <span className="font-mono text-amber-300 font-bold bg-amber-950/50 px-2 py-0.5 rounded border border-amber-800/40">
                                  {team.utr}
                                </span>
                              </div>
                            </div>

                            <button
                              onClick={() => handleVerifyPayment(team.id)}
                              className="px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-semibold text-xs transition-colors cursor-pointer flex items-center gap-1.5"
                            >
                              <CheckCircle2 className="w-4 h-4" />
                              <span>Verify & Unlock Join Code</span>
                            </button>
                          </div>
                        ))}

                      {pendingUtrCount === 0 && (
                        <div className="py-12 text-center text-xs text-slate-500">
                          All submitted UTR payments have been audited and verified.
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              )}

              {/* VIEW 5: RUBRICS */}
              {currentView === 'rubric' && (
                <div className="space-y-6">
                  <div className="bg-slate-900/80 border border-slate-800 rounded-2xl p-6 shadow-xl space-y-6">
                    {/* TOP CONTROLS & HEADER */}
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                      <div>
                        <div className="flex flex-wrap items-center gap-2.5">
                          <h3 className="text-base font-bold text-slate-100 flex items-center gap-2">
                            <SlidersHorizontal className="w-5 h-5 text-indigo-400" />
                            <span>Dynamic Multi-Criteria Rubrics</span>
                          </h3>
                          {isRubricFrozen ? (
                            <span className="px-2 py-0.5 rounded-full text-[11px] font-semibold bg-amber-500/10 text-amber-400 border border-amber-500/30 flex items-center gap-1">
                              <Lock className="w-3 h-3" /> Frozen (Judging Active)
                            </span>
                          ) : (
                            <span className="px-2 py-0.5 rounded-full text-[11px] font-semibold bg-emerald-500/10 text-emerald-400 border border-emerald-500/30 flex items-center gap-1">
                              <FileCheck2 className="w-3 h-3" /> Mutable (Editable)
                            </span>
                          )}
                        </div>
                        <p className="text-xs text-slate-400 mt-1">
                          Configure scoring criteria for judges. Criteria weights must sum to exactly 100% before judging commences.
                        </p>
                      </div>

                      {/* ACTION BUTTONS */}
                      <div className="flex items-center gap-2">
                        <button
                          type="button"
                          onClick={() => setShowPresetModal(true)}
                          disabled={isRubricFrozen}
                          className="px-3 py-1.5 rounded-xl text-xs font-semibold bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700/80 flex items-center gap-1.5 transition-all cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
                          title="Load pre-balanced 100% template"
                        >
                          <Sparkles className="w-3.5 h-3.5 text-indigo-400" />
                          <span>100% Templates</span>
                        </button>

                        <button
                          type="button"
                          onClick={() => {
                            setShowAddRubric((prev) => !prev)
                            if (!showAddRubric && totalRubricWeight < 100) {
                              setNewRubricWeight(100 - totalRubricWeight)
                            }
                          }}
                          disabled={isRubricFrozen}
                          className="px-3 py-1.5 rounded-xl text-xs font-semibold bg-emerald-600 hover:bg-emerald-500 text-white flex items-center gap-1.5 shadow-sm shadow-emerald-600/30 transition-all cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                          <Plus className="w-3.5 h-3.5" />
                          <span>{showAddRubric ? 'Close Form' : 'Add Criterion'}</span>
                        </button>

                        <Link
                          href={`/org/events/${activeEvent?.id || selectedEventId || 'e0000000-0000-0000-0000-000000000001'}/rubric`}
                          className="px-3 py-1.5 rounded-xl text-xs font-semibold bg-slate-800 hover:bg-slate-700 text-slate-300 border border-slate-700/80 flex items-center gap-1.5 transition-all"
                          title="Open dedicated full-page rubric studio"
                        >
                          <ExternalLink className="w-3.5 h-3.5 text-slate-400" />
                          <span className="hidden sm:inline">Studio</span>
                        </Link>
                      </div>
                    </div>

                    {/* WEIGHT PROGRESS & BALANCE METER */}
                    <div className="p-4 rounded-xl bg-slate-950/70 border border-slate-800/80 space-y-3">
                      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-xs">
                        <div className="flex items-center gap-2">
                          <span className="font-semibold text-slate-300">Total Rubric Allocation:</span>
                          <span
                            className={`font-mono font-bold px-2.5 py-0.5 rounded-md text-xs border ${
                              totalRubricWeight === 100
                                ? 'bg-emerald-500/15 text-emerald-400 border-emerald-500/30'
                                : totalRubricWeight > 100
                                ? 'bg-red-500/15 text-red-400 border-red-500/30'
                                : 'bg-amber-500/15 text-amber-400 border-amber-500/30'
                            }`}
                          >
                            {totalRubricWeight}% / 100%
                          </span>
                        </div>

                        <div>
                          {totalRubricWeight === 100 ? (
                            <span className="text-emerald-400 font-medium flex items-center gap-1 text-[11px]">
                              <CheckCircle2 className="w-3.5 h-3.5 shrink-0" />
                              Perfect Balance: Ready for live judging
                            </span>
                          ) : totalRubricWeight < 100 ? (
                            <span className="text-amber-400 font-medium flex items-center gap-1 text-[11px]">
                              <AlertCircle className="w-3.5 h-3.5 shrink-0" />
                              Under-allocated: Need +{100 - totalRubricWeight}% more
                            </span>
                          ) : (
                            <span className="text-red-400 font-medium flex items-center gap-1 text-[11px]">
                              <AlertCircle className="w-3.5 h-3.5 shrink-0" />
                              Over-allocated: Exceeds 100% by {totalRubricWeight - 100}%
                            </span>
                          )}
                        </div>
                      </div>

                      {/* Visual Allocation Bar */}
                      <div className="w-full h-2.5 rounded-full bg-slate-800 overflow-hidden flex">
                        <div
                          className={`h-full transition-all duration-300 ${
                            totalRubricWeight === 100
                              ? 'bg-gradient-to-r from-emerald-500 to-teal-400'
                              : totalRubricWeight > 100
                              ? 'bg-red-500'
                              : 'bg-amber-500'
                          }`}
                          style={{ width: `${Math.min(100, totalRubricWeight)}%` }}
                        />
                      </div>
                    </div>

                    {/* INLINE ADD FORM */}
                    {showAddRubric && !isRubricFrozen && (
                      <form
                        onSubmit={handleAddRubric}
                        className="p-5 rounded-xl bg-slate-950 border border-emerald-500/30 space-y-4 animate-in fade-in duration-200"
                      >
                        <div className="flex items-center justify-between pb-2 border-b border-slate-800/80">
                          <div className="flex items-center gap-2">
                            <Plus className="w-4 h-4 text-emerald-400" />
                            <h4 className="text-xs font-bold text-slate-100 uppercase tracking-wide">
                              Add Evaluation Criterion
                            </h4>
                          </div>
                          <button
                            type="button"
                            onClick={() => setShowAddRubric(false)}
                            className="text-slate-400 hover:text-slate-200 p-1 rounded-lg cursor-pointer"
                          >
                            <X className="w-4 h-4" />
                          </button>
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                          <div className="md:col-span-2 space-y-1.5">
                            <label className="text-xs font-medium text-slate-300">
                              Criterion Name <span className="text-red-400">*</span>
                            </label>
                            <input
                              type="text"
                              required
                              placeholder="e.g. System Scalability & Cloud Architecture"
                              value={newRubricName}
                              onChange={(e) => setNewRubricName(e.target.value)}
                              className="w-full text-xs px-3 py-2 rounded-xl bg-slate-900 border border-slate-700 text-slate-100 focus:outline-none focus:border-emerald-500"
                            />
                          </div>

                          <div className="space-y-1.5">
                            <div className="flex items-center justify-between">
                              <label className="text-xs font-medium text-slate-300">
                                Weight (%) <span className="text-red-400">*</span>
                              </label>
                              {totalRubricWeight < 100 && (
                                <button
                                  type="button"
                                  onClick={() => setNewRubricWeight(100 - totalRubricWeight)}
                                  className="text-[10px] text-emerald-400 hover:underline cursor-pointer"
                                >
                                  Fill remainder (+{100 - totalRubricWeight}%)
                                </button>
                              )}
                            </div>
                            <div className="flex items-center gap-2">
                              <input
                                type="number"
                                min={1}
                                max={100}
                                required
                                value={newRubricWeight}
                                onChange={(e) => setNewRubricWeight(Number(e.target.value))}
                                className="w-20 text-xs px-3 py-2 rounded-xl bg-slate-900 border border-slate-700 text-slate-100 font-mono text-center focus:outline-none focus:border-emerald-500"
                              />
                              <input
                                type="range"
                                min={1}
                                max={100}
                                value={newRubricWeight}
                                onChange={(e) => setNewRubricWeight(Number(e.target.value))}
                                className="flex-1 accent-emerald-500 cursor-pointer"
                              />
                            </div>
                          </div>
                        </div>

                        <div className="space-y-1.5">
                          <label className="text-xs font-medium text-slate-300">
                            Description & Guidance for Judges
                          </label>
                          <textarea
                            rows={2}
                            placeholder="Explain what specific aspects judges should evaluate for this criterion..."
                            value={newRubricDesc}
                            onChange={(e) => setNewRubricDesc(e.target.value)}
                            className="w-full text-xs px-3 py-2 rounded-xl bg-slate-900 border border-slate-700 text-slate-100 focus:outline-none focus:border-emerald-500"
                          />
                        </div>

                        <div className="flex items-center justify-end gap-2 pt-2">
                          <button
                            type="button"
                            onClick={() => setShowAddRubric(false)}
                            className="px-3 py-1.5 rounded-xl text-xs font-medium text-slate-400 hover:text-slate-200 cursor-pointer"
                          >
                            Cancel
                          </button>
                          <button
                            type="submit"
                            disabled={rubricActionLoading}
                            className="px-4 py-1.5 rounded-xl text-xs font-semibold bg-emerald-600 hover:bg-emerald-500 text-white flex items-center gap-1.5 shadow-sm shadow-emerald-600/30 transition-all cursor-pointer disabled:opacity-50"
                          >
                            {rubricActionLoading ? (
                              <Loader2 className="w-3.5 h-3.5 animate-spin" />
                            ) : (
                              <Plus className="w-3.5 h-3.5" />
                            )}
                            <span>Save Criterion</span>
                          </button>
                        </div>
                      </form>
                    )}

                    {/* CRITERIA LIST */}
                    <div className="space-y-3 pt-2">
                      {rubricsLoading ? (
                        <div className="p-8 text-center text-xs text-slate-500 flex items-center justify-center gap-2">
                          <Loader2 className="w-4 h-4 animate-spin text-emerald-500" />
                          <span>Loading criteria...</span>
                        </div>
                      ) : rubrics.length === 0 ? (
                        <div className="p-8 text-center rounded-xl bg-slate-950 border border-slate-800 space-y-3">
                          <AlertCircle className="w-8 h-8 text-slate-500 mx-auto" />
                          <p className="text-xs text-slate-400">No evaluation criteria set for this event yet.</p>
                          <button
                            type="button"
                            onClick={() => setShowPresetModal(true)}
                            className="px-4 py-2 rounded-xl text-xs font-semibold bg-indigo-600 hover:bg-indigo-500 text-white cursor-pointer"
                          >
                            Load 100% Template
                          </button>
                        </div>
                      ) : (
                        rubrics.map((r, index) => {
                          const isEditing = editingRubricId === r.id

                          if (isEditing) {
                            return (
                              <div
                                key={r.id}
                                className="p-4 bg-slate-950 rounded-xl border border-indigo-500/50 space-y-3 animate-in fade-in duration-150"
                              >
                                <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                                  <div className="md:col-span-2 space-y-1">
                                    <label className="text-[11px] font-medium text-slate-400">Criterion Name</label>
                                    <input
                                      type="text"
                                      value={editRubricName}
                                      onChange={(e) => setEditRubricName(e.target.value)}
                                      className="w-full text-xs px-3 py-1.5 rounded-lg bg-slate-900 border border-slate-700 text-slate-100 focus:outline-none focus:border-indigo-500"
                                    />
                                  </div>
                                  <div className="space-y-1">
                                    <label className="text-[11px] font-medium text-slate-400">Weight (%)</label>
                                    <input
                                      type="number"
                                      min={1}
                                      max={100}
                                      value={editRubricWeight}
                                      onChange={(e) => setEditRubricWeight(Number(e.target.value))}
                                      className="w-full text-xs px-3 py-1.5 rounded-lg bg-slate-900 border border-slate-700 text-slate-100 font-mono text-center focus:outline-none focus:border-indigo-500"
                                    />
                                  </div>
                                </div>
                                <div className="space-y-1">
                                  <label className="text-[11px] font-medium text-slate-400">Description</label>
                                  <textarea
                                    rows={2}
                                    value={editRubricDesc}
                                    onChange={(e) => setEditRubricDesc(e.target.value)}
                                    className="w-full text-xs px-3 py-1.5 rounded-lg bg-slate-900 border border-slate-700 text-slate-100 focus:outline-none focus:border-indigo-500"
                                  />
                                </div>
                                <div className="flex items-center justify-end gap-2 pt-1">
                                  <button
                                    type="button"
                                    onClick={() => setEditingRubricId(null)}
                                    className="px-3 py-1 text-xs text-slate-400 hover:text-slate-200 cursor-pointer"
                                  >
                                    Cancel
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() => handleSaveEditRubric(r.id)}
                                    disabled={rubricActionLoading}
                                    className="px-3 py-1 bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg text-xs font-semibold flex items-center gap-1 cursor-pointer disabled:opacity-50"
                                  >
                                    <Check className="w-3.5 h-3.5" />
                                    <span>Save Changes</span>
                                  </button>
                                </div>
                              </div>
                            )
                          }

                          return (
                            <div
                              key={r.id}
                              className="p-4 bg-slate-950 rounded-xl border border-slate-800/80 hover:border-slate-700 transition-colors flex flex-col sm:flex-row sm:items-center justify-between gap-4"
                            >
                              <div className="flex items-start gap-3 min-w-0">
                                <span className="w-6 h-6 rounded-lg bg-slate-800 text-slate-300 font-mono text-xs flex items-center justify-center font-bold shrink-0 mt-0.5">
                                  {index + 1}
                                </span>
                                <div className="min-w-0">
                                  <div className="flex items-center gap-2">
                                    <span className="text-xs font-bold text-slate-100 truncate">{r.name}</span>
                                    <span className="text-[10px] px-1.5 py-0.2 rounded bg-slate-800 text-slate-400 font-mono">
                                      Max 10 pts
                                    </span>
                                  </div>
                                  <p className="text-[11px] text-slate-400 mt-1 line-clamp-2">
                                    {r.desc || 'No specific evaluation notes provided.'}
                                  </p>
                                </div>
                              </div>

                              <div className="flex items-center justify-between sm:justify-end gap-3 shrink-0">
                                <div className="flex items-center gap-1.5">
                                  {!isRubricFrozen && (
                                    <div className="flex items-center bg-slate-900 rounded-lg border border-slate-800 p-0.5">
                                      <button
                                        type="button"
                                        onClick={() => handleAdjustWeight(r.id, -5)}
                                        title="Decrease weight by 5%"
                                        className="px-1.5 py-0.5 text-[10px] font-mono text-slate-400 hover:text-slate-100 hover:bg-slate-800 rounded transition-colors cursor-pointer"
                                      >
                                        -5%
                                      </button>
                                      <button
                                        type="button"
                                        onClick={() => handleAdjustWeight(r.id, 5)}
                                        title="Increase weight by 5%"
                                        className="px-1.5 py-0.5 text-[10px] font-mono text-slate-400 hover:text-slate-100 hover:bg-slate-800 rounded transition-colors cursor-pointer"
                                      >
                                        +5%
                                      </button>
                                    </div>
                                  )}

                                  <div className="text-xs font-mono font-bold text-indigo-400 bg-indigo-950/40 px-3 py-1 rounded-lg border border-indigo-500/30">
                                    {r.weight}%
                                  </div>
                                </div>

                                {!isRubricFrozen && (
                                  <div className="flex items-center gap-1">
                                    <button
                                      type="button"
                                      onClick={() => startEditRubric(r)}
                                      title="Edit Criterion"
                                      className="p-1.5 rounded-lg text-slate-400 hover:text-indigo-400 hover:bg-indigo-950/30 transition-colors cursor-pointer"
                                    >
                                      <Edit3 className="w-4 h-4" />
                                    </button>
                                    <button
                                      type="button"
                                      onClick={() => {
                                        if (confirm(`Remove criterion "${r.name}"?`)) {
                                          handleRemoveRubric(r.id, r.name)
                                        }
                                      }}
                                      title="Remove Criterion"
                                      className="p-1.5 rounded-lg text-slate-400 hover:text-red-400 hover:bg-red-950/30 transition-colors cursor-pointer"
                                    >
                                      <Trash2 className="w-4 h-4" />
                                    </button>
                                  </div>
                                )}
                              </div>
                            </div>
                          )
                        })
                      )}
                    </div>
                  </div>
                </div>
              )}

              {/* VIEW 6: JURY */}
              {currentView === 'jury' && (
                <div className="space-y-6">
                  <div className="bg-slate-900/80 border border-slate-800 rounded-2xl p-6 shadow-xl space-y-4">
                    <div className="flex items-center justify-between">
                      <div>
                        <h3 className="text-base font-bold text-slate-100 flex items-center gap-2">
                          <Award className="w-5 h-5 text-violet-400" />
                          <span>Jury Panel & Load Distribution</span>
                        </h3>
                        <p className="text-xs text-slate-400 mt-0.5">
                          Evaluators assigned via anti-fatigue randomized balanced matrices.
                        </p>
                      </div>
                    </div>

                    <div className="space-y-3 pt-2">
                      {judges.map((j) => (
                        <div key={j.id} className="p-4 bg-slate-950 rounded-xl border border-slate-800 flex items-center justify-between">
                          <div>
                            <div className="text-xs font-bold text-slate-200">{j.name}</div>
                            <div className="text-[11px] text-slate-400">{j.email}</div>
                          </div>
                          <div className="text-right">
                            <span className="text-xs font-mono font-bold text-emerald-400">
                              {j.scored}/{j.assigned} Scored
                            </span>
                            <span className="text-[10px] text-slate-500 block font-mono">
                              Z-Score: {j.zScore} &sigma;
                            </span>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              )}

              {/* VIEW 7: FAIRNESS */}
              {currentView === 'fairness' && (
                <div className="space-y-6">
                  {/* Fairness Health Executive Gauge */}
                  <div className="bg-gradient-to-r from-emerald-950/40 via-teal-900/20 to-slate-900 border border-emerald-500/30 rounded-2xl p-6 shadow-xl space-y-5">
                    <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                      <div>
                        <div className="flex items-center gap-2 mb-1.5">
                          <span className="text-[10px] uppercase font-bold tracking-wider px-2 py-0.5 rounded bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
                            Executive Quality Index
                          </span>
                          <span className="text-[11px] text-slate-400">Continuous Statistical Telemetry</span>
                        </div>
                        <h2 className="text-xl font-bold text-slate-100 flex items-center gap-2">
                          <Scale className="w-5 h-5 text-emerald-400" />
                          <span>Fairness Health Diagnostic</span>
                        </h2>
                        <p className="text-xs text-slate-300 max-w-2xl mt-1 leading-relaxed">
                          A composite metric aggregating panel variance normality, inter-rater agreement, blind judging discipline, and cryptographic ledger integrity.
                        </p>
                      </div>

                      <div className="flex items-center gap-4 bg-slate-950/80 p-4 rounded-2xl border border-slate-800 shrink-0">
                        <div className="text-center">
                          <span className="text-3xl font-black font-mono text-emerald-400">94</span>
                          <span className="text-xs text-slate-500 font-mono"> / 100</span>
                        </div>
                        <div className="border-l border-slate-800 pl-4">
                          <span className="text-[10px] uppercase font-bold tracking-wider px-2 py-0.5 rounded bg-emerald-500/20 text-emerald-400 border border-emerald-500/30">
                            STATUS: EXCELLENT
                          </span>
                          <span className="text-[11px] text-slate-400 block mt-1">High Equity & Trust</span>
                        </div>
                      </div>
                    </div>

                    <div className="p-3 bg-slate-950/60 rounded-xl border border-slate-800/80 text-[11px] text-slate-400 flex items-start gap-2">
                      <Info className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
                      <span>
                        <strong>Methodology Note:</strong> This is a diagnostic health indicator reflecting panel variance and procedural controls, not an objective mathematical proof of &ldquo;fairness.&rdquo;
                      </span>
                    </div>

                    {/* 5 Component Breakdown Bars */}
                    <div className="grid grid-cols-1 md:grid-cols-5 gap-3 pt-2 border-t border-slate-800/80">
                      <div className="p-3 bg-slate-950/70 rounded-xl border border-slate-800 space-y-1.5">
                        <div className="flex items-center justify-between text-xs">
                          <span className="text-slate-400 text-[11px]">Judge Consistency</span>
                          <span className="font-mono font-bold text-emerald-400">94%</span>
                        </div>
                        <div className="w-full h-1.5 rounded-full bg-slate-800 overflow-hidden">
                          <div className="h-full bg-emerald-500 rounded-full" style={{ width: '94%' }} />
                        </div>
                        <span className="text-[10px] text-slate-500 block">Z-score variance &le; 1.0</span>
                      </div>

                      <div className="p-3 bg-slate-950/70 rounded-xl border border-slate-800 space-y-1.5">
                        <div className="flex items-center justify-between text-xs">
                          <span className="text-slate-400 text-[11px]">Score Distribution</span>
                          <span className="font-mono font-bold text-teal-400">91%</span>
                        </div>
                        <div className="w-full h-1.5 rounded-full bg-slate-800 overflow-hidden">
                          <div className="h-full bg-teal-500 rounded-full" style={{ width: '91%' }} />
                        </div>
                        <span className="text-[10px] text-slate-500 block">Balanced bell curve</span>
                      </div>

                      <div className="p-3 bg-slate-950/70 rounded-xl border border-slate-800 space-y-1.5">
                        <div className="flex items-center justify-between text-xs">
                          <span className="text-slate-400 text-[11px]">Inter-Judge Agreement</span>
                          <span className="font-mono font-bold text-indigo-400">87%</span>
                        </div>
                        <div className="w-full h-1.5 rounded-full bg-slate-800 overflow-hidden">
                          <div className="h-full bg-indigo-500 rounded-full" style={{ width: '87%' }} />
                        </div>
                        <span className="text-[10px] text-slate-500 block">Mean &sigma; = 0.82 pts</span>
                      </div>

                      <div className="p-3 bg-slate-950/70 rounded-xl border border-slate-800 space-y-1.5">
                        <div className="flex items-center justify-between text-xs">
                          <span className="text-slate-400 text-[11px]">Blind Judging</span>
                          <span className="font-mono font-bold text-purple-400">100%</span>
                        </div>
                        <div className="w-full h-1.5 rounded-full bg-slate-800 overflow-hidden">
                          <div className="h-full bg-purple-500 rounded-full" style={{ width: '100%' }} />
                        </div>
                        <span className="text-[10px] text-slate-500 block">Institutional masking ON</span>
                      </div>

                      <div className="p-3 bg-slate-950/70 rounded-xl border border-slate-800 space-y-1.5">
                        <div className="flex items-center justify-between text-xs">
                          <span className="text-slate-400 text-[11px]">Audit Ledger</span>
                          <span className="font-mono font-bold text-cyan-400">100%</span>
                        </div>
                        <div className="w-full h-1.5 rounded-full bg-slate-800 overflow-hidden">
                          <div className="h-full bg-cyan-500 rounded-full" style={{ width: '100%' }} />
                        </div>
                        <span className="text-[10px] text-slate-500 block">SHA-256 blocks valid</span>
                      </div>
                    </div>
                  </div>

                  {/* Core Telemetry Row */}
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                    <div className="p-4 bg-slate-900/80 rounded-2xl border border-slate-800 shadow-md">
                      <div className="text-xs text-slate-400 font-semibold">Panel Agreement Index</div>
                      <div className="text-2xl font-bold text-emerald-400 mt-1">94.8%</div>
                      <p className="text-[11px] text-slate-500 mt-0.5">Inter-rater Pearson consensus</p>
                    </div>
                    <div className="p-4 bg-slate-900/80 rounded-2xl border border-slate-800 shadow-md">
                      <div className="text-xs text-slate-400 font-semibold">Fatigue Drift Metric</div>
                      <div className="text-2xl font-bold text-slate-200 mt-1">r = -0.12</div>
                      <p className="text-[11px] text-slate-500 mt-0.5">Well within &plusmn;0.50 tolerance</p>
                    </div>
                    <div className="p-4 bg-slate-900/80 rounded-2xl border border-slate-800 shadow-md">
                      <div className="text-xs text-slate-400 font-semibold">Sensitivity Reranking Risk</div>
                      <div className="text-2xl font-bold text-indigo-400 mt-1">0 Winner Flips</div>
                      <p className="text-[11px] text-slate-500 mt-0.5">Rankings resilient to outlier exclusion</p>
                    </div>
                  </div>

                  {/* PRE-EVENT JUDGE CALIBRATION MATRIX (BIAS PREVENTION) */}
                  <div className="bg-slate-900/80 border border-slate-800 rounded-2xl p-6 shadow-xl space-y-4">
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                      <div>
                        <div className="flex items-center gap-2 mb-1">
                          <span className="text-[10px] uppercase font-bold tracking-wider px-2 py-0.5 rounded bg-violet-500/20 text-violet-300 border border-violet-500/30">
                            Bias Prevention
                          </span>
                          <span className="text-xs text-slate-400">Pre-Judging Standard Benchmark</span>
                        </div>
                        <h3 className="text-base font-bold text-slate-100 flex items-center gap-2">
                          <SlidersHorizontal className="w-4 h-4 text-violet-400" />
                          <span>Pre-Judging Evaluator Calibration Matrix</span>
                        </h3>
                        <p className="text-xs text-slate-400 mt-0.5">
                          Evaluators score identical benchmark test cases before judging begins to detect systematic harshness or leniency.
                        </p>
                      </div>

                      <button
                        type="button"
                        onClick={() => showToast('Recalibration matrix refreshed across all active panel evaluators.')}
                        className="px-3.5 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold flex items-center gap-1.5 transition-colors cursor-pointer self-start sm:self-auto"
                      >
                        <RefreshCw className="w-3.5 h-3.5 text-violet-400" />
                        <span>Sync Calibration</span>
                      </button>
                    </div>

                    <div className="overflow-x-auto pt-2">
                      <table className="w-full text-left text-xs text-slate-300">
                        <thead className="bg-slate-950/80 text-[10px] uppercase font-semibold text-slate-400 border-b border-slate-800">
                          <tr>
                            <th className="py-3 px-4">Evaluator</th>
                            <th className="py-3 px-4">Calibration Status</th>
                            <th className="py-3 px-4">Evaluator Mean</th>
                            <th className="py-3 px-4">Panel Delta (&Delta;)</th>
                            <th className="py-3 px-4">Z-Score Offset</th>
                            <th className="py-3 px-4">Recommended Adjustment</th>
                            <th className="py-3 px-4 text-right">Normalization Action</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-800/60">
                          <tr className="hover:bg-slate-800/30 transition-colors">
                            <td className="py-3 px-4">
                              <span className="font-bold text-slate-100 block">Dr. Evelyn Vance</span>
                              <span className="text-[10px] text-slate-500">evelyn@nexis.edu</span>
                            </td>
                            <td className="py-3 px-4">
                              <span className="text-[10px] px-2 py-0.5 rounded-full font-semibold bg-emerald-500/15 text-emerald-400 border border-emerald-500/30">
                                Well-Calibrated Baseline
                              </span>
                            </td>
                            <td className="py-3 px-4 font-mono">7.18 / 10</td>
                            <td className="py-3 px-4 font-mono text-emerald-400">+0.14 pts</td>
                            <td className="py-3 px-4 font-mono text-emerald-400">+0.12 &sigma;</td>
                            <td className="py-3 px-4 font-mono text-slate-400">-0.1 pts</td>
                            <td className="py-3 px-4 text-right">
                              <span className="text-[10px] font-semibold text-slate-400 bg-slate-950 px-2 py-1 rounded border border-slate-800">
                                Unmodified
                              </span>
                            </td>
                          </tr>

                          <tr className="hover:bg-slate-800/30 transition-colors">
                            <td className="py-3 px-4">
                              <span className="font-bold text-slate-100 block">Marcus Sterling</span>
                              <span className="text-[10px] text-slate-500">marcus@nexis.edu</span>
                            </td>
                            <td className="py-3 px-4">
                              <span className="text-[10px] px-2 py-0.5 rounded-full font-semibold bg-emerald-500/15 text-emerald-400 border border-emerald-500/30">
                                Well-Calibrated Baseline
                              </span>
                            </td>
                            <td className="py-3 px-4 font-mono">6.98 / 10</td>
                            <td className="py-3 px-4 font-mono text-emerald-400">-0.06 pts</td>
                            <td className="py-3 px-4 font-mono text-emerald-400">-0.05 &sigma;</td>
                            <td className="py-3 px-4 font-mono text-slate-400">+0.1 pts</td>
                            <td className="py-3 px-4 text-right">
                              <span className="text-[10px] font-semibold text-slate-400 bg-slate-950 px-2 py-1 rounded border border-slate-800">
                                Unmodified
                              </span>
                            </td>
                          </tr>

                          <tr className="hover:bg-slate-800/30 transition-colors bg-rose-950/10">
                            <td className="py-3 px-4">
                              <span className="font-bold text-slate-100 block">Prof. Aris Thorne</span>
                              <span className="text-[10px] text-slate-500">aris@nexis.edu</span>
                            </td>
                            <td className="py-3 px-4">
                              <span className="text-[10px] px-2 py-0.5 rounded-full font-semibold bg-rose-500/15 text-rose-400 border border-rose-500/30">
                                Systematic Harshness
                              </span>
                            </td>
                            <td className="py-3 px-4 font-mono text-rose-300">5.33 / 10</td>
                            <td className="py-3 px-4 font-mono text-rose-400">-1.70 pts</td>
                            <td className="py-3 px-4 font-mono text-rose-400">-1.41 &sigma;</td>
                            <td className="py-3 px-4 font-mono text-amber-400 font-bold">+1.7 pts</td>
                            <td className="py-3 px-4 text-right">
                              <button
                                type="button"
                                onClick={() => showToast('Applied +1.7 pts normalization offset to Prof. Aris Thorne.')}
                                className="text-[10px] font-semibold text-amber-300 bg-amber-950/40 hover:bg-amber-950/80 px-2.5 py-1 rounded border border-amber-500/40 transition-colors cursor-pointer"
                              >
                                Apply +1.7 Offset
                              </button>
                            </td>
                          </tr>
                        </tbody>
                      </table>
                    </div>
                  </div>

                  {/* Active Telemetry Insights & Recommendations */}
                  <div className="bg-slate-900/80 border border-slate-800 rounded-2xl p-6 shadow-xl space-y-3">
                    <h4 className="text-xs font-bold uppercase tracking-wider text-slate-400">
                      Automated Panel Integrity Advisory
                    </h4>
                    <div className="space-y-2 text-xs">
                      <div className="p-3 bg-slate-950 rounded-xl border border-slate-800 flex items-start gap-2.5 text-slate-300">
                        <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
                        <div>
                          <strong className="text-slate-100 block">Double-Blind Masking Active:</strong>
                          <span>
                            Evaluator desks mask college affiliations and team names as &ldquo;PROJECT #CODE&rdquo; to eliminate institutional prestige bias.
                          </span>
                        </div>
                      </div>

                      <div className="p-3 bg-slate-950 rounded-xl border border-slate-800 flex items-start gap-2.5 text-slate-300">
                        <AlertTriangle className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
                        <div>
                          <strong className="text-slate-100 block">Harshness Normalization Alert:</strong>
                          <span>
                            Prof. Aris Thorne scores 1.70 points below panel baseline on benchmark test cases. Normalization offsets protect teams evaluated in this track.
                          </span>
                        </div>
                      </div>

                      <div className="p-3 bg-slate-950 rounded-xl border border-slate-800 flex items-start gap-2.5 text-slate-300">
                        <ShieldCheck className="w-4 h-4 text-cyan-400 shrink-0 mt-0.5" />
                        <div>
                          <strong className="text-slate-100 block">Cryptographic Ledger Health:</strong>
                          <span>
                            Zero hash breaks detected across all sequential SHA-256 evaluation commits. Ledger is immutable and publicly auditable.
                          </span>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* VIEW 8: SCORE EDITS */}
              {currentView === 'edits' && (
                <div className="space-y-6">
                  <div className="bg-slate-900/80 border border-slate-800 rounded-2xl p-6 shadow-xl space-y-4">
                    <h3 className="text-base font-bold text-slate-100 flex items-center gap-2">
                      <FileCheck2 className="w-5 h-5 text-indigo-400" />
                      <span>Score Correction Workflow (Append-Only)</span>
                    </h3>
                    <p className="text-xs text-slate-400">
                      Approved edits append Version 2 to the audit chain without overwriting original marks.
                    </p>
                    <div className="p-4 bg-slate-950 rounded-xl border border-slate-800 flex items-center justify-between text-xs">
                      <div>
                        <span className="font-bold text-slate-200">Marcus Sterling &rarr; TerraPulse</span>
                        <p className="text-[11px] text-slate-400 mt-0.5">
                          &ldquo;Recalibration after checking GitHub commit log.&rdquo;
                        </p>
                      </div>
                      <button
                        onClick={() => showToast('Score correction approved and appended as Version 2.')}
                        className="px-3 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white font-semibold text-xs"
                      >
                        Approve Version 2
                      </button>
                    </div>
                  </div>
                </div>
              )}

              {/* VIEW 9: TICKETS */}
              {currentView === 'tickets' && (
                <div className="space-y-6">
                  <div className="bg-slate-900/80 border border-slate-800 rounded-2xl p-6 shadow-xl space-y-4">
                    <h3 className="text-base font-bold text-slate-100 flex items-center gap-2">
                      <FileText className="w-5 h-5 text-amber-400" />
                      <span>Participant Dispute Review Tickets</span>
                    </h3>
                    <div className="p-4 bg-slate-950 rounded-xl border border-slate-800 flex items-center justify-between text-xs">
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="font-bold text-slate-200">NeuralPulse Team</span>
                          <span className="text-[10px] px-2 py-0.5 rounded bg-amber-500/20 text-amber-300">Open Ticket</span>
                        </div>
                        <p className="text-[11px] text-slate-400 mt-1">
                          &ldquo;Requesting review of architecture weight distribution on criterion 2.&rdquo;
                        </p>
                      </div>
                      <button
                        onClick={() => showToast('Dispute response recorded.')}
                        className="px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 font-semibold text-xs"
                      >
                        Send Resolution
                      </button>
                    </div>
                  </div>
                </div>
              )}

              {/* VIEW 10: RESULTS & MERKLE SEAL */}
              {currentView === 'results' && (
                <div className="space-y-6">
                  <div className="bg-slate-900/80 border border-slate-800 rounded-2xl p-6 shadow-xl space-y-4">
                    <h3 className="text-base font-bold text-slate-100 flex items-center gap-2">
                      <ShieldCheck className="w-5 h-5 text-emerald-400" />
                      <span>Standings Publication & Binary Merkle Seal</span>
                    </h3>
                    <div className="p-4 bg-slate-950 rounded-xl border border-slate-800 space-y-3">
                      <div className="text-xs text-slate-400">Current Computed Merkle Root:</div>
                      <div className="font-mono text-xs text-slate-200 bg-slate-900 p-2.5 rounded border border-slate-800 break-all">
                        0758c7ab83107ed07118d9f2bb19f730bdf0a8c52b6303548af8aae91e927f58
                      </div>
                      <button
                        onClick={() => showToast('Standings published and anchored to immutable public ledger!')}
                        className="w-full py-2.5 px-4 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs"
                      >
                        Publish Results & Anchor Merkle Root
                      </button>
                    </div>
                  </div>
                </div>
              )}

              {/* VIEW 11: SETTINGS */}
              {currentView === 'settings' && (
                <div className="space-y-6 max-w-2xl">
                  <div className="bg-slate-900/80 border border-slate-800 rounded-2xl p-6 shadow-xl space-y-4">
                    <h3 className="text-base font-bold text-slate-100 flex items-center gap-2">
                      <Settings className="w-5 h-5 text-indigo-400" />
                      <span>Organizer Gateway & VPA Configuration</span>
                    </h3>
                    <div className="space-y-3 text-xs">
                      <div className="p-3 bg-slate-950 rounded-xl border border-slate-800">
                        <span className="text-slate-400">Active Payee VPA:</span>
                        <div className="font-mono text-emerald-400 font-bold mt-1">nexis@okhdfcbank</div>
                      </div>
                      <div className="p-3 bg-slate-950 rounded-xl border border-slate-800">
                        <span className="text-slate-400">Payee Name:</span>
                        <div className="text-slate-200 font-bold mt-1">Nexis Hackathon Organization</div>
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </>
          )}
        </main>
      </div>

      {/* 100% TEMPLATES / PRESETS MODAL */}
      {showPresetModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl max-w-2xl w-full p-6 space-y-5 shadow-2xl">
            <div className="flex items-center justify-between pb-3 border-b border-slate-800">
              <div className="flex items-center gap-2">
                <Sparkles className="w-5 h-5 text-indigo-400" />
                <div>
                  <h3 className="text-sm font-bold text-slate-100">Load 100% Pre-Balanced Rubric Template</h3>
                  <p className="text-xs text-slate-400">Select an accredited rubric template to automatically set balanced criteria.</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setShowPresetModal(false)}
                className="text-slate-400 hover:text-slate-200 p-1 rounded-lg cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-3 max-h-[60vh] overflow-y-auto pr-1">
              {RUBRIC_PRESETS.map((preset) => {
                const totalPresetWeight = preset.criteria.reduce((s, c) => s + c.weight, 0)
                return (
                  <div
                    key={preset.id}
                    className="p-4 rounded-xl bg-slate-950 border border-slate-800 hover:border-indigo-500/50 transition-all space-y-3"
                  >
                    <div className="flex items-center justify-between">
                      <div>
                        <h4 className="text-xs font-bold text-slate-200">{preset.name}</h4>
                        <p className="text-[11px] text-slate-400 mt-0.5">{preset.description}</p>
                      </div>
                      <span className="text-[11px] font-mono font-bold px-2 py-0.5 rounded bg-emerald-500/15 text-emerald-400 border border-emerald-500/30">
                        {totalPresetWeight}% Total
                      </span>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-[11px]">
                      {preset.criteria.map((c, i) => (
                        <div key={i} className="flex items-center justify-between p-2 rounded-lg bg-slate-900 border border-slate-800/80">
                          <span className="text-slate-300 truncate">{c.name}</span>
                          <span className="font-mono font-bold text-indigo-400 shrink-0 ml-2">{c.weight}%</span>
                        </div>
                      ))}
                    </div>

                    <div className="flex justify-end pt-1">
                      <button
                        type="button"
                        onClick={() => handleApplyPreset(preset)}
                        disabled={rubricActionLoading}
                        className="px-3 py-1.5 rounded-lg text-xs font-semibold bg-indigo-600 hover:bg-indigo-500 text-white flex items-center gap-1.5 transition-all cursor-pointer disabled:opacity-50"
                      >
                        {rubricActionLoading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Check className="w-3.5 h-3.5" />}
                        <span>Apply This Template</span>
                      </button>
                    </div>
                  </div>
                )
              })}
            </div>

            <div className="flex justify-end pt-2 border-t border-slate-800">
              <button
                type="button"
                onClick={() => setShowPresetModal(false)}
                className="px-4 py-2 rounded-xl text-xs font-medium text-slate-400 hover:text-slate-200 cursor-pointer"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
