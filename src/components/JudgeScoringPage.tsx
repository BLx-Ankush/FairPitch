'use client';

import React, { useState, useEffect } from 'react';
import {
  Criterion,
  Judge,
  RUBRIC_CRITERIA,
  SEED_JUDGES,
  SEED_TEAMS,
  ScoreRecord,
  Team,
} from '@/lib/data';
import {
  CheckCircle2,
  Send,
  HelpCircle,
  Award,
  Sparkles,
  AlertCircle,
} from 'lucide-react';

interface JudgeScoringPageProps {
  scores: ScoreRecord[];
  judges?: Judge[];
  teams?: Team[];
  criteria?: Criterion[];
  onSubmitScores: (
    judgeId: string,
    teamId: string,
    criterionScores: Record<string, number>,
    comment: string
  ) => Promise<void>;
}

export function JudgeScoringPage({
  scores,
  judges = SEED_JUDGES,
  teams = SEED_TEAMS,
  criteria = RUBRIC_CRITERIA,
  onSubmitScores,
}: JudgeScoringPageProps) {
  const [selectedJudgeId, setSelectedJudgeId] = useState<string>(
    judges[0]?.id || 'judge-1'
  );
  const [selectedTeamId, setSelectedTeamId] = useState<string>(
    teams[0]?.id || 'team-1'
  );

  const [sliderScores, setSliderScores] = useState<Record<string, number>>({});
  const [comment, setComment] = useState<string>('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  // Sync selected judge and team when options change (e.g. switching modes)
  useEffect(() => {
    if (judges.length > 0 && !judges.some((j) => j.id === selectedJudgeId)) {
      setSelectedJudgeId(judges[0].id);
    }
    if (teams.length > 0 && !teams.some((t) => t.id === selectedTeamId)) {
      setSelectedTeamId(teams[0].id);
    }
  }, [judges, teams, selectedJudgeId, selectedTeamId]);

  // When selected judge, team, or criteria change, populate current scores if available
  useEffect(() => {
    const existingScores = scores.filter(
      (s) => s.judge_id === selectedJudgeId && s.team_id === selectedTeamId
    );

    const initialValues: Record<string, number> = {};
    criteria.forEach((c) => {
      const match = existingScores.find((s) => s.criterion_id === c.id);
      initialValues[c.id] = match ? match.score : 7.0;
    });

    setSliderScores(initialValues);

    const firstComment = existingScores.find((s) => s.comment)?.comment || '';
    setComment(firstComment);
    setSuccessMessage(null);
  }, [selectedJudgeId, selectedTeamId, scores, criteria]);

  const handleSliderChange = (criterionId: string, value: number) => {
    setSliderScores((prev) => ({
      ...prev,
      [criterionId]: value,
    }));
  };

  // Calculate live total score out of 100
  const computedTotal = criteria.reduce((acc, crit) => {
    const s = sliderScores[crit.id] ?? 0;
    return acc + (s / 10) * crit.weight;
  }, 0);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedJudgeId || !selectedTeamId) return;

    setIsSubmitting(true);
    try {
      await onSubmitScores(
        selectedJudgeId,
        selectedTeamId,
        sliderScores,
        comment
      );
      const judgeName =
        judges.find((j) => j.id === selectedJudgeId)?.name || 'Judge';
      const teamName =
        teams.find((t) => t.id === selectedTeamId)?.name || 'Team';
      setSuccessMessage(
        `Evaluation recorded for ${teamName} by ${judgeName}! ${criteria.length} cryptographic records committed to audit chain.`
      );
    } catch (err) {
      console.error(err);
    } finally {
      setIsSubmitting(false);
    }
  };

  const selectedJudge = judges.find((j) => j.id === selectedJudgeId);
  const selectedTeam = teams.find((t) => t.id === selectedTeamId);

  if (judges.length === 0 || teams.length === 0 || criteria.length === 0) {
    return (
      <div className="rounded-xl border border-amber-200 bg-amber-50 p-6 text-center max-w-xl mx-auto my-8">
        <AlertCircle className="h-8 w-8 text-amber-600 mx-auto mb-2" />
        <h2 className="text-base font-bold text-amber-900">Event Setup Required</h2>
        <p className="text-xs text-amber-700 mt-1">
          Please add at least one judge, team, and criterion in the <strong>Event Setup</strong> tab before submitting evaluations.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-6 max-w-4xl mx-auto">
      {/* Header section */}
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-slate-900">
          Judge Scoring Portal
        </h1>
        <p className="text-sm text-slate-500 mt-1">
          Input rubric evaluations (0-10 per criterion). Scores are hashed
          cryptographically on submission for audit trail verification.
        </p>
      </div>

      {/* Success banner */}
      {successMessage && (
        <div className="flex items-center gap-3 rounded-xl bg-emerald-50 border border-emerald-200 p-4 text-sm text-emerald-900 shadow-xs animate-in fade-in duration-200">
          <CheckCircle2 className="h-5 w-5 text-emerald-600 shrink-0" />
          <div className="flex-1">
            <p className="font-semibold">Scores Submitted Successfully</p>
            <p className="text-xs text-emerald-700 mt-0.5">{successMessage}</p>
          </div>
          <button
            onClick={() => setSuccessMessage(null)}
            className="text-xs font-semibold text-emerald-700 hover:text-emerald-900"
          >
            Dismiss
          </button>
        </div>
      )}

      {/* Main Scoring Form */}
      <form onSubmit={handleSubmit} className="space-y-6">
        {/* Judge and Team Selectors Card */}
        <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-xs grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="block text-xs font-semibold uppercase tracking-wider text-slate-500 mb-1.5">
              Select Judge
            </label>
            <select
              value={selectedJudgeId}
              onChange={(e) => setSelectedJudgeId(e.target.value)}
              className="w-full rounded-lg border border-slate-300 bg-white px-3.5 py-2.5 text-sm font-medium text-slate-800 shadow-2xs focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/20"
            >
              {judges.map((judge) => (
                <option key={judge.id} value={judge.id}>
                  {judge.name} ({judge.title})
                </option>
              ))}
            </select>
            {selectedJudge && (
              <p className="mt-1 text-xs text-slate-500 truncate">
                Active judge: <span className="font-medium text-slate-700">{selectedJudge.title}</span>
              </p>
            )}
          </div>

          <div>
            <label className="block text-xs font-semibold uppercase tracking-wider text-slate-500 mb-1.5">
              Select Team
            </label>
            <select
              value={selectedTeamId}
              onChange={(e) => setSelectedTeamId(e.target.value)}
              className="w-full rounded-lg border border-slate-300 bg-white px-3.5 py-2.5 text-sm font-medium text-slate-800 shadow-2xs focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/20"
            >
              {teams.map((team) => (
                <option key={team.id} value={team.id}>
                  {team.name} — {team.track}
                </option>
              ))}
            </select>
            {selectedTeam && (
              <p className="mt-1 text-xs text-slate-500 truncate">
                {selectedTeam.tagline}
              </p>
            )}
          </div>
        </div>

        {/* Dynamic Criterion Sliders */}
        <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-xs space-y-6">
          <div className="flex items-center justify-between border-b border-slate-100 pb-3">
            <div>
              <h2 className="text-base font-semibold text-slate-900">
                Official Rubric Criteria ({criteria.length})
              </h2>
              <p className="text-xs text-slate-500">
                Drag sliders 0.0 to 10.0. Each criterion contributes proportionally to the 100-point total.
              </p>
            </div>
            {/* Live total pill */}
            <div className="text-right">
              <span className="text-xs font-semibold uppercase text-slate-400">Total Score</span>
              <div className="flex items-baseline gap-1">
                <span className="text-2xl font-bold text-indigo-600">
                  {computedTotal.toFixed(1)}
                </span>
                <span className="text-xs font-medium text-slate-400">/ 100</span>
              </div>
            </div>
          </div>

          <div className="space-y-6">
            {criteria.map((criterion) => {
              const currentScore = sliderScores[criterion.id] ?? 5;
              const pointsEarned = ((currentScore / 10) * criterion.weight).toFixed(1);

              return (
                <div
                  key={criterion.id}
                  className="rounded-lg border border-slate-100 bg-slate-50/50 p-4 transition-all hover:bg-slate-50"
                >
                  <div className="flex items-center justify-between mb-1">
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-semibold text-slate-800">
                        {criterion.name}
                      </span>
                      <span className="rounded-md bg-indigo-100 px-2 py-0.5 text-[11px] font-semibold text-indigo-700">
                        Weight: {criterion.weight}%
                      </span>
                    </div>

                    <div className="flex items-center gap-2">
                      <span className="text-xs text-slate-500">
                        ({pointsEarned} / {criterion.weight} pts)
                      </span>
                      <span className="w-12 text-right font-mono text-base font-bold text-slate-900">
                        {currentScore.toFixed(1)}
                      </span>
                    </div>
                  </div>

                  <p className="text-xs text-slate-500 mb-3">
                    {criterion.description}
                  </p>

                  <div className="flex items-center gap-4">
                    <span className="text-xs font-medium text-slate-400">0.0</span>
                    <input
                      type="range"
                      min="0"
                      max="10"
                      step="0.1"
                      value={currentScore}
                      onChange={(e) =>
                        handleSliderChange(criterion.id, parseFloat(e.target.value))
                      }
                      className="h-2 w-full cursor-pointer appearance-none rounded-lg bg-slate-200 accent-indigo-600 focus:outline-none"
                    />
                    <span className="text-xs font-medium text-slate-400">10.0</span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Comment Box */}
        <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-xs">
          <label className="block text-xs font-semibold uppercase tracking-wider text-slate-600 mb-1.5">
            Qualitative Judging Feedback & Justification
          </label>
          <textarea
            rows={3}
            value={comment}
            onChange={(e) => setComment(e.target.value)}
            placeholder="Document constructive feedback, architecture observations, strengths, or concerns..."
            className="w-full rounded-lg border border-slate-300 p-3 text-sm text-slate-800 placeholder:text-slate-400 focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/20"
          />
          <p className="mt-1.5 text-xs text-slate-400">
            Comments are included in the SHA-256 payload and loss autopsy analysis.
          </p>
        </div>

        {/* Action button */}
        <div className="flex items-center justify-end gap-3 pt-2">
          <button
            type="submit"
            disabled={isSubmitting}
            className="flex items-center gap-2 rounded-xl bg-indigo-600 px-6 py-3 text-sm font-semibold text-white shadow-xs hover:bg-indigo-700 active:scale-[0.99] transition-all disabled:opacity-50"
          >
            {isSubmitting ? (
              <span>Committing Block...</span>
            ) : (
              <>
                <Send className="h-4 w-4" />
                <span>Submit Evaluation to Audit Ledger</span>
              </>
            )}
          </button>
        </div>
      </form>
    </div>
  );
}
