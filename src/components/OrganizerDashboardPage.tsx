'use client';

import React, { useState } from 'react';
import {
  AppMode,
  Criterion,
  Judge,
  RUBRIC_CRITERIA,
  SEED_JUDGES,
  SEED_TEAMS,
  ScoreRecord,
  Team,
} from '@/lib/data';
import {
  fairnessSummary,
  judgeDrift,
  judgeLeniency,
  rerankWithout,
  teamAgreement,
} from '@/lib/fairness';
import { leaderboard } from '@/lib/scoring';
import {
  AlertTriangle,
  Scale,
  Sparkles,
  TrendingDown,
  Users,
  Trophy,
  CheckCircle,
  ToggleLeft,
  ToggleRight,
  ShieldAlert,
  Info,
} from 'lucide-react';
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
} from 'recharts';

interface OrganizerDashboardPageProps {
  scores: ScoreRecord[];
  judges?: Judge[];
  teams?: Team[];
  criteria?: Criterion[];
  mode?: AppMode;
}

export function OrganizerDashboardPage({
  scores,
  judges = SEED_JUDGES,
  teams = SEED_TEAMS,
  criteria = RUBRIC_CRITERIA,
  mode = 'demo',
}: OrganizerDashboardPageProps) {
  const [excludeFlagged, setExcludeFlagged] = useState<boolean>(false);

  // Computations with dynamic entities
  const summarySentence = fairnessSummary(scores, judges, teams, criteria);
  const leniencyData = judgeLeniency(scores, judges, teams, criteria);
  const driftData = judgeDrift(scores, judges);
  const agreementData = teamAgreement(scores, teams, judges, criteria);

  const flaggedJudgeIds = leniencyData
    .filter((l) => l.flagged)
    .map((l) => l.judge.id);

  const originalLeaderboard = leaderboard([], scores, teams, judges, criteria);
  const rerankResult = rerankWithout(flaggedJudgeIds, scores, teams, judges, criteria);
  const newLeaderboard = rerankResult.newLeaderboard;

  // Chart data formatting for leniency
  const chartData = leniencyData.map((item) => ({
    name: item.judge.name.split(' ')[0] + ' ' + (item.judge.name.split(' ')[1] || ''),
    fullName: item.judge.name,
    zScore: item.zScore,
    flagged: item.flagged,
    meanScore: item.meanScore,
    meanTotal: item.meanTotal,
    status: item.flagged ? 'flagged for review' : 'within normal range',
  }));

  const hasScores = scores.length > 0;

  return (
    <div className="space-y-8 max-w-7xl mx-auto">
      {/* (a) Highlighted Banner with fairnessSummary() */}
      <div className="rounded-xl border border-amber-200 bg-gradient-to-r from-amber-50 via-indigo-50/40 to-amber-50/80 p-5 shadow-xs">
        <div className="flex items-start gap-3.5">
          <div className="rounded-lg bg-amber-500/10 p-2 text-amber-700 border border-amber-300 shrink-0">
            <Scale className="h-5 w-5" />
          </div>
          <div className="flex-1">
            <div className="flex items-center gap-2">
              <span className="text-xs font-bold uppercase tracking-wider text-amber-800">
                Auditable Fairness Summary
              </span>
              <span className="rounded-full bg-amber-200/60 px-2 py-0.5 text-[10px] font-semibold text-amber-900">
                {mode === 'live' ? 'Live Telemetry' : 'Automated Panel Telemetry'}
              </span>
            </div>
            <p className="mt-1 text-base font-semibold text-slate-900 leading-snug">
              {summarySentence}
            </p>
          </div>
        </div>
      </div>

      {/* (e) Toggle Bar */}
      <div className="flex flex-wrap items-center justify-between gap-4 rounded-xl border border-slate-200 bg-white p-4 shadow-xs">
        <div className="flex items-center gap-3">
          <button
            onClick={() => setExcludeFlagged(!excludeFlagged)}
            className="flex items-center gap-2 text-sm font-semibold text-slate-800 hover:text-indigo-600 transition-colors cursor-pointer"
          >
            {excludeFlagged ? (
              <ToggleRight className="h-7 w-7 text-indigo-600" />
            ) : (
              <ToggleLeft className="h-7 w-7 text-slate-400" />
            )}
            <span>Exclude flagged judges</span>
          </button>
          <span className="text-xs text-slate-500">
            {flaggedJudgeIds.length > 0
              ? `(${flaggedJudgeIds.length} judge flagged for review)`
              : '(No judges currently flagged)'}
          </span>
        </div>

        {rerankResult.winnerChanged && excludeFlagged && (
          <span className="inline-flex items-center gap-1.5 rounded-full bg-red-100 px-3 py-1 text-xs font-bold text-red-700 border border-red-200 animate-pulse">
            <Trophy className="h-3.5 w-3.5 text-red-600" />
            Winner Flip Active!
          </span>
        )}
      </div>

      {/* Bold Banner when winner changes */}
      {excludeFlagged && rerankResult.winnerChanged && rerankResult.newWinner && (
        <div className="rounded-xl border-2 border-red-500 bg-red-50 p-4 text-red-900 shadow-sm animate-in zoom-in-95 duration-200">
          <div className="flex items-center gap-3">
            <Trophy className="h-6 w-6 text-red-600 shrink-0" />
            <div>
              <p className="text-sm font-bold tracking-tight text-red-950 uppercase">
                CRITICAL LEADERBOARD SHIFT: WINNER CHANGED
              </p>
              <p className="text-sm text-red-800 font-medium mt-0.5">
                Excluding flagged judge(s) elevates{' '}
                <strong className="font-bold underline">
                  {rerankResult.newWinner.team.name}
                </strong>{' '}
                ({rerankResult.newWinner.totalScore.toFixed(2)} pts) into 1st place over{' '}
                <span className="line-through text-red-700">
                  {rerankResult.originalWinner?.team.name}
                </span>{' '}
                ({rerankResult.originalWinner?.totalScore.toFixed(2)} pts).
              </p>
            </div>
          </div>
        </div>
      )}

      {/* (b) Leaderboard Table OR (e) Side-by-Side Comparison if Exclude Flagged is toggled */}
      {!excludeFlagged ? (
        <div className="rounded-xl border border-slate-200 bg-white shadow-xs overflow-hidden">
          <div className="border-b border-slate-200 bg-slate-50/70 px-6 py-4 flex items-center justify-between">
            <div>
              <h2 className="text-base font-semibold text-slate-900">
                Official Hackathon Leaderboard
              </h2>
              <p className="text-xs text-slate-500">
                Total score out of 100 with per-criterion averages across active panel judges
              </p>
            </div>
            <span className="rounded-md bg-indigo-50 px-2.5 py-1 text-xs font-semibold text-indigo-700 border border-indigo-200">
              Panel: {judges.length} Judges
            </span>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm text-slate-700">
              <thead className="border-b border-slate-200 bg-slate-50/50 text-[11px] font-bold uppercase tracking-wider text-slate-500">
                <tr>
                  <th className="px-4 py-3 text-center w-14">Rank</th>
                  <th className="px-4 py-3">Team</th>
                  <th className="px-4 py-3 text-right font-bold text-slate-900">
                    Total (/100)
                  </th>
                  {criteria.map((c) => (
                    <th key={c.id} className="px-3 py-3 text-right">
                      {c.name} ({c.weight}%)
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {originalLeaderboard.map((entry) => {
                  const isFirst = entry.rank === 1 && hasScores;
                  return (
                    <tr
                      key={entry.team.id}
                      className={
                        isFirst
                          ? 'bg-amber-50/40 font-medium hover:bg-amber-50/60'
                          : 'hover:bg-slate-50/80'
                      }
                    >
                      <td className="px-4 py-3 text-center">
                        {isFirst ? (
                          <span className="inline-flex h-6 w-6 items-center justify-center rounded-full bg-amber-400 font-bold text-white text-xs shadow-2xs">
                            1
                          </span>
                        ) : (
                          <span className="text-xs font-semibold text-slate-500">
                            #{entry.rank}
                          </span>
                        )}
                      </td>
                      <td className="px-4 py-3">
                        <div className="font-semibold text-slate-900">
                          {entry.team.name}
                        </div>
                        <div className="text-[11px] text-slate-500 truncate max-w-xs">
                          {entry.team.tagline}
                        </div>
                      </td>
                      <td className="px-4 py-3 text-right">
                        <span className="font-mono text-base font-bold text-indigo-600">
                          {entry.totalScore.toFixed(2)}
                        </span>
                      </td>
                      {criteria.map((c) => (
                        <td key={c.id} className="px-3 py-3 text-right font-mono text-xs">
                          {entry.criterionAverages[c.id]?.toFixed(1) ?? '0.0'}
                        </td>
                      ))}
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      ) : (
        /* Side by Side Comparison */
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Old Leaderboard */}
          <div className="rounded-xl border border-slate-200 bg-white shadow-xs overflow-hidden">
            <div className="border-b border-slate-200 bg-slate-100/60 px-5 py-3 flex items-center justify-between">
              <div>
                <h3 className="text-sm font-bold text-slate-800">
                  Original Leaderboard
                </h3>
                <span className="text-[11px] text-slate-500">
                  Includes all {judges.length} judges (unadjusted)
                </span>
              </div>
              <span className="rounded-md bg-slate-200 px-2 py-0.5 text-xs font-semibold text-slate-700">
                Baseline
              </span>
            </div>
            <table className="w-full text-left text-sm text-slate-700">
              <thead className="border-b border-slate-200 bg-slate-50/50 text-[11px] font-bold uppercase text-slate-500">
                <tr>
                  <th className="px-3 py-2 text-center w-12">Rank</th>
                  <th className="px-3 py-2">Team</th>
                  <th className="px-3 py-2 text-right">Score</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {originalLeaderboard.map((e) => (
                  <tr
                    key={e.team.id}
                    className={e.rank === 1 && hasScores ? 'bg-amber-50/50 font-semibold' : ''}
                  >
                    <td className="px-3 py-2.5 text-center text-xs">
                      #{e.rank}
                    </td>
                    <td className="px-3 py-2.5 font-medium text-slate-900">
                      {e.team.name}
                    </td>
                    <td className="px-3 py-2.5 text-right font-mono font-bold text-slate-700">
                      {e.totalScore.toFixed(2)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* New Leaderboard Without Flagged Judges */}
          <div className="rounded-xl border-2 border-indigo-500 bg-white shadow-sm overflow-hidden">
            <div className="border-b border-indigo-100 bg-indigo-50/70 px-5 py-3 flex items-center justify-between">
              <div>
                <h3 className="text-sm font-bold text-indigo-950">
                  Adjusted Leaderboard
                </h3>
                <span className="text-[11px] text-indigo-700">
                  Excluding {flaggedJudgeIds.length} flagged judge(s)
                </span>
              </div>
              <span className="rounded-md bg-indigo-600 px-2 py-0.5 text-xs font-semibold text-white">
                Audited
              </span>
            </div>
            <table className="w-full text-left text-sm text-slate-700">
              <thead className="border-b border-slate-200 bg-slate-50/50 text-[11px] font-bold uppercase text-slate-500">
                <tr>
                  <th className="px-3 py-2 text-center w-12">Rank</th>
                  <th className="px-3 py-2">Team</th>
                  <th className="px-3 py-2 text-right">Score</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {newLeaderboard.map((e) => {
                  const isNewWinner = e.rank === 1 && hasScores;
                  return (
                    <tr
                      key={e.team.id}
                      className={
                        isNewWinner ? 'bg-indigo-50/70 font-semibold' : ''
                      }
                    >
                      <td className="px-3 py-2.5 text-center text-xs">
                        {isNewWinner ? (
                          <span className="inline-flex h-5 w-5 items-center justify-center rounded-full bg-indigo-600 text-white font-bold text-[10px]">
                            1
                          </span>
                        ) : (
                          `#${e.rank}`
                        )}
                      </td>
                      <td className="px-3 py-2.5 font-medium text-slate-900">
                        {e.team.name}
                        {isNewWinner && (
                          <span className="ml-2 text-[10px] font-bold uppercase text-indigo-600">
                            ★ Winner
                          </span>
                        )}
                      </td>
                      <td className="px-3 py-2.5 text-right font-mono font-bold text-indigo-700">
                        {e.totalScore.toFixed(2)}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* (c) Bar Chart of each judge's leniency z-score */}
      <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-xs">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-100 pb-4 mb-4">
          <div>
            <h2 className="text-base font-semibold text-slate-900">
              Judge Leniency Index (z-score distribution)
            </h2>
            <p className="text-xs text-slate-500">
              Normalized deviation of each judge's mean total from panel average. Threshold: |z| &gt; 1.0.
            </p>
          </div>
          <div className="flex items-center gap-4 text-xs">
            <div className="flex items-center gap-1.5">
              <span className="h-3 w-3 rounded-xs bg-indigo-600" />
              <span className="text-slate-600 font-medium">Within Normal Range</span>
            </div>
            <div className="flex items-center gap-1.5">
              <span className="h-3 w-3 rounded-xs bg-red-500" />
              <span className="text-red-700 font-semibold">flagged for review</span>
            </div>
          </div>
        </div>

        {chartData.length > 0 ? (
          <div className="h-64 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart
                data={chartData}
                margin={{ top: 20, right: 30, left: 10, bottom: 20 }}
              >
                <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" vertical={false} />
                <XAxis
                  dataKey="name"
                  tick={{ fill: '#475569', fontSize: 12, fontWeight: 500 }}
                  axisLine={{ stroke: '#cbd5e1' }}
                />
                <YAxis
                  domain={[-2, 2]}
                  ticks={[-2, -1, 0, 1, 2]}
                  tick={{ fill: '#64748b', fontSize: 11 }}
                  axisLine={{ stroke: '#cbd5e1' }}
                  unit="z"
                />
                <Tooltip
                  content={({ active, payload }) => {
                    if (active && payload && payload.length) {
                      const data = payload[0].payload;
                      return (
                        <div className="rounded-lg border border-slate-200 bg-white p-3 shadow-md text-xs space-y-1">
                          <p className="font-bold text-slate-900">{data.fullName}</p>
                          <p className="text-slate-600">
                            Z-Score: <span className="font-mono font-bold">{data.zScore}</span>
                          </p>
                          <p className="text-slate-600">
                            Mean Total: <span className="font-mono">{data.meanTotal} pts</span>
                          </p>
                          <p className="text-slate-600">
                            Raw Score Mean: <span className="font-mono">{data.meanScore} / 10</span>
                          </p>
                          <p
                            className={`font-semibold capitalize ${
                              data.flagged ? 'text-red-600' : 'text-emerald-600'
                            }`}
                          >
                            Status: {data.status}
                          </p>
                        </div>
                      );
                    }
                    return null;
                  }}
                />
                <ReferenceLine y={1} stroke="#ef4444" strokeDasharray="3 3" label={{ value: '+1.0 threshold', fill: '#ef4444', fontSize: 10 }} />
                <ReferenceLine y={-1} stroke="#ef4444" strokeDasharray="3 3" label={{ value: '-1.0 threshold', fill: '#ef4444', fontSize: 10 }} />
                <ReferenceLine y={0} stroke="#94a3b8" />
                <Bar dataKey="zScore" radius={[4, 4, 0, 0]}>
                  {chartData.map((entry, index) => (
                    <Cell
                      key={`cell-${index}`}
                      fill={entry.flagged ? '#ef4444' : '#6366f1'}
                    />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        ) : (
          <p className="text-xs text-slate-400 italic py-8 text-center">
            No judges available for leniency analysis.
          </p>
        )}
      </div>

      {/* (d) Two Small Tables: Drift and Team Disagreement */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Table 1: Judge Drift */}
        <div className="rounded-xl border border-slate-200 bg-white shadow-xs overflow-hidden">
          <div className="border-b border-slate-200 bg-slate-50/70 px-5 py-3 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <TrendingDown className="h-4 w-4 text-slate-500" />
              <h3 className="text-sm font-semibold text-slate-900">
                Judge Fatigue & Drift Analysis
              </h3>
            </div>
            <span className="text-[11px] text-slate-500">
              Correlation with order_index (r &lt; -0.5)
            </span>
          </div>
          <table className="w-full text-left text-sm text-slate-700">
            <thead className="border-b border-slate-200 bg-slate-50/40 text-[11px] font-bold uppercase text-slate-500">
              <tr>
                <th className="px-4 py-2.5">Judge</th>
                <th className="px-3 py-2.5 text-center">Scores</th>
                <th className="px-3 py-2.5 text-right">Correlation (r)</th>
                <th className="px-4 py-2.5 text-right">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {driftData.map((d) => (
                <tr key={d.judge.id} className="hover:bg-slate-50/50">
                  <td className="px-4 py-2.5 font-medium text-slate-900 text-xs">
                    {d.judge.name}
                  </td>
                  <td className="px-3 py-2.5 text-center text-xs font-mono text-slate-500">
                    {d.scoreCount}
                  </td>
                  <td className="px-3 py-2.5 text-right font-mono text-xs font-semibold">
                    {d.correlation > 0 ? `+${d.correlation.toFixed(2)}` : d.correlation.toFixed(2)}
                  </td>
                  <td className="px-4 py-2.5 text-right">
                    {d.flagged ? (
                      <span className="inline-flex items-center gap-1 rounded-full bg-red-100 px-2 py-0.5 text-[10px] font-semibold text-red-700">
                        <AlertTriangle className="h-3 w-3" />
                        flagged for review
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1 rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-medium text-slate-600">
                        <CheckCircle className="h-3 w-3 text-emerald-600" />
                        Stable
                      </span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Table 2: Team Agreement */}
        <div className="rounded-xl border border-slate-200 bg-white shadow-xs overflow-hidden">
          <div className="border-b border-slate-200 bg-slate-50/70 px-5 py-3 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Users className="h-4 w-4 text-slate-500" />
              <h3 className="text-sm font-semibold text-slate-900">
                Team Judge Agreement Dispersion
              </h3>
            </div>
            <span className="text-[11px] text-slate-500">
              Std Dev across judge totals
            </span>
          </div>
          <table className="w-full text-left text-sm text-slate-700">
            <thead className="border-b border-slate-200 bg-slate-50/40 text-[11px] font-bold uppercase text-slate-500">
              <tr>
                <th className="px-4 py-2.5">Team</th>
                <th className="px-3 py-2.5 text-right">Judge Totals</th>
                <th className="px-3 py-2.5 text-right">Std Dev (σ)</th>
                <th className="px-4 py-2.5 text-right">Disagreement</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {agreementData.map((a) => {
                const isHigh = a.disagreementLevel === 'High';
                return (
                  <tr key={a.team.id} className={isHigh ? 'bg-amber-50/40' : 'hover:bg-slate-50/50'}>
                    <td className="px-4 py-2.5 font-medium text-slate-900 text-xs">
                      {a.team.name}
                    </td>
                    <td className="px-3 py-2.5 text-right font-mono text-[11px] text-slate-500">
                      {Object.values(a.judgeTotals).length > 0
                        ? Object.values(a.judgeTotals).map(v => v.toFixed(0)).join(', ')
                        : '—'}
                    </td>
                    <td className="px-3 py-2.5 text-right font-mono text-xs font-bold text-slate-800">
                      {a.standardDeviation.toFixed(2)}
                    </td>
                    <td className="px-4 py-2.5 text-right">
                      {a.disagreementLevel === 'High' ? (
                        <span className="rounded-full bg-red-100 px-2 py-0.5 text-[10px] font-bold text-red-700">
                          High Disagreement
                        </span>
                      ) : a.disagreementLevel === 'Medium' ? (
                        <span className="rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-medium text-amber-700">
                          Medium
                        </span>
                      ) : (
                        <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-[10px] font-medium text-emerald-700">
                          Low (Aligned)
                        </span>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
