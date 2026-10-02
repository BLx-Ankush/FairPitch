'use client'

import React, { useEffect, useState, use } from 'react'
import Link from 'next/link'
import {
  ArrowLeft,
  Scale,
  Sparkles,
  TrendingDown,
  Users,
  Trophy,
  CheckCircle,
  AlertTriangle,
  ShieldAlert,
  Loader2,
  RefreshCw,
  Camera,
  ArrowUpRight,
  ArrowDownRight,
  Minus,
  Check,
  Info,
  Calendar,
  Layers,
} from 'lucide-react'
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  ReferenceLine,
  Cell,
} from 'recharts'
import type {
  FairnessTelemetrySnapshot,
  LeaderboardRow,
  SensitivityRerankResult,
} from '@/lib/fairness/engine'

export default function EventFairnessPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = use(params)

  const [loading, setLoading] = useState(true)
  const [event, setEvent] = useState<any | null>(null)
  const [telemetry, setTelemetry] = useState<FairnessTelemetrySnapshot | null>(null)
  const [latestSnapshot, setLatestSnapshot] = useState<any | null>(null)
  const [excludedJudgeIds, setExcludedJudgeIds] = useState<string[]>([])
  const [simulation, setSimulation] = useState<SensitivityRerankResult | null>(null)
  const [simulating, setSimulating] = useState(false)
  const [snapshotting, setSnapshotting] = useState(false)
  const [notification, setNotification] = useState<{
    type: 'success' | 'error'
    text: string
  } | null>(null)

  async function loadData() {
    setLoading(true)
    try {
      const res = await fetch(`/api/org/events/${id}/fairness`)
      const data = await res.json()
      if (res.ok && data.success) {
        setEvent(data.event)
        setTelemetry(data.telemetry)
        setLatestSnapshot(data.latestSnapshot)
        setSimulation(data.telemetry.sensitivity)
        // Default excluded judges to those flagged by telemetry
        const flagged = data.telemetry.leniency
          .filter((l: any) => l.flagged)
          .map((l: any) => l.judge.id)
        setExcludedJudgeIds(flagged)
      } else {
        setNotification({
          type: 'error',
          text: data.error || 'Failed to load telemetry',
        })
      }
    } catch {
      setNotification({ type: 'error', text: 'Network connection error' })
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadData()
  }, [id])

  async function triggerSimulation(newExcluded: string[]) {
    setSimulating(true)
    setExcludedJudgeIds(newExcluded)
    try {
      const res = await fetch(`/api/org/events/${id}/fairness/simulate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ excludedJudgeIds: newExcluded }),
      })
      const data = await res.json()
      if (res.ok && data.success) {
        setSimulation(data.simulation)
      } else {
        setNotification({
          type: 'error',
          text: data.error || 'Simulation failed',
        })
      }
    } catch {
      setNotification({ type: 'error', text: 'Failed to run simulation' })
    } finally {
      setSimulating(false)
    }
  }

  function toggleJudgeExclusion(judgeId: string) {
    const isExcluded = excludedJudgeIds.includes(judgeId)
    const next = isExcluded
      ? excludedJudgeIds.filter((j) => j !== judgeId)
      : [...excludedJudgeIds, judgeId]
    triggerSimulation(next)
  }

  function excludeAllFlagged() {
    if (!telemetry) return
    const flagged = telemetry.leniency
      .filter((l) => l.flagged)
      .map((l) => l.judge.id)
    triggerSimulation(flagged)
  }

  function resetAllExclusions() {
    triggerSimulation([])
  }

  async function saveSnapshot() {
    setSnapshotting(true)
    setNotification(null)
    try {
      const res = await fetch(`/api/org/events/${id}/fairness/snapshot`, {
        method: 'POST',
      })
      const data = await res.json()
      if (res.ok && data.success) {
        setLatestSnapshot(data.report)
        setNotification({
          type: 'success',
          text: 'Fairness audit snapshot successfully computed and anchored!',
        })
      } else {
        setNotification({
          type: 'error',
          text: data.error || 'Failed to save snapshot',
        })
      }
    } catch {
      setNotification({ type: 'error', text: 'Network error saving snapshot' })
    } finally {
      setSnapshotting(false)
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-950 flex items-center justify-center text-slate-500">
        <Loader2 className="w-8 h-8 animate-spin text-indigo-500" />
      </div>
    )
  }

  if (!event || !telemetry) {
    return (
      <div className="min-h-screen bg-slate-950 flex flex-col items-center justify-center text-slate-400 gap-4">
        <p>No telemetry data available for this event yet.</p>
        <Link
          href={`/org/events/${id}`}
          className="px-4 py-2 bg-slate-800 text-slate-200 rounded-xl text-sm hover:bg-slate-700"
        >
          Return to Command Center
        </Link>
      </div>
    )
  }

  // Chart data formatting
  const chartData = telemetry.leniency.map((item) => {
    const isExcluded = excludedJudgeIds.includes(item.judge.id)
    return {
      name: item.judge.name.split(' ')[0] + ' ' + (item.judge.name.split(' ')[1] || ''),
      fullName: item.judge.name,
      zScore: item.zScore,
      meanTotal: item.meanTotal,
      flagged: item.flagged,
      isExcluded,
    }
  })

  const winnerChanged = Boolean(simulation?.winnerChanged)

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col">
      {/* Top Header */}
      <header className="border-b border-slate-800 bg-slate-900/60 backdrop-blur-md px-6 py-4 flex items-center justify-between sticky top-0 z-20">
        <div className="flex items-center gap-3">
          <Link
            href={`/org/events/${id}`}
            className="p-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-slate-100 transition-colors"
          >
            <ArrowLeft className="w-4 h-4" />
          </Link>
          <div>
            <div className="flex items-center gap-2">
              <span className="text-xs font-semibold text-indigo-400 uppercase tracking-wider">
                {event.name}
              </span>
              <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-indigo-950/60 text-indigo-400 border border-indigo-800/40">
                Fairness Telemetry
              </span>
            </div>
            <h1 className="text-lg font-bold text-slate-100">
              Statistical Anomaly & Sensitivity Engine
            </h1>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={loadData}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-medium transition-colors"
          >
            <RefreshCw className="w-3.5 h-3.5" />
            <span>Refresh</span>
          </button>
          <button
            onClick={saveSnapshot}
            disabled={snapshotting}
            className="flex items-center gap-1.5 px-4 py-1.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-semibold shadow-lg shadow-indigo-600/20 disabled:opacity-50 transition-colors"
          >
            {snapshotting ? (
              <Loader2 className="w-3.5 h-3.5 animate-spin" />
            ) : (
              <Camera className="w-3.5 h-3.5" />
            )}
            <span>Save Audit Snapshot</span>
          </button>
        </div>
      </header>

      {/* Main Body */}
      <main className="flex-1 max-w-7xl w-full mx-auto p-6 space-y-6">
        {/* Notification Toast */}
        {notification && (
          <div
            className={`p-4 rounded-xl border flex items-center justify-between text-xs ${
              notification.type === 'success'
                ? 'bg-emerald-950/40 border-emerald-800 text-emerald-300'
                : 'bg-rose-950/40 border-rose-800 text-rose-300'
            }`}
          >
            <div className="flex items-center gap-2">
              {notification.type === 'success' ? (
                <CheckCircle className="w-4 h-4 text-emerald-400" />
              ) : (
                <AlertTriangle className="w-4 h-4 text-rose-400" />
              )}
              <span>{notification.text}</span>
            </div>
            <button
              onClick={() => setNotification(null)}
              className="text-slate-400 hover:text-white"
            >
              &times;
            </button>
          </div>
        )}

        {/* 1. Executive Auditable Fairness Banner */}
        <div className="rounded-2xl border border-amber-800/40 bg-gradient-to-r from-amber-950/30 via-indigo-950/20 to-slate-900/60 p-5 shadow-xl">
          <div className="flex items-start gap-4">
            <div className="rounded-xl bg-amber-500/10 p-2.5 text-amber-400 border border-amber-500/30 shrink-0">
              <Scale className="h-6 w-6" />
            </div>
            <div className="flex-1">
              <div className="flex items-center gap-2 mb-1">
                <span className="text-[11px] font-bold uppercase tracking-wider text-amber-400">
                  Auditable Executive Fairness Statement
                </span>
                <span className="rounded-full bg-amber-500/20 px-2 py-0.5 text-[10px] font-semibold text-amber-300 border border-amber-500/30">
                  Live Peer Calibration
                </span>
              </div>
              <p className="text-base font-semibold text-slate-100 leading-snug">
                {telemetry.summarySentence}
              </p>
            </div>
          </div>
        </div>

        {/* 2. Critical Winner Flip Alert Banner */}
        {winnerChanged && simulation && simulation.newWinner && (
          <div className="rounded-2xl border-2 border-rose-500 bg-rose-950/30 p-5 text-rose-100 shadow-xl shadow-rose-950/20 animate-in zoom-in-95 duration-200">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-xl bg-rose-500/20 text-rose-400 border border-rose-500/30 shrink-0">
                <Trophy className="h-6 w-6" />
              </div>
              <div>
                <p className="text-xs font-bold tracking-wider text-rose-300 uppercase">
                  Counterfactual Winner-Flip Detected
                </p>
                <p className="text-sm font-medium mt-0.5 text-slate-200">
                  Excluding the selected judge(s) elevates{' '}
                  <strong className="text-white underline font-bold">
                    {simulation.newWinner.team.name}
                  </strong>{' '}
                  ({simulation.newWinner.totalScore.toFixed(2)} pts) into 1st place over{' '}
                  <span className="line-through text-rose-400">
                    {simulation.originalWinner?.team.name}
                  </span>{' '}
                  ({simulation.originalWinner?.totalScore.toFixed(2)} pts).
                </p>
              </div>
            </div>
          </div>
        )}

        {/* 3. Key Telemetry Metrics Grid */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
          <div className="p-4 rounded-2xl bg-slate-900/80 border border-slate-800 shadow-lg">
            <span className="text-[11px] font-semibold text-slate-400 block uppercase">
              Panel Grand Mean
            </span>
            <div className="flex items-baseline gap-2 mt-1">
              <span className="text-2xl font-bold font-mono text-indigo-400">
                {telemetry.grandMean}
              </span>
              <span className="text-xs text-slate-500">/ 100</span>
            </div>
            <span className="text-[10px] text-slate-500 mt-1 block">
              &plusmn;{telemetry.panelStdDev} panel std dev
            </span>
          </div>

          <div className="p-4 rounded-2xl bg-slate-900/80 border border-slate-800 shadow-lg">
            <span className="text-[11px] font-semibold text-slate-400 block uppercase">
              Judges Flagged
            </span>
            <div className="flex items-baseline gap-2 mt-1">
              <span
                className={`text-2xl font-bold font-mono ${
                  telemetry.flaggedJudgeCount > 0 ? 'text-amber-400' : 'text-emerald-400'
                }`}
              >
                {telemetry.flaggedJudgeCount}
              </span>
              <span className="text-xs text-slate-500">/ {telemetry.leniency.length}</span>
            </div>
            <span className="text-[10px] text-slate-500 mt-1 block">
              |z| &gt; 1.0 or r &lt; -0.50
            </span>
          </div>

          <div className="p-4 rounded-2xl bg-slate-900/80 border border-slate-800 shadow-lg">
            <span className="text-[11px] font-semibold text-slate-400 block uppercase">
              High Disagreement Teams
            </span>
            <div className="flex items-baseline gap-2 mt-1">
              <span
                className={`text-2xl font-bold font-mono ${
                  telemetry.highDisagreementCount > 0
                    ? 'text-rose-400'
                    : 'text-emerald-400'
                }`}
              >
                {telemetry.highDisagreementCount}
              </span>
              <span className="text-xs text-slate-500">teams</span>
            </div>
            <span className="text-[10px] text-slate-500 mt-1 block">
              &sigma; &ge; 12.0 pts inter-judge
            </span>
          </div>

          <div className="p-4 rounded-2xl bg-slate-900/80 border border-slate-800 shadow-lg">
            <span className="text-[11px] font-semibold text-slate-400 block uppercase">
              Winner Stability
            </span>
            <div className="flex items-baseline gap-2 mt-1">
              <span
                className={`text-base font-bold uppercase tracking-wider ${
                  winnerChanged ? 'text-rose-400' : 'text-emerald-400'
                }`}
              >
                {winnerChanged ? 'Sensitive' : 'Resilient'}
              </span>
            </div>
            <span className="text-[10px] text-slate-500 mt-1 block">
              {winnerChanged
                ? 'Outlier changes outcome'
                : '1st place robust to outliers'}
            </span>
          </div>
        </div>

        {/* 4. Charts Section: Leniency & Fatigue Drift */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Leniency Z-Score Chart */}
          <div className="bg-slate-900/80 border border-slate-800 rounded-2xl p-6 shadow-xl flex flex-col justify-between">
            <div>
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-2">
                  <div className="p-1.5 rounded-lg bg-indigo-500/10 text-indigo-400 border border-indigo-500/20">
                    <Scale className="w-4 h-4" />
                  </div>
                  <h3 className="text-sm font-bold text-slate-100">
                    Judge Leniency Distribution (Z-Scores)
                  </h3>
                </div>
                <span className="text-[11px] text-slate-400 font-mono">
                  Bounds: &plusmn;1.0&sigma;
                </span>
              </div>
              <p className="text-xs text-slate-400 mb-6">
                Standard deviations above/below panel grand mean. Values beyond &plusmn;1.0 are flagged for review.
              </p>

              <div className="h-64 w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart
                    data={chartData}
                    margin={{ top: 20, right: 10, left: -20, bottom: 20 }}
                  >
                    <CartesianGrid strokeDasharray="3 3" stroke="#334155" opacity={0.5} />
                    <XAxis
                      dataKey="name"
                      stroke="#94a3b8"
                      fontSize={11}
                      tickLine={false}
                    />
                    <YAxis stroke="#94a3b8" fontSize={11} domain={[-2.5, 2.5]} />
                    <Tooltip
                      content={({ active, payload }) => {
                        if (active && payload && payload.length) {
                          const data = payload[0].payload
                          return (
                            <div className="bg-slate-900 border border-slate-700 p-3 rounded-xl shadow-2xl text-xs space-y-1">
                              <p className="font-bold text-slate-100">{data.fullName}</p>
                              <p className="text-indigo-400 font-mono">
                                Z-Score: {data.zScore}
                              </p>
                              <p className="text-slate-400">
                                Mean Total: {data.meanTotal} / 100
                              </p>
                              <p
                                className={
                                  data.flagged ? 'text-amber-400 font-semibold' : 'text-emerald-400'
                                }
                              >
                                {data.flagged ? 'Flagged for Review' : 'Within Normal Bounds'}
                              </p>
                            </div>
                          )
                        }
                        return null
                      }}
                    />
                    <ReferenceLine y={1.0} stroke="#f59e0b" strokeDasharray="3 3" />
                    <ReferenceLine y={-1.0} stroke="#f59e0b" strokeDasharray="3 3" />
                    <ReferenceLine y={0} stroke="#64748b" />
                    <Bar dataKey="zScore" radius={[4, 4, 0, 0]}>
                      {chartData.map((entry, index) => (
                        <Cell
                          key={`cell-${index}`}
                          fill={
                            entry.isExcluded
                              ? '#475569'
                              : entry.flagged
                              ? '#f43f5e'
                              : '#6366f1'
                          }
                        />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>

            <div className="flex items-center justify-between text-[11px] text-slate-400 border-t border-slate-800/80 pt-3 mt-2">
              <span className="flex items-center gap-1.5">
                <span className="w-2.5 h-2.5 rounded-sm bg-indigo-500 inline-block" />
                Normal (|z| &le; 1)
              </span>
              <span className="flex items-center gap-1.5">
                <span className="w-2.5 h-2.5 rounded-sm bg-rose-500 inline-block" />
                Flagged (|z| &gt; 1)
              </span>
              <span className="flex items-center gap-1.5">
                <span className="w-2.5 h-2.5 rounded-sm bg-slate-600 inline-block" />
                Excluded in Simulation
              </span>
            </div>
          </div>

          {/* Fatigue Drift Correlation Panel */}
          <div className="bg-slate-900/80 border border-slate-800 rounded-2xl p-6 shadow-xl flex flex-col justify-between">
            <div>
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-2">
                  <div className="p-1.5 rounded-lg bg-amber-500/10 text-amber-400 border border-amber-500/20">
                    <TrendingDown className="w-4 h-4" />
                  </div>
                  <h3 className="text-sm font-bold text-slate-100">
                    Cognitive Fatigue & Sequence Drift
                  </h3>
                </div>
                <span className="text-[11px] text-slate-400 font-mono">
                  Pearson r &lt; -0.50
                </span>
              </div>
              <p className="text-xs text-slate-400 mb-4">
                Measures whether judges score teams progressively harsher over time as evaluation fatigue sets in.
              </p>

              <div className="space-y-3 overflow-y-auto max-h-64 pr-1">
                {telemetry.drift.map((d) => (
                  <div
                    key={d.judge.id}
                    className={`p-3 rounded-xl border flex items-center justify-between transition-colors ${
                      d.flagged
                        ? 'bg-rose-950/20 border-rose-800/60 text-rose-200'
                        : 'bg-slate-950 border-slate-800 text-slate-300'
                    }`}
                  >
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-semibold text-slate-100">
                          {d.judge.name}
                        </span>
                        {d.flagged && (
                          <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-rose-500/20 text-rose-400 border border-rose-500/30">
                            Fatigue Drift
                          </span>
                        )}
                      </div>
                      <span className="text-[11px] text-slate-500 block mt-0.5">
                        {d.evalCount} teams evaluated in sequence
                      </span>
                    </div>

                    <div className="text-right">
                      <span
                        className={`text-sm font-bold font-mono ${
                          d.correlation < -0.5
                            ? 'text-rose-400'
                            : d.correlation < 0
                            ? 'text-amber-400'
                            : 'text-emerald-400'
                        }`}
                      >
                        r = {d.correlation > 0 ? `+${d.correlation}` : d.correlation}
                      </span>
                      <span className="text-[10px] text-slate-500 block">
                        {d.correlation < -0.5
                          ? 'Steep downward trend'
                          : d.correlation < -0.2
                          ? 'Mild downward trend'
                          : 'Stable trend'}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div className="text-[11px] text-slate-500 border-t border-slate-800/80 pt-3 mt-4">
              Tip: FairPitch's randomized evaluation matrix ensures judges evaluate teams in varied sequences to disperse fatigue effects.
            </div>
          </div>
        </div>

        {/* 5. Inter-Judge Agreement Matrix */}
        <div className="bg-slate-900/80 border border-slate-800 rounded-2xl p-6 shadow-xl">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h3 className="text-sm font-bold text-slate-100">
                Inter-Judge Panel Agreement by Team
              </h3>
              <p className="text-xs text-slate-400">
                Teams ranked by standard deviation (&sigma;) across judge scores. High disagreement points to divergent evaluation standards.
              </p>
            </div>
            <span className="px-2.5 py-1 rounded-full text-[11px] font-bold bg-slate-800 text-slate-300 border border-slate-700">
              {telemetry.agreement.length} Teams Assessed
            </span>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="border-b border-slate-800 text-[11px] font-bold uppercase tracking-wider text-slate-400 bg-slate-950/40">
                <tr>
                  <th className="py-2.5 px-3">Team</th>
                  <th className="py-2.5 px-3 text-right">Mean (/100)</th>
                  <th className="py-2.5 px-3 text-right">Std Dev (&sigma;)</th>
                  <th className="py-2.5 px-3 text-center">Consensus Level</th>
                  <th className="py-2.5 px-3">Judge Score Spread</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/60">
                {telemetry.agreement
                  .slice()
                  .sort((a, b) => b.standardDeviation - a.standardDeviation)
                  .map((agr) => (
                    <tr key={agr.team.id} className="hover:bg-slate-800/30">
                      <td className="py-3 px-3">
                        <span className="font-semibold text-slate-200">
                          {agr.team.name}
                        </span>
                        {agr.team.tagline && (
                          <span className="text-[11px] text-slate-500 block truncate max-w-xs">
                            {agr.team.tagline}
                          </span>
                        )}
                      </td>
                      <td className="py-3 px-3 text-right font-mono font-bold text-slate-200">
                        {agr.meanTotal.toFixed(2)}
                      </td>
                      <td className="py-3 px-3 text-right font-mono font-semibold">
                        <span
                          className={
                            agr.disagreementLevel === 'High'
                              ? 'text-rose-400 font-bold'
                              : agr.disagreementLevel === 'Medium'
                              ? 'text-amber-400'
                              : 'text-emerald-400'
                          }
                        >
                          &plusmn;{agr.standardDeviation}
                        </span>
                      </td>
                      <td className="py-3 px-3 text-center">
                        <span
                          className={`px-2 py-0.5 rounded-full text-[10px] font-bold border ${
                            agr.disagreementLevel === 'High'
                              ? 'bg-rose-950/40 text-rose-400 border-rose-800/60'
                              : agr.disagreementLevel === 'Medium'
                              ? 'bg-amber-950/40 text-amber-400 border-amber-800/60'
                              : 'bg-emerald-950/40 text-emerald-400 border-emerald-800/60'
                          }`}
                        >
                          {agr.disagreementLevel} Disagreement
                        </span>
                      </td>
                      <td className="py-3 px-3">
                        <div className="flex flex-wrap gap-1.5 items-center">
                          {Object.entries(agr.judgeTotals).map(([jId, tot]) => {
                            const judge = telemetry.leniency.find((l) => l.judge.id === jId)
                            return (
                              <span
                                key={jId}
                                className="px-2 py-0.5 rounded-md bg-slate-950 border border-slate-800 text-[10px] text-slate-400 font-mono"
                                title={judge?.judge.name || 'Judge'}
                              >
                                {judge?.judge.name.split(' ')[0]}:{' '}
                                <strong className="text-slate-200">{tot}</strong>
                              </span>
                            )
                          })}
                        </div>
                      </td>
                    </tr>
                  ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* 6. Interactive Counterfactual Sensitivity Sandbox */}
        <div className="bg-slate-900/80 border border-slate-800 rounded-2xl p-6 shadow-xl space-y-6">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-800 pb-4">
            <div>
              <div className="flex items-center gap-2">
                <div className="p-1.5 rounded-lg bg-violet-500/10 text-violet-400 border border-violet-500/20">
                  <Sparkles className="w-4 h-4" />
                </div>
                <h3 className="text-sm font-bold text-slate-100">
                  Interactive Sensitivity Sandbox (What-If Reranking)
                </h3>
              </div>
              <p className="text-xs text-slate-400 mt-1">
                Toggle judges to simulate how the official leaderboard shifts if outlier or conflicted evaluations are excluded.
              </p>
            </div>

            <div className="flex items-center gap-2">
              <button
                onClick={excludeAllFlagged}
                className="px-3 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-amber-400 text-xs font-semibold border border-amber-900/40 transition-colors"
              >
                Exclude Flagged ({telemetry.flaggedJudgeCount})
              </button>
              <button
                onClick={resetAllExclusions}
                className="px-3 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-semibold transition-colors"
              >
                Reset All (0 Excluded)
              </button>
            </div>
          </div>

          {/* Judge Toggle Chips */}
          <div>
            <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400 block mb-2">
              Jury Panel Inclusion Controls:
            </span>
            <div className="flex flex-wrap gap-2">
              {telemetry.leniency.map((l) => {
                const isExcluded = excludedJudgeIds.includes(l.judge.id)
                return (
                  <button
                    key={l.judge.id}
                    onClick={() => toggleJudgeExclusion(l.judge.id)}
                    className={`flex items-center gap-2 px-3 py-1.5 rounded-xl text-xs font-semibold border transition-all ${
                      isExcluded
                        ? 'bg-rose-950/40 border-rose-800 text-rose-300 line-through opacity-75'
                        : l.flagged
                        ? 'bg-amber-950/30 border-amber-700 text-amber-300'
                        : 'bg-slate-950 border-slate-700 text-slate-200 hover:border-slate-600'
                    }`}
                  >
                    <span>{l.judge.name}</span>
                    <span className="text-[10px] font-mono opacity-75">
                      z={l.zScore}
                    </span>
                    {isExcluded ? (
                      <span className="text-[10px] uppercase font-bold text-rose-400">
                        Excluded
                      </span>
                    ) : (
                      <span className="text-[10px] uppercase font-bold text-emerald-400">
                        Active
                      </span>
                    )}
                  </button>
                )
              })}
            </div>
          </div>

          {/* Side-by-Side Comparison */}
          {simulation && (
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 pt-2">
              {/* Baseline Official Leaderboard */}
              <div className="bg-slate-950 rounded-2xl border border-slate-800 p-4">
                <div className="flex items-center justify-between mb-3 border-b border-slate-800 pb-2">
                  <span className="text-xs font-bold uppercase tracking-wider text-slate-300">
                    Baseline Official Leaderboard
                  </span>
                  <span className="text-[10px] text-slate-500 font-mono">
                    All {telemetry.leniency.length} Judges Included
                  </span>
                </div>

                <div className="space-y-2">
                  {simulation.baselineLeaderboard.map((row) => (
                    <div
                      key={row.team.id}
                      className={`p-2.5 rounded-xl border flex items-center justify-between text-xs ${
                        row.rank === 1
                          ? 'bg-indigo-950/30 border-indigo-500/60 font-semibold'
                          : 'bg-slate-900/60 border-slate-800/80'
                      }`}
                    >
                      <div className="flex items-center gap-2.5">
                        <span
                          className={`w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-bold ${
                            row.rank === 1
                              ? 'bg-amber-500 text-slate-950'
                              : 'bg-slate-800 text-slate-400'
                          }`}
                        >
                          #{row.rank}
                        </span>
                        <span className="text-slate-200">{row.team.name}</span>
                      </div>
                      <span className="font-mono font-bold text-indigo-400">
                        {row.totalScore.toFixed(2)} pts
                      </span>
                    </div>
                  ))}
                </div>
              </div>

              {/* Counterfactual Simulated Leaderboard */}
              <div className="bg-slate-950 rounded-2xl border border-indigo-900/40 p-4">
                <div className="flex items-center justify-between mb-3 border-b border-indigo-900/40 pb-2">
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-bold uppercase tracking-wider text-indigo-300">
                      Counterfactual Audited Leaderboard
                    </span>
                    {simulating && <Loader2 className="w-3 h-3 animate-spin text-indigo-400" />}
                  </div>
                  <span className="text-[10px] text-amber-400 font-mono">
                    {excludedJudgeIds.length} Judges Excluded
                  </span>
                </div>

                <div className="space-y-2">
                  {simulation.simulatedLeaderboard.map((row) => {
                    const delta = simulation.teamDeltas[row.team.id]
                    const rankDelta = delta?.rankDelta ?? 0
                    const scoreDelta = delta?.scoreDelta ?? 0

                    return (
                      <div
                        key={row.team.id}
                        className={`p-2.5 rounded-xl border flex items-center justify-between text-xs ${
                          row.rank === 1 && winnerChanged
                            ? 'bg-rose-950/30 border-rose-500 font-bold'
                            : row.rank === 1
                            ? 'bg-indigo-950/30 border-indigo-500/60 font-semibold'
                            : 'bg-slate-900/60 border-slate-800/80'
                        }`}
                      >
                        <div className="flex items-center gap-2.5">
                          <span
                            className={`w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-bold ${
                              row.rank === 1 && winnerChanged
                                ? 'bg-rose-500 text-white shadow-md shadow-rose-500/30'
                                : row.rank === 1
                                ? 'bg-amber-500 text-slate-950'
                                : 'bg-slate-800 text-slate-400'
                            }`}
                          >
                            #{row.rank}
                          </span>
                          <span className="text-slate-200">{row.team.name}</span>
                        </div>

                        <div className="flex items-center gap-3">
                          {rankDelta !== 0 && (
                            <span
                              className={`flex items-center gap-0.5 text-[11px] font-bold ${
                                rankDelta > 0 ? 'text-emerald-400' : 'text-rose-400'
                              }`}
                            >
                              {rankDelta > 0 ? (
                                <ArrowUpRight className="w-3.5 h-3.5" />
                              ) : (
                                <ArrowDownRight className="w-3.5 h-3.5" />
                              )}
                              {Math.abs(rankDelta)}
                            </span>
                          )}

                          <span className="font-mono font-bold text-slate-100">
                            {row.totalScore.toFixed(2)} pts
                          </span>

                          {scoreDelta !== 0 && (
                            <span
                              className={`text-[10px] font-mono ${
                                scoreDelta > 0 ? 'text-emerald-400' : 'text-rose-400'
                              }`}
                            >
                              ({scoreDelta > 0 ? `+${scoreDelta}` : scoreDelta})
                            </span>
                          )}
                        </div>
                      </div>
                    )
                  })}
                </div>
              </div>
            </div>
          )}
        </div>

        {/* 7. Snapshot History Card */}
        {latestSnapshot && (
          <div className="p-4 rounded-2xl bg-slate-900/40 border border-slate-800/80 flex items-center justify-between text-xs text-slate-400">
            <div className="flex items-center gap-2">
              <Calendar className="w-4 h-4 text-indigo-400" />
              <span>
                Latest Archived Snapshot: <strong>{new Date(latestSnapshot.snapshot_at).toLocaleString()}</strong>
              </span>
            </div>
            <span className="font-mono text-[10px] text-slate-500">
              Snapshot ID: {latestSnapshot.id}
            </span>
          </div>
        )}
      </main>
    </div>
  )
}
