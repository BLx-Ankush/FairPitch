'use client';

import React, { useState } from 'react';
import { Criterion, Judge, Team } from '@/lib/data';
import {
  Users,
  UserCheck,
  Scale,
  Plus,
  Trash2,
  CheckCircle2,
  AlertTriangle,
  RotateCcw,
  Sparkles,
  Layers,
  Award,
} from 'lucide-react';

interface EventSetupPageProps {
  teams: Team[];
  judges: Judge[];
  criteria: Criterion[];
  onAddTeam: (team: Omit<Team, 'id'>) => void;
  onDeleteTeam: (id: string) => void;
  onAddJudge: (judge: Omit<Judge, 'id'>) => void;
  onDeleteJudge: (id: string) => void;
  onUpdateCriteria: (criteria: Criterion[]) => void;
  onResetLiveEvent: () => void;
}

export function EventSetupPage({
  teams,
  judges,
  criteria,
  onAddTeam,
  onDeleteTeam,
  onAddJudge,
  onDeleteJudge,
  onUpdateCriteria,
  onResetLiveEvent,
}: EventSetupPageProps) {
  const [activeTab, setActiveTab] = useState<'teams' | 'judges' | 'criteria'>('teams');

  // Team Form State
  const [teamName, setTeamName] = useState('');
  const [teamTagline, setTeamTagline] = useState('');
  const [teamTrack, setTeamTrack] = useState('General');

  // Judge Form State
  const [judgeName, setJudgeName] = useState('');
  const [judgeTitle, setJudgeTitle] = useState('');

  // Criteria Form State (editable draft)
  const [editableCriteria, setEditableCriteria] = useState<Criterion[]>(criteria);
  const [criterionName, setCriterionName] = useState('');
  const [criterionWeight, setCriterionWeight] = useState<number>(20);
  const [criterionDesc, setCriterionDesc] = useState('');
  const [saveSuccessMessage, setSaveSuccessMessage] = useState<string | null>(null);

  const totalWeight = editableCriteria.reduce((sum, c) => sum + (Number(c.weight) || 0), 0);
  const isWeightValid = totalWeight === 100;

  const handleCreateTeam = (e: React.FormEvent) => {
    e.preventDefault();
    if (!teamName.trim()) return;
    onAddTeam({
      name: teamName.trim(),
      tagline: teamTagline.trim() || 'Custom Hackathon Project',
      track: teamTrack.trim() || 'General Track',
    });
    setTeamName('');
    setTeamTagline('');
    setTeamTrack('General');
  };

  const handleCreateJudge = (e: React.FormEvent) => {
    e.preventDefault();
    if (!judgeName.trim()) return;
    onAddJudge({
      name: judgeName.trim(),
      title: judgeTitle.trim() || 'Judging Panel Member',
      avatar: judgeName.split(' ').map((n) => n[0]).join('').substring(0, 2).toUpperCase() || 'JD',
    });
    setJudgeName('');
    setJudgeTitle('');
  };

  const handleAddCriterion = (e: React.FormEvent) => {
    e.preventDefault();
    if (!criterionName.trim()) return;
    const newCriterion: Criterion = {
      id: `crit-custom-${Date.now()}`,
      name: criterionName.trim(),
      weight: Number(criterionWeight) || 10,
      description: criterionDesc.trim() || 'Custom evaluation metric for this hackathon.',
    };
    const updated = [...editableCriteria, newCriterion];
    setEditableCriteria(updated);
    onUpdateCriteria(updated);
    setCriterionName('');
    setCriterionDesc('');
    setCriterionWeight(15);
    setSaveSuccessMessage('Criterion added and saved!');
    setTimeout(() => setSaveSuccessMessage(null), 3000);
  };

  const handleDeleteCriterion = (id: string) => {
    const updated = editableCriteria.filter((c) => c.id !== id);
    setEditableCriteria(updated);
    onUpdateCriteria(updated);
  };

  const handleWeightChange = (id: string, newWeight: number) => {
    const updated = editableCriteria.map((c) =>
      c.id === id ? { ...c, weight: Math.max(1, Math.min(100, newWeight)) } : c
    );
    setEditableCriteria(updated);
    onUpdateCriteria(updated);
  };

  const handleAutoNormalizeWeights = () => {
    if (editableCriteria.length === 0) return;
    const currentSum = editableCriteria.reduce((acc, c) => acc + c.weight, 0);
    if (currentSum === 0) return;

    let runningSum = 0;
    const normalized = editableCriteria.map((c, idx) => {
      if (idx === editableCriteria.length - 1) {
        return { ...c, weight: Math.max(1, 100 - runningSum) };
      }
      const proportional = Math.max(1, Math.round((c.weight / currentSum) * 100));
      runningSum += proportional;
      return { ...c, weight: proportional };
    });

    setEditableCriteria(normalized);
    onUpdateCriteria(normalized);
    setSaveSuccessMessage('Weights automatically normalized to exactly 100%!');
    setTimeout(() => setSaveSuccessMessage(null), 3000);
  };

  return (
    <div className="space-y-6 max-w-6xl mx-auto">
      {/* Top Banner */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 rounded-xl border border-emerald-200 bg-gradient-to-r from-emerald-50 via-teal-50 to-white p-5 shadow-xs">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-2xl font-bold tracking-tight text-slate-900">
              Live Event Configuration
            </h1>
            <span className="rounded-md bg-emerald-100 px-2.5 py-0.5 text-xs font-bold text-emerald-800 border border-emerald-200">
              ⚡ Live Mode
            </span>
          </div>
          <p className="text-xs text-slate-600 mt-1">
            Configure your actual hackathon details: register teams, invite judges, and customize rubric criteria and weights.
          </p>
        </div>

        <button
          onClick={onResetLiveEvent}
          className="flex items-center gap-1.5 rounded-lg border border-slate-300 bg-white px-3 py-2 text-xs font-semibold text-slate-700 shadow-2xs hover:bg-slate-50 transition-colors"
        >
          <RotateCcw className="h-3.5 w-3.5 text-slate-500" />
          <span>Reset Live Event to Defaults</span>
        </button>
      </div>

      {saveSuccessMessage && (
        <div className="flex items-center gap-2 rounded-lg bg-emerald-50 border border-emerald-200 p-3 text-xs font-semibold text-emerald-900 shadow-2xs animate-in fade-in duration-150">
          <CheckCircle2 className="h-4 w-4 text-emerald-600" />
          <span>{saveSuccessMessage}</span>
        </div>
      )}

      {/* Tabs */}
      <div className="flex items-center gap-2 border-b border-slate-200 pb-2">
        <button
          onClick={() => setActiveTab('teams')}
          className={`flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-bold transition-all ${
            activeTab === 'teams'
              ? 'bg-indigo-600 text-white shadow-xs'
              : 'text-slate-600 hover:bg-slate-100'
          }`}
        >
          <Users className="h-4 w-4" />
          <span>Teams ({teams.length})</span>
        </button>

        <button
          onClick={() => setActiveTab('judges')}
          className={`flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-bold transition-all ${
            activeTab === 'judges'
              ? 'bg-indigo-600 text-white shadow-xs'
              : 'text-slate-600 hover:bg-slate-100'
          }`}
        >
          <UserCheck className="h-4 w-4" />
          <span>Judges ({judges.length})</span>
        </button>

        <button
          onClick={() => setActiveTab('criteria')}
          className={`flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-bold transition-all ${
            activeTab === 'criteria'
              ? 'bg-indigo-600 text-white shadow-xs'
              : 'text-slate-600 hover:bg-slate-100'
          }`}
        >
          <Scale className="h-4 w-4" />
          <span>Rubric Criteria ({criteria.length})</span>
          {!isWeightValid && (
            <span className="rounded-full bg-red-100 px-1.5 py-0.2 text-[10px] text-red-700">
              {totalWeight}%
            </span>
          )}
        </button>
      </div>

      {/* TAB 1: TEAMS */}
      {activeTab === 'teams' && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          {/* Add Team Form */}
          <div className="lg:col-span-5 rounded-xl border border-slate-200 bg-white p-5 shadow-xs">
            <h2 className="text-sm font-semibold text-slate-900 mb-1 flex items-center gap-2">
              <Plus className="h-4 w-4 text-indigo-600" />
              Register New Team
            </h2>
            <p className="text-xs text-slate-500 mb-4">
              Add a student project or startup team participating in this event.
            </p>

            <form onSubmit={handleCreateTeam} className="space-y-3.5">
              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-slate-600 mb-1">
                  Team Name *
                </label>
                <input
                  type="text"
                  required
                  value={teamName}
                  onChange={(e) => setTeamName(e.target.value)}
                  placeholder="e.g., OmniVolt AI"
                  className="w-full rounded-lg border border-slate-300 p-2 text-xs text-slate-900 focus:border-indigo-500 focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-slate-600 mb-1">
                  Project Tagline / Pitch
                </label>
                <input
                  type="text"
                  value={teamTagline}
                  onChange={(e) => setTeamTagline(e.target.value)}
                  placeholder="e.g., Dynamic phase-balancing micro-grid controller"
                  className="w-full rounded-lg border border-slate-300 p-2 text-xs text-slate-900 focus:border-indigo-500 focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-slate-600 mb-1">
                  Track / Domain
                </label>
                <input
                  type="text"
                  value={teamTrack}
                  onChange={(e) => setTeamTrack(e.target.value)}
                  placeholder="e.g., CleanTech, Healthcare, Web3"
                  className="w-full rounded-lg border border-slate-300 p-2 text-xs text-slate-900 focus:border-indigo-500 focus:outline-none"
                />
              </div>

              <button
                type="submit"
                className="w-full mt-2 flex items-center justify-center gap-2 rounded-lg bg-indigo-600 py-2.5 text-xs font-bold text-white shadow-xs hover:bg-indigo-700 transition-all"
              >
                <Plus className="h-4 w-4" />
                <span>Add Team to Event</span>
              </button>
            </form>
          </div>

          {/* Teams List */}
          <div className="lg:col-span-7 rounded-xl border border-slate-200 bg-white p-5 shadow-xs">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3 mb-3">
              <h2 className="text-sm font-semibold text-slate-900">
                Registered Event Teams ({teams.length})
              </h2>
              <span className="text-xs text-slate-400">Available for live judging</span>
            </div>

            {teams.length === 0 ? (
              <p className="text-xs text-slate-400 italic py-6 text-center">
                No teams registered yet. Use the form on the left to add teams.
              </p>
            ) : (
              <div className="divide-y divide-slate-100">
                {teams.map((t, idx) => (
                  <div key={t.id} className="py-3 flex items-center justify-between gap-3">
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="font-mono text-xs text-slate-400 font-bold">
                          #{idx + 1}
                        </span>
                        <span className="font-semibold text-slate-900 text-xs">
                          {t.name}
                        </span>
                        <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-medium text-slate-600">
                          {t.track}
                        </span>
                      </div>
                      <p className="text-[11px] text-slate-500 truncate mt-0.5">
                        {t.tagline}
                      </p>
                    </div>

                    <button
                      onClick={() => onDeleteTeam(t.id)}
                      className="rounded-md p-1.5 text-slate-400 hover:bg-red-50 hover:text-red-600 transition-colors"
                      title="Delete team"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* TAB 2: JUDGES */}
      {activeTab === 'judges' && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          {/* Add Judge Form */}
          <div className="lg:col-span-5 rounded-xl border border-slate-200 bg-white p-5 shadow-xs">
            <h2 className="text-sm font-semibold text-slate-900 mb-1 flex items-center gap-2">
              <Plus className="h-4 w-4 text-indigo-600" />
              Add Panel Judge
            </h2>
            <p className="text-xs text-slate-500 mb-4">
              Add judges who will evaluate submissions in live mode.
            </p>

            <form onSubmit={handleCreateJudge} className="space-y-3.5">
              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-slate-600 mb-1">
                  Full Name *
                </label>
                <input
                  type="text"
                  required
                  value={judgeName}
                  onChange={(e) => setJudgeName(e.target.value)}
                  placeholder="e.g., Dr. Jane Doe"
                  className="w-full rounded-lg border border-slate-300 p-2 text-xs text-slate-900 focus:border-indigo-500 focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-slate-600 mb-1">
                  Title / Affiliation
                </label>
                <input
                  type="text"
                  value={judgeTitle}
                  onChange={(e) => setJudgeTitle(e.target.value)}
                  placeholder="e.g., Partner at Sequoia / Lead ML Architect"
                  className="w-full rounded-lg border border-slate-300 p-2 text-xs text-slate-900 focus:border-indigo-500 focus:outline-none"
                />
              </div>

              <button
                type="submit"
                className="w-full mt-2 flex items-center justify-center gap-2 rounded-lg bg-indigo-600 py-2.5 text-xs font-bold text-white shadow-xs hover:bg-indigo-700 transition-all"
              >
                <Plus className="h-4 w-4" />
                <span>Add Judge to Panel</span>
              </button>
            </form>
          </div>

          {/* Judges List */}
          <div className="lg:col-span-7 rounded-xl border border-slate-200 bg-white p-5 shadow-xs">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3 mb-3">
              <h2 className="text-sm font-semibold text-slate-900">
                Active Judging Panel ({judges.length})
              </h2>
              <span className="text-xs text-slate-400">Panel members</span>
            </div>

            {judges.length === 0 ? (
              <p className="text-xs text-slate-400 italic py-6 text-center">
                No judges added yet. Add at least 2 judges to enable fairness telemetry.
              </p>
            ) : (
              <div className="divide-y divide-slate-100">
                {judges.map((j) => (
                  <div key={j.id} className="py-3 flex items-center justify-between gap-3">
                    <div className="flex items-center gap-3 min-w-0">
                      <div className="flex h-8 w-8 items-center justify-center rounded-full bg-indigo-100 text-indigo-700 font-bold text-xs">
                        {j.avatar}
                      </div>
                      <div className="min-w-0">
                        <p className="font-semibold text-slate-900 text-xs truncate">
                          {j.name}
                        </p>
                        <p className="text-[11px] text-slate-500 truncate">
                          {j.title}
                        </p>
                      </div>
                    </div>

                    <button
                      onClick={() => onDeleteJudge(j.id)}
                      className="rounded-md p-1.5 text-slate-400 hover:bg-red-50 hover:text-red-600 transition-colors"
                      title="Remove judge"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* TAB 3: CRITERIA */}
      {activeTab === 'criteria' && (
        <div className="space-y-6">
          {/* Weight Indicator Banner */}
          <div
            className={`rounded-xl border p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3 ${
              isWeightValid
                ? 'bg-emerald-50 border-emerald-200 text-emerald-900'
                : 'bg-amber-50 border-amber-300 text-amber-900'
            }`}
          >
            <div className="flex items-center gap-2.5">
              {isWeightValid ? (
                <CheckCircle2 className="h-5 w-5 text-emerald-600 shrink-0" />
              ) : (
                <AlertTriangle className="h-5 w-5 text-amber-600 shrink-0" />
              )}
              <div>
                <p className="text-xs font-bold uppercase tracking-wider">
                  Total Rubric Weight: <span className="text-sm font-mono">{totalWeight}%</span>
                </p>
                <p className="text-xs mt-0.5">
                  {isWeightValid
                    ? 'Rubric weights correctly sum to exactly 100%.'
                    : `Weights sum to ${totalWeight}%. Rubric weights must total 100% for proper 100-point score normalization.`}
                </p>
              </div>
            </div>

            {!isWeightValid && (
              <button
                onClick={handleAutoNormalizeWeights}
                className="self-start sm:self-auto rounded-lg bg-indigo-600 px-3 py-1.5 text-xs font-bold text-white shadow-xs hover:bg-indigo-700 transition-colors shrink-0"
              >
                Auto-Normalize to 100%
              </button>
            )}
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
            {/* Add Criterion Form */}
            <div className="lg:col-span-5 rounded-xl border border-slate-200 bg-white p-5 shadow-xs">
              <h2 className="text-sm font-semibold text-slate-900 mb-1 flex items-center gap-2">
                <Plus className="h-4 w-4 text-indigo-600" />
                Add Rubric Criterion
              </h2>
              <p className="text-xs text-slate-500 mb-4">
                Define custom judging criteria tailored to your hackathon focus.
              </p>

              <form onSubmit={handleAddCriterion} className="space-y-3.5">
                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider text-slate-600 mb-1">
                    Criterion Name *
                  </label>
                  <input
                    type="text"
                    required
                    value={criterionName}
                    onChange={(e) => setCriterionName(e.target.value)}
                    placeholder="e.g., Commercial Feasibility"
                    className="w-full rounded-lg border border-slate-300 p-2 text-xs text-slate-900 focus:border-indigo-500 focus:outline-none"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider text-slate-600 mb-1">
                    Weight Percentage (%) *
                  </label>
                  <input
                    type="number"
                    min="1"
                    max="100"
                    required
                    value={criterionWeight}
                    onChange={(e) => setCriterionWeight(parseInt(e.target.value) || 0)}
                    className="w-full rounded-lg border border-slate-300 p-2 text-xs text-slate-900 focus:border-indigo-500 focus:outline-none"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider text-slate-600 mb-1">
                    Description & Judging Guidelines
                  </label>
                  <textarea
                    rows={2}
                    value={criterionDesc}
                    onChange={(e) => setCriterionDesc(e.target.value)}
                    placeholder="Provide evaluation guidance for judges..."
                    className="w-full rounded-lg border border-slate-300 p-2 text-xs text-slate-900 focus:border-indigo-500 focus:outline-none"
                  />
                </div>

                <button
                  type="submit"
                  className="w-full mt-2 flex items-center justify-center gap-2 rounded-lg bg-indigo-600 py-2.5 text-xs font-bold text-white shadow-xs hover:bg-indigo-700 transition-all"
                >
                  <Plus className="h-4 w-4" />
                  <span>Add Criterion</span>
                </button>
              </form>
            </div>

            {/* Criteria List & Sliders */}
            <div className="lg:col-span-7 rounded-xl border border-slate-200 bg-white p-5 shadow-xs">
              <div className="flex items-center justify-between border-b border-slate-100 pb-3 mb-3">
                <h2 className="text-sm font-semibold text-slate-900">
                  Event Rubric Criteria ({editableCriteria.length})
                </h2>
                <span className="text-xs text-slate-400">Adjust weights inline</span>
              </div>

              <div className="space-y-3">
                {editableCriteria.map((c) => (
                  <div
                    key={c.id}
                    className="rounded-lg border border-slate-100 bg-slate-50/50 p-3 hover:bg-slate-50 transition-all"
                  >
                    <div className="flex items-center justify-between gap-2">
                      <div className="min-w-0">
                        <span className="font-semibold text-slate-900 text-xs">
                          {c.name}
                        </span>
                        <p className="text-[11px] text-slate-500 line-clamp-1 mt-0.5">
                          {c.description}
                        </p>
                      </div>

                      <div className="flex items-center gap-3 shrink-0">
                        <div className="flex items-center gap-1">
                          <input
                            type="number"
                            min="1"
                            max="100"
                            value={c.weight}
                            onChange={(e) =>
                              handleWeightChange(c.id, parseInt(e.target.value) || 1)
                            }
                            className="w-14 rounded-md border border-slate-300 bg-white p-1 text-center font-mono text-xs font-bold text-slate-900"
                          />
                          <span className="text-xs font-medium text-slate-500">%</span>
                        </div>

                        <button
                          onClick={() => handleDeleteCriterion(c.id)}
                          className="rounded-md p-1 text-slate-400 hover:bg-red-50 hover:text-red-600 transition-colors"
                          title="Delete criterion"
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
