'use client';

import React, { useState } from 'react';
import {
  AuditEntry,
  VerifyChainResult,
} from '@/lib/audit';
import {
  RUBRIC_CRITERIA,
  SEED_JUDGES,
  SEED_TEAMS,
  ScoreRecord,
  Judge,
  Team,
  Criterion,
  AppMode,
} from '@/lib/data';
import {
  ShieldCheck,
  ShieldAlert,
  AlertTriangle,
  RotateCcw,
  CheckCircle2,
  XCircle,
  Search,
  Hash,
  Database,
  Lock,
  ArrowRight,
  Sparkles,
} from 'lucide-react';

interface AuditLogPageProps {
  chain: AuditEntry[];
  scores: ScoreRecord[];
  verificationResult: VerifyChainResult | null;
  onVerify: () => Promise<VerifyChainResult>;
  onTamper: () => void;
  onRestore: () => void;
  tamperedInfo: {
    scoreId: string;
    original: number;
    newScore: number;
  } | null;
  judges?: Judge[];
  teams?: Team[];
  criteria?: Criterion[];
  mode?: AppMode;
}

export function AuditLogPage({
  chain,
  scores,
  verificationResult,
  onVerify,
  onTamper,
  onRestore,
  tamperedInfo,
  judges = SEED_JUDGES,
  teams = SEED_TEAMS,
  criteria = RUBRIC_CRITERIA,
  mode = 'demo',
}: AuditLogPageProps) {
  const [isVerifying, setIsVerifying] = useState<boolean>(false);
  const [searchFilter, setSearchFilter] = useState<string>('');
  const [currentPage, setCurrentPage] = useState<number>(1);
  const pageSize = 20;

  const handleRunVerify = async () => {
    setIsVerifying(true);
    try {
      await onVerify();
    } finally {
      setIsVerifying(false);
    }
  };

  // Filter chain entries
  const filteredEntries = chain.filter((entry) => {
    if (!searchFilter.trim()) return true;
    const q = searchFilter.toLowerCase();
    const j = judges.find((judge) => judge.id === entry.judge_id);
    const t = teams.find((team) => team.id === entry.team_id);
    const c = criteria.find((crit) => crit.id === entry.criterion_id);

    return (
      entry.index.toString().includes(q) ||
      (j && j.name.toLowerCase().includes(q)) ||
      (t && t.name.toLowerCase().includes(q)) ||
      (c && c.name.toLowerCase().includes(q)) ||
      entry.hash.toLowerCase().includes(q)
    );
  });

  const totalPages = Math.ceil(filteredEntries.length / pageSize) || 1;
  const paginatedEntries = filteredEntries.slice(
    (currentPage - 1) * pageSize,
    currentPage * pageSize
  );

  const shortenHash = (hash: string) => {
    if (hash === 'GENESIS') return 'GENESIS';
    return `${hash.substring(0, 8)}...${hash.substring(hash.length - 6)}`;
  };

  return (
    <div className="space-y-6 max-w-7xl mx-auto">
      {/* Top Banner and Description */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 rounded-xl border border-slate-200 bg-white p-5 shadow-xs">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-2xl font-bold tracking-tight text-slate-900">
              Immutable Audit Ledger
            </h1>
            <span className="rounded-md bg-indigo-50 px-2.5 py-0.5 text-xs font-semibold text-indigo-700 border border-indigo-200">
              SHA-256 Chain
            </span>
          </div>
          <p className="text-xs text-slate-500 mt-1">
            Every judging submission creates a cryptographic hash block: <code className="bg-slate-100 px-1 py-0.5 rounded text-slate-700">SHA256(prev_hash + payload)</code>. Verification detects any silent database modification.
          </p>
        </div>

        {/* Action Buttons */}
        <div className="flex flex-wrap items-center gap-2.5">
          <button
            onClick={handleRunVerify}
            disabled={isVerifying}
            className="flex items-center gap-1.5 rounded-lg bg-indigo-600 px-4 py-2.5 text-xs font-semibold text-white shadow-xs hover:bg-indigo-700 active:scale-[0.99] transition-all disabled:opacity-50"
          >
            <ShieldCheck className="h-4 w-4" />
            <span>{isVerifying ? 'Verifying Hashes...' : 'Verify Chain'}</span>
          </button>

          <button
            onClick={onTamper}
            className="flex items-center gap-1.5 rounded-lg border border-amber-300 bg-amber-50 px-3.5 py-2.5 text-xs font-semibold text-amber-800 hover:bg-amber-100 transition-colors shadow-2xs"
            title="Adds +2.0 to stored score in database without touching the audit log"
          >
            <AlertTriangle className="h-4 w-4 text-amber-600" />
            <span>Simulate Tampering</span>
          </button>

          <button
            onClick={onRestore}
            className="flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3.5 py-2.5 text-xs font-semibold text-slate-700 hover:bg-slate-50 transition-colors shadow-2xs"
            title="Restores authentic database scores"
          >
            <RotateCcw className="h-4 w-4 text-slate-500" />
            <span>Restore</span>
          </button>
        </div>
      </div>

      {/* Verification Result Banner */}
      {verificationResult && (
        <div>
          {verificationResult.valid ? (
            <div className="rounded-xl border-2 border-emerald-500 bg-emerald-50 p-4 text-emerald-900 shadow-sm animate-in fade-in duration-200">
              <div className="flex items-center gap-3">
                <CheckCircle2 className="h-6 w-6 text-emerald-600 shrink-0" />
                <div>
                  <p className="text-sm font-bold tracking-tight text-emerald-950 uppercase">
                    CHAIN VALID: CRYPTOGRAPHIC INTEGRITY VERIFIED
                  </p>
                  <p className="text-xs text-emerald-800 font-medium mt-0.5">
                    All {chain.length} audit entries verified. Every SHA-256 hash correctly chains to its predecessor, and all stored scores in localStorage strictly match their recorded payloads.
                  </p>
                </div>
              </div>
            </div>
          ) : (
            <div className="rounded-xl border-2 border-red-500 bg-red-50 p-4 text-red-900 shadow-sm animate-in fade-in duration-200">
              <div className="flex items-center gap-3">
                <ShieldAlert className="h-6 w-6 text-red-600 shrink-0" />
                <div>
                  <p className="text-sm font-bold tracking-tight text-red-950 uppercase">
                    TAMPERED: INTEGRITY BREACH DETECTED
                  </p>
                  <p className="text-xs text-red-800 font-medium mt-0.5">
                    First broken index: <strong>Row #{verificationResult.firstBrokenIndex}</strong>. Database state diverged from cryptographic ledger record!
                  </p>
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Tampered notification state notice */}
      {tamperedInfo && !verificationResult && (
        <div className="flex items-center justify-between rounded-lg bg-amber-50 border border-amber-300 p-3 text-xs text-amber-900 shadow-2xs">
          <div className="flex items-center gap-2">
            <AlertTriangle className="h-4 w-4 text-amber-600 shrink-0" />
            <span>
              <strong>Simulated Tamper Active:</strong> Score for record <code className="bg-amber-100 px-1 py-0.5 rounded">{tamperedInfo.scoreId}</code> modified from {tamperedInfo.original.toFixed(1)} to {tamperedInfo.newScore.toFixed(1)} in database.
            </span>
          </div>
          <span className="font-semibold text-amber-800">
            Click "Verify Chain" to inspect detection
          </span>
        </div>
      )}

      {/* Table Container */}
      <div className="rounded-xl border border-slate-200 bg-white shadow-xs overflow-hidden">
        <div className="border-b border-slate-200 bg-slate-50/70 p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <Database className="h-4 w-4 text-slate-500" />
            <h2 className="text-sm font-semibold text-slate-900">
              Audit Chain Blocks ({filteredEntries.length} of {chain.length})
            </h2>
          </div>

          <div className="relative w-full sm:w-64">
            <Search className="absolute left-2.5 top-2.5 h-3.5 w-3.5 text-slate-400" />
            <input
              type="text"
              value={searchFilter}
              onChange={(e) => {
                setSearchFilter(e.target.value);
                setCurrentPage(1);
              }}
              placeholder="Search judge, team, hash..."
              className="w-full rounded-lg border border-slate-300 bg-white pl-8 pr-3 py-1.5 text-xs text-slate-800 placeholder:text-slate-400 focus:border-indigo-500 focus:outline-none"
            />
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm text-slate-700">
            <thead className="border-b border-slate-200 bg-slate-50/50 text-[11px] font-bold uppercase tracking-wider text-slate-500">
              <tr>
                <th className="px-3 py-2.5 text-center w-14">Index</th>
                <th className="px-3 py-2.5">Judge</th>
                <th className="px-3 py-2.5">Team</th>
                <th className="px-3 py-2.5">Criterion</th>
                <th className="px-3 py-2.5 text-center">Score</th>
                <th className="px-3 py-2.5 font-mono">Prev Hash</th>
                <th className="px-3 py-2.5 font-mono">Hash (SHA-256)</th>
                <th className="px-3 py-2.5 text-center">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {paginatedEntries.map((entry) => {
                const judge = judges.find((j) => j.id === entry.judge_id);
                const team = teams.find((t) => t.id === entry.team_id);
                const crit = criteria.find((c) => c.id === entry.criterion_id);

                const verificationRow = verificationResult?.rows.find(
                  (r) => r.index === entry.index
                );

                const isFirstBroken =
                  verificationResult &&
                  verificationResult.firstBrokenIndex === entry.index;

                const isRowTampered =
                  verificationRow && verificationRow.status !== 'valid';

                return (
                  <tr
                    key={entry.index}
                    className={`transition-colors text-xs ${
                      isFirstBroken
                        ? 'bg-red-100/80 border-l-4 border-l-red-600'
                        : isRowTampered
                        ? 'bg-red-50/60'
                        : 'hover:bg-slate-50/60'
                    }`}
                  >
                    <td className="px-3 py-2.5 text-center font-mono font-semibold text-slate-500">
                      #{entry.index}
                    </td>
                    <td className="px-3 py-2.5 font-medium text-slate-900 truncate max-w-[120px]">
                      {judge ? judge.name.split(' ')[0] + ' ' + (judge.name.split(' ')[1] || '') : entry.judge_id}
                    </td>
                    <td className="px-3 py-2.5 font-semibold text-slate-800 truncate max-w-[120px]">
                      {team?.name || entry.team_id}
                    </td>
                    <td className="px-3 py-2.5 text-slate-600">
                      {crit?.name || entry.criterion_id}
                    </td>
                    <td className="px-3 py-2.5 text-center font-mono font-bold text-slate-900">
                      {entry.score.toFixed(1)}
                    </td>
                    <td className="px-3 py-2.5 font-mono text-[11px] text-slate-500">
                      {shortenHash(entry.prev_hash)}
                    </td>
                    <td className="px-3 py-2.5 font-mono text-[11px] text-indigo-600 font-medium">
                      {shortenHash(entry.hash)}
                    </td>
                    <td className="px-3 py-2.5 text-center">
                      {verificationRow ? (
                        verificationRow.status === 'valid' ? (
                          <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2 py-0.5 text-[10px] font-semibold text-emerald-700 border border-emerald-200">
                            <CheckCircle2 className="h-3 w-3" />
                            Valid
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 rounded-full bg-red-100 px-2 py-0.5 text-[10px] font-bold text-red-700 border border-red-300 animate-pulse">
                            <XCircle className="h-3 w-3" />
                            Tampered
                          </span>
                        )
                      ) : (
                        <span className="text-[10px] font-medium text-slate-400">
                          Unverified
                        </span>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        {/* Pagination Bar */}
        <div className="flex items-center justify-between border-t border-slate-200 bg-slate-50/50 px-4 py-3 text-xs text-slate-600">
          <span>
            Showing {(currentPage - 1) * pageSize + 1} to{' '}
            {Math.min(currentPage * pageSize, filteredEntries.length)} of{' '}
            {filteredEntries.length} records
          </span>

          <div className="flex items-center gap-2">
            <button
              onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
              disabled={currentPage === 1}
              className="rounded-md border border-slate-300 bg-white px-2.5 py-1 text-xs font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-40"
            >
              Previous
            </button>
            <span className="font-mono text-slate-800">
              {currentPage} / {totalPages}
            </span>
            <button
              onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
              disabled={currentPage === totalPages}
              className="rounded-md border border-slate-300 bg-white px-2.5 py-1 text-xs font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-40"
            >
              Next
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
