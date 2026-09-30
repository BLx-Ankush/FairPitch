'use client';

import React, { useState, useEffect } from 'react';
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
import { criterionGap, leaderboard } from '@/lib/scoring';
import {
  FileText,
  Sparkles,
  Trophy,
  TrendingDown,
  ArrowRight,
  BrainCircuit,
  Loader2,
  CheckCircle2,
  AlertCircle,
  HelpCircle,
  RefreshCw,
} from 'lucide-react';
import { MarkdownView } from './MarkdownView';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from 'recharts';

interface TeamReportPageProps {
  scores: ScoreRecord[];
  teams?: Team[];
  judges?: Judge[];
  criteria?: Criterion[];
  mode?: AppMode;
}

export function TeamReportPage({
  scores,
  teams = SEED_TEAMS,
  judges = SEED_JUDGES,
  criteria = RUBRIC_CRITERIA,
  mode = 'demo',
}: TeamReportPageProps) {
  const lb = leaderboard([], scores, teams, judges, criteria);
  const currentWinner = lb[0];

  // Default to 2nd place team or first available team
  const defaultTeam =
    lb.find((e) => e.team.id !== currentWinner?.team.id)?.team.id ||
    teams[0]?.id ||
    'team-1';

  const [selectedTeamId, setSelectedTeamId] = useState<string>(defaultTeam);
  const [autopsyText, setAutopsyText] = useState<string | null>(null);
  const [autopsySource, setAutopsySource] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Sync selected team when teams list changes
  useEffect(() => {
    if (teams.length > 0 && !teams.some((t) => t.id === selectedTeamId)) {
      const nextTeam =
        lb.find((e) => e.team.id !== currentWinner?.team.id)?.team.id ||
        teams[0]?.id ||
        '';
      setSelectedTeamId(nextTeam);
      setAutopsyText(null);
      setAutopsySource(null);
      setErrorMessage(null);
    }
  }, [teams, selectedTeamId, lb, currentWinner]);

  if (teams.length === 0) {
    return (
      <div className="rounded-xl border border-slate-200 bg-white p-8 text-center max-w-lg mx-auto my-12 shadow-xs">
        <HelpCircle className="h-8 w-8 text-slate-400 mx-auto mb-2" />
        <h2 className="text-base font-bold text-slate-800">No Teams Found</h2>
        <p className="text-xs text-slate-500 mt-1">
          Register teams in the <strong>Event Setup</strong> tab to view performance diagnostics.
        </p>
      </div>
    );
  }

  const selectedEntry =
    lb.find((e) => e.team.id === selectedTeamId) ||
    lb[0] || {
      rank: 1,
      team: teams[0],
      totalScore: 0,
      judgeTotals: {},
      criterionAverages: {},
      weightedCriterionAverages: {},
    };

  const isSelectedWinner = selectedTeamId === currentWinner?.team.id;
  const comparisonTarget = isSelectedWinner
    ? lb[1] || currentWinner
    : currentWinner || selectedEntry;

  const gaps =
    comparisonTarget && selectedEntry
      ? criterionGap(
          selectedTeamId,
          comparisonTarget.team.id,
          scores,
          [],
          criteria,
          judges
        )
      : [];

  // Grouped bar chart data: Team vs Winner
  const chartData = criteria.map((criterion) => {
    const teamAvg = selectedEntry.criterionAverages[criterion.id] ?? 0;
    const winnerAvg = comparisonTarget?.criterionAverages[criterion.id] ?? 0;
    return {
      criterion: criterion.name.split(' ')[0], // short name
      fullName: criterion.name,
      teamScore: teamAvg,
      winnerScore: winnerAvg,
      weight: criterion.weight,
    };
  });

  const handleGenerateAutopsy = async (forceRefresh: boolean = false) => {
    if (!comparisonTarget) return;

    setIsLoading(true);
    setErrorMessage(null);

    try {
      // Collect judge comments for this team
      const teamComments = scores
        .filter((s) => s.team_id === selectedTeamId)
        .map((s) => {
          const j = judges.find((judge) => judge.id === s.judge_id);
          const c = criteria.find((crit) => crit.id === s.criterion_id);
          return {
            judgeName: j ? j.name : s.judge_id,
            criterionName: c ? c.name : s.criterion_id,
            score: s.score,
            comment: s.comment,
          };
        });

      // Collect judge comments for winner benchmark
      const winnerComments = scores
        .filter((s) => s.team_id === comparisonTarget.team.id)
        .map((s) => {
          const j = judges.find((judge) => judge.id === s.judge_id);
          const c = criteria.find((crit) => crit.id === s.criterion_id);
          return {
            judgeName: j ? j.name : s.judge_id,
            criterionName: c ? c.name : s.criterion_id,
            score: s.score,
            comment: s.comment,
          };
        });

      const payload = {
        teamId: selectedTeamId,
        teamName: selectedEntry.team.name,
        teamTagline: selectedEntry.team.tagline,
        teamTrack: selectedEntry.team.track,
        winnerName: comparisonTarget.team.name,
        winnerTagline: comparisonTarget.team.tagline,
        winnerTrack: comparisonTarget.team.track,
        teamCriterionAverages: selectedEntry.criterionAverages,
        winnerCriterionAverages: comparisonTarget.criterionAverages,
        weightedPointGaps: gaps,
        judgeComments: teamComments,
        winnerJudgeComments: winnerComments,
        forceRefresh,
      };

      const res = await fetch('/api/autopsy', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.error || 'Failed to generate loss autopsy');
      }

      setAutopsyText(data.text);
      setAutopsySource(data.source);
    } catch (err: any) {
      console.error(err);
      setErrorMessage(err.message || 'Error requesting autopsy');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="space-y-6 max-w-7xl mx-auto">
      {/* Top Header & Team Selector */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 rounded-xl border border-slate-200 bg-white p-5 shadow-xs">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900">
            Team Performance & Loss Autopsy
          </h1>
          <p className="text-xs text-slate-500 mt-1">
            Compare rubric metrics head-to-head against benchmark winner{' '}
            <strong className="text-slate-800 font-semibold">
              {currentWinner?.team.name || 'Benchmark Team'}
            </strong>{' '}
            ({currentWinner?.totalScore.toFixed(2) ?? '0.00'} pts).
          </p>
        </div>

        <div className="w-full sm:w-72">
          <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-500 mb-1">
            Select Team for Analysis
          </label>
          <select
            value={selectedTeamId}
            onChange={(e) => {
              setSelectedTeamId(e.target.value);
              setAutopsyText(null);
              setAutopsySource(null);
              setErrorMessage(null);
            }}
            className="w-full rounded-lg border border-slate-300 bg-white px-3.5 py-2 text-sm font-semibold text-slate-800 shadow-2xs focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/20"
          >
            {teams.map((t) => {
              const entry = lb.find((e) => e.team.id === t.id);
              return (
                <option key={t.id} value={t.id}>
                  #{entry?.rank ?? '—'} {t.name} ({entry?.totalScore.toFixed(1) ?? '0.0'} pts)
                </option>
              );
            })}
          </select>
        </div>
      </div>

      {isSelectedWinner && comparisonTarget && (
        <div className="rounded-lg bg-emerald-50 border border-emerald-200 p-3 text-xs text-emerald-800 flex items-center gap-2">
          <Trophy className="h-4 w-4 text-emerald-600 shrink-0" />
          <span>
            <strong>{selectedEntry.team.name}</strong> is currently ranked #1. Comparing performance against 2nd place (<strong>{comparisonTarget.team.name}</strong>).
          </span>
        </div>
      )}

      {/* Main Grid: Data on Left, Autopsy on Right */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left Column: Charts and Numbers (7 cols) */}
        <div className="lg:col-span-7 space-y-6">
          {/* Grouped Bar Chart */}
          <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-xs">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3 mb-4">
              <div>
                <h2 className="text-sm font-semibold text-slate-900">
                  Criterion Scores vs Benchmark
                </h2>
                <p className="text-xs text-slate-500">
                  Average score out of 10.0 per criterion
                </p>
              </div>
              <div className="flex items-center gap-3 text-xs">
                <span className="flex items-center gap-1.5 font-medium text-slate-700">
                  <span className="h-3 w-3 rounded-xs bg-indigo-600" />
                  {selectedEntry.team.name}
                </span>
                <span className="flex items-center gap-1.5 font-medium text-slate-700">
                  <span className="h-3 w-3 rounded-xs bg-emerald-500" />
                  {comparisonTarget?.team.name || 'Benchmark'} (Ref)
                </span>
              </div>
            </div>

            <div className="h-64 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart
                  data={chartData}
                  margin={{ top: 10, right: 10, left: -10, bottom: 20 }}
                >
                  <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" vertical={false} />
                  <XAxis
                    dataKey="criterion"
                    tick={{ fill: '#475569', fontSize: 11, fontWeight: 500 }}
                    axisLine={{ stroke: '#cbd5e1' }}
                  />
                  <YAxis
                    domain={[0, 10]}
                    ticks={[0, 2, 4, 6, 8, 10]}
                    tick={{ fill: '#64748b', fontSize: 11 }}
                    axisLine={{ stroke: '#cbd5e1' }}
                  />
                  <Tooltip
                    content={({ active, payload }) => {
                      if (active && payload && payload.length) {
                        const item = payload[0].payload;
                        return (
                          <div className="rounded-lg border border-slate-200 bg-white p-3 shadow-md text-xs space-y-1">
                            <p className="font-bold text-slate-900">{item.fullName}</p>
                            <p className="text-indigo-600 font-semibold">
                              {selectedEntry.team.name}: {item.teamScore.toFixed(1)} / 10
                            </p>
                            <p className="text-emerald-600 font-semibold">
                              {comparisonTarget?.team.name}: {item.winnerScore.toFixed(1)} / 10
                            </p>
                            <p className="text-slate-400 text-[10px]">
                              Rubric Weight: {item.weight}%
                            </p>
                          </div>
                        );
                      }
                      return null;
                    }}
                  />
                  <Bar dataKey="teamScore" name={selectedEntry.team.name} fill="#6366f1" radius={[4, 4, 0, 0]} />
                  <Bar dataKey="winnerScore" name={comparisonTarget?.team.name || 'Benchmark'} fill="#10b981" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* Table of Weighted Points Lost per Criterion, Sorted Largest First */}
          <div className="rounded-xl border border-slate-200 bg-white shadow-xs overflow-hidden">
            <div className="border-b border-slate-200 bg-slate-50/70 px-5 py-3 flex items-center justify-between">
              <div>
                <h3 className="text-sm font-semibold text-slate-900">
                  Weighted Points Lost vs Winner
                </h3>
                <p className="text-xs text-slate-500">
                  Sorted largest point gap first = exact cause of ranking gap
                </p>
              </div>
              <span className="rounded-md bg-slate-100 px-2 py-0.5 text-xs font-semibold text-slate-700">
                Sorted by Deficit
              </span>
            </div>

            <table className="w-full text-left text-sm text-slate-700">
              <thead className="border-b border-slate-200 bg-slate-50/40 text-[11px] font-bold uppercase text-slate-500">
                <tr>
                  <th className="px-4 py-2.5">Criterion</th>
                  <th className="px-3 py-2.5 text-center">Weight</th>
                  <th className="px-3 py-2.5 text-right">Team Avg</th>
                  <th className="px-3 py-2.5 text-right">Winner Avg</th>
                  <th className="px-4 py-2.5 text-right font-bold text-slate-900">
                    Weighted Loss
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {gaps.map((gap, idx) => {
                  const isLoss = gap.weightedGap > 0;
                  return (
                    <tr
                      key={gap.criterionId}
                      className={
                        idx === 0 && isLoss
                          ? 'bg-red-50/30 hover:bg-red-50/50'
                          : 'hover:bg-slate-50/50'
                      }
                    >
                      <td className="px-4 py-2.5 font-medium text-slate-900 text-xs">
                        {gap.criterionName}
                      </td>
                      <td className="px-3 py-2.5 text-center text-xs font-mono text-slate-500">
                        {gap.weight}%
                      </td>
                      <td className="px-3 py-2.5 text-right font-mono text-xs">
                        {gap.teamAverage.toFixed(1)}
                      </td>
                      <td className="px-3 py-2.5 text-right font-mono text-xs text-slate-500">
                        {gap.winnerAverage.toFixed(1)}
                      </td>
                      <td className="px-4 py-2.5 text-right font-mono text-xs font-bold">
                        {isLoss ? (
                          <span className="text-red-600">
                            -{gap.weightedGap.toFixed(2)} pts
                          </span>
                        ) : (
                          <span className="text-emerald-600">
                            +{Math.abs(gap.weightedGap).toFixed(2)} pts
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

        {/* Right Column: Loss Autopsy Panel (5 cols) */}
        <div className="lg:col-span-5 space-y-4">
          <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-xs min-h-[500px] flex flex-col justify-between">
            <div>
              <div className="flex items-center justify-between border-b border-slate-100 pb-3 mb-4">
                <div className="flex items-center gap-2">
                  <BrainCircuit className="h-5 w-5 text-indigo-600" />
                  <h3 className="text-sm font-semibold text-slate-900">
                    AI Loss Autopsy
                  </h3>
                </div>

                {autopsySource && (
                  <span
                    className={`rounded-full px-2 py-0.5 text-[10px] font-semibold ${
                      autopsySource === 'gemini'
                        ? 'bg-purple-100 text-purple-700'
                        : autopsySource === 'cache'
                        ? 'bg-blue-100 text-blue-700'
                        : 'bg-slate-100 text-slate-700'
                    }`}
                  >
                    {autopsySource === 'gemini'
                      ? 'Gemini 2.5 Flash'
                      : autopsySource === 'cache'
                      ? 'Cached'
                      : 'Rule-Based Fallback'}
                  </span>
                )}
              </div>

              {/* Action Buttons */}
              <div className="flex items-center gap-2">
                <button
                  onClick={() => handleGenerateAutopsy(false)}
                  disabled={isLoading || scores.length === 0}
                  className="flex-1 flex items-center justify-center gap-2 rounded-xl bg-indigo-600 px-4 py-3 text-sm font-semibold text-white shadow-xs hover:bg-indigo-700 active:scale-[0.99] transition-all disabled:opacity-50 cursor-pointer"
                >
                  {isLoading ? (
                    <>
                      <Loader2 className="h-4 w-4 animate-spin" />
                      <span>Diagnosing Rubric Deductions...</span>
                    </>
                  ) : (
                    <>
                      <Sparkles className="h-4 w-4" />
                      <span>{autopsyText ? 'Re-run Loss Autopsy' : 'Generate Detailed Loss Autopsy'}</span>
                    </>
                  )}
                </button>

                {autopsyText && (
                  <button
                    onClick={() => handleGenerateAutopsy(true)}
                    disabled={isLoading}
                    title="Force refresh analysis bypassing cache"
                    className="flex items-center justify-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3 py-3 text-xs font-medium text-slate-700 hover:bg-slate-50 transition-all cursor-pointer shadow-2xs"
                  >
                    <RefreshCw className={`h-4 w-4 text-slate-500 ${isLoading ? 'animate-spin' : ''}`} />
                    <span className="hidden sm:inline">Refresh</span>
                  </button>
                )}
              </div>

              {scores.length === 0 && (
                <p className="mt-2 text-center text-[11px] text-amber-700">
                  Scores need to be submitted in Judge Scoring before running autopsy.
                </p>
              )}

              {errorMessage && (
                <div className="mt-3 flex items-center gap-2 rounded-lg bg-red-50 p-2.5 text-xs text-red-700 border border-red-200">
                  <AlertCircle className="h-4 w-4 shrink-0 text-red-500" />
                  <span>{errorMessage}</span>
                </div>
              )}

              {/* Display Result Text */}
              {autopsyText ? (
                <div className="mt-4 rounded-xl border border-slate-200 bg-white p-5 text-xs text-slate-800 shadow-2xs leading-relaxed overflow-y-auto max-h-[540px]">
                  <MarkdownView content={autopsyText} />
                </div>
              ) : (
                <div className="mt-8 flex flex-col items-center justify-center text-center p-6 text-slate-400">
                  <FileText className="h-10 w-10 text-slate-300 stroke-[1.5] mb-2" />
                  <p className="text-xs font-medium text-slate-500">
                    No autopsy generated yet
                  </p>
                  <p className="text-[11px] text-slate-400 mt-1 max-w-xs">
                    Click "Generate Loss Autopsy" to trigger an automated gap diagnosis synthesized from criterion loss margins and qualitative judge notes.
                  </p>
                </div>
              )}
            </div>

            <p className="text-[10px] text-slate-400 pt-3 border-t border-slate-100 mt-4 text-center">
              Auditable explanation layer powered by Next.js & Google GenAI SDK
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
